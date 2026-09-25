/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file adornment-utils — reads field adornments using the backend's own value keys
 * (`AdornmentType.java`), so every screen interprets them the same way.
 */

import type { AdornmentType, FieldAdornment, QFieldMetaData, QRecord } from '@/types'
import { apiUrl } from '@/lib/api/client'

/** The field-download path the backend writes into record values: `/data/{table}/{pk}/{field}/{fileName}`. */
const FIELD_DOWNLOAD_PATH = /^\/data\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)\/([^?#]+)(\?[^#]*)?$/

/**
 * Serve a backend field-download path from the v1 record field download route
 * (`/table/{table}/{pk}/{field}/{fileName}` under the API base URL); other URLs are unchanged.
 *
 * @param url - A download URL from a record value.
 * @returns The v1 URL for a field download, or the URL as given.
 */
export function fieldDownloadUrl(url: string): string {
  const match = FIELD_DOWNLOAD_PATH.exec(url)
  if (!match) return url
  const [, table, primaryKey, field, fileName, query = ''] = match
  return apiUrl(`/table/${table}/${primaryKey}/${field}/${fileName}${query}`)
}

/**
 * Returns the first adornment of a type on a field.
 *
 * @param field - Field metadata.
 * @param type - Adornment type.
 * @returns The adornment, or `undefined`.
 */
export function findAdornment(field: QFieldMetaData, type: AdornmentType): FieldAdornment | undefined {
  return field.adornments?.find((adornment) => adornment.type === type)
}

/**
 * Whether a field declares an adornment type.
 *
 * @param field - Field metadata.
 * @param type - Adornment type.
 * @returns `true` when present.
 */
export function hasAdornment(field: QFieldMetaData, type: AdornmentType): boolean {
  return Boolean(findAdornment(field, type))
}

/**
 * Reads a text value of an adornment.
 *
 * @param field - Field metadata.
 * @param type - Adornment type.
 * @param key - Backend value key, for example `toRecordFromTable`.
 * @returns The non-empty string value, or `undefined`.
 */
export function adornmentString(field: QFieldMetaData, type: AdornmentType, key: string): string | undefined {
  const value = findAdornment(field, type)?.values?.[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** CHIP colors the backend declares (`AdornmentType.ChipValues`). */
export type ChipColor = 'default' | 'info' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'

const CHIP_COLORS: ChipColor[] = ['default', 'info', 'primary', 'secondary', 'success', 'warning', 'error']

/**
 * Chip color and icon for a value, from `color.<raw value>` and `icon.<raw value>`.
 *
 * @param field - Field metadata with a CHIP adornment.
 * @param rawValue - The stored (not display) value.
 * @returns The chip style; the color is `default` when the value has none.
 */
export function chipStyle(field: QFieldMetaData, rawValue: unknown): { color: ChipColor; icon?: string } {
  const color = adornmentString(field, 'CHIP', `color.${String(rawValue)}`)
  const icon = adornmentString(field, 'CHIP', `icon.${String(rawValue)}`)
  return { color: CHIP_COLORS.includes(color as ChipColor) ? color as ChipColor : 'default', ...(icon ? { icon } : {}) }
}

/** Tailwind classes for each backend chip color (4.5:1 text contrast in both themes). */
export const CHIP_COLOR_CLASSES: Record<ChipColor, string> = {
  default: 'border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100',
  info: 'border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-900/50 dark:text-sky-100',
  primary: 'border-blue-300 bg-blue-100 text-blue-950 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-100',
  secondary: 'border-purple-300 bg-purple-100 text-purple-950 dark:border-purple-700 dark:bg-purple-900/50 dark:text-purple-100',
  success: 'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100',
  warning: 'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-100',
  error: 'border-red-300 bg-red-100 text-red-950 dark:border-red-700 dark:bg-red-900/50 dark:text-red-100',
}

/** A resolved LINK adornment. */
export type LinkTarget =
  | { kind: 'record'; tableName: string; primaryKey: string }
  | { kind: 'url'; href: string; external: boolean; target: string }

/**
 * Where a LINK-adorned value points: another record (`toRecordFromTable`, or the
 * per-record `<field>:toRecordFromTableDynamic` display value) or the value itself
 * as a URL. Only http(s) URLs and same-origin paths are followed.
 *
 * @param field - Field metadata with a LINK adornment.
 * @param record - The record holding the value.
 * @returns The link, or `null` when the value cannot be linked.
 */
export function linkTarget(field: QFieldMetaData, record: QRecord): LinkTarget | null {
  const adornment = findAdornment(field, 'LINK')
  const rawValue = record.values[field.name]
  if (!adornment || rawValue === null || rawValue === undefined || rawValue === '') return null
  const staticTable = adornmentString(field, 'LINK', 'toRecordFromTable')
  const dynamicTable = adornment.values?.toRecordFromTableDynamic ? record.displayValues?.[`${field.name}:toRecordFromTableDynamic`] : undefined
  const tableName = staticTable ?? (typeof dynamicTable === 'string' && dynamicTable ? dynamicTable : undefined)
  if (tableName) return { kind: 'record', tableName, primaryKey: String(rawValue) }
  if (adornment.values?.toRecordFromTableDynamic) return null
  const href = String(rawValue).trim()
  const target = adornmentString(field, 'LINK', 'target') ?? '_self'
  if (/^https?:\/\//i.test(href)) return { kind: 'url', href, external: true, target }
  if (href.startsWith('/') && !href.startsWith('//')) return { kind: 'url', href, external: false, target }
  return null
}

/**
 * The download of a FILE_DOWNLOAD-adorned value. The backend replaces the value with
 * `/data/{table}/{pk}/{field}/{fileName}` (or supplies `<field>:downloadUrlDynamic`)
 * and puts the file name in the display value; field downloads are served from the
 * v1 route (see {@link fieldDownloadUrl}).
 *
 * @param field - Field metadata with a FILE_DOWNLOAD adornment.
 * @param record - The record holding the value.
 * @returns The URL and file name, or `null` when there is no file.
 */
export function fileDownload(field: QFieldMetaData, record: QRecord): { url: string; fileName: string } | null {
  const adornment = findAdornment(field, 'FILE_DOWNLOAD')
  if (!adornment) return null
  const dynamic = adornment.values?.downloadUrlDynamic ? record.displayValues?.[`${field.name}:downloadUrlDynamic`] : undefined
  const url = typeof dynamic === 'string' && dynamic ? dynamic : record.values[field.name]
  if (typeof url !== 'string' || !url || (!url.startsWith('/') && !/^https?:\/\//i.test(url)) || url.startsWith('//')) return null
  const display = record.displayValues?.[field.name]
  const fileName = typeof display === 'string' && display ? display : safeDecode(url.split('?')[0].split('/').pop() || field.label)
  return { url: fieldDownloadUrl(url), fileName }
}

/**
 * Decodes a URL path segment, keeping it as-is when it is not valid percent-encoding.
 *
 * @param segment - A path segment.
 * @returns The decoded text.
 */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Adds the `download` parameter that makes the backend send the file as an attachment.
 *
 * @param url - A backend file URL.
 * @returns The URL requesting `Content-Disposition: attachment`.
 */
export function attachmentUrl(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}download=1`
}

/**
 * Tooltip text of a TOOLTIP adornment: `staticText`, or the per-record
 * `<field>:tooltipDynamic` display value when `tooltipDynamic` is set.
 *
 * @param field - Field metadata.
 * @param record - The record holding the value.
 * @returns The tooltip, or `undefined`.
 */
export function tooltipText(field: QFieldMetaData, record: QRecord): string | undefined {
  const adornment = findAdornment(field, 'TOOLTIP')
  if (!adornment) return undefined
  if (adornment.values?.tooltipDynamic) {
    const dynamic = record.displayValues?.[`${field.name}:tooltipDynamic`]
    if (typeof dynamic === 'string' && dynamic) return dynamic
  }
  return adornmentString(field, 'TOOLTIP', 'staticText')
}

/** Column widths (px) for the SIZE adornment's `width` values, as the QQQ dashboards size grid columns. */
export const SIZE_WIDTHS: Record<string, number> = { xsmall: 60, small: 100, medium: 200, medlarge: 300, large: 400, xlarge: 600 }

/**
 * Suggested column width of a SIZE-adorned field.
 *
 * @param field - Field metadata.
 * @returns Width in pixels, or `undefined` without a (known) SIZE adornment.
 */
export function sizeWidth(field: QFieldMetaData): number | undefined {
  const width = adornmentString(field, 'SIZE', 'width')
  return width ? SIZE_WIDTHS[width.toLowerCase()] : undefined
}
