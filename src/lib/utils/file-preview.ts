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
 * @file file-preview — resolves a FILE_PREVIEW-adorned field of a record into the thumbnail,
 * full-size URL and file details a thumbnail and the preview lightbox show, using the backend's
 * value keys (`AdornmentType.FilePreviewValues`). Only explicitly adorned fields are previewed.
 */

import type { FieldAdornment, QFieldMetaData, QRecord } from '@/types'
import { isSafeImageSource } from '@/lib/theme/apply-branding'
import { fieldDownloadUrl, fileDownload, findAdornment } from './adornment-utils'

/** What kind of preview a file gets. */
export type FilePreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'other'

/** A previewable file value, resolved from a record. */
export interface FilePreviewItem {
  /** URL of the small rendition shown as a thumbnail (images only). */
  thumbnailUrl?: string
  /** URL of the full-size file, shown in the preview and used to open or download it. */
  url: string
  /** File name for the title, alt text fallback and download. */
  fileName: string
  /** MIME type when known (from a field, the default, or the extension). */
  mimeType?: string
  /** Preview kind. */
  kind: FilePreviewKind
  /** Alternative text for the image. */
  alt: string
  /** Caption, when the backend names a caption field. */
  caption?: string
  /** Pixel width, when known. */
  width?: number
  /** Pixel height, when known. */
  height?: number
  /** File size in bytes, when known. */
  sizeBytes?: number
  /** Whether clicking the thumbnail opens the preview. */
  previewable: boolean
  /** Largest edge of the list thumbnail, in CSS pixels. */
  thumbnailSize: number
}

/** Backend value keys of a FILE_PREVIEW adornment (`AdornmentType.FilePreviewValues`). */
export const FILE_PREVIEW_KEYS = {
  thumbnailUrlField: 'thumbnailUrlField',
  fullSizeUrlField: 'fullSizeUrlField',
  fileNameField: 'fileNameField',
  mimeTypeField: 'mimeTypeField',
  altTextField: 'altTextField',
  captionField: 'captionField',
  widthField: 'widthField',
  heightField: 'heightField',
  sizeBytesField: 'sizeBytesField',
  defaultMimeType: 'defaultMimeType',
  thumbnailMaxSize: 'thumbnailMaxSize',
  previewable: 'previewable',
} as const

/** Thumbnail size the backend defaults to, and its bounds. */
export const DEFAULT_THUMBNAIL_SIZE = 40
/** Thumbnail edge in record view sections, which also show the file name. */
export const RECORD_VIEW_THUMBNAIL_SIZE = 160
/** Thumbnail edge in the record view header. */
export const HEADER_THUMBNAIL_SIZE = 96
const MIN_THUMBNAIL_SIZE = 16
const MAX_THUMBNAIL_SIZE = 512

/** Characters never valid in a URL from a record value: control characters, quotes, angle brackets, backslashes. */
const UNSAFE_URL_CHARACTERS = /[\u0000-\u001f\u007f<>"\\]/

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
  pdf: 'application/pdf',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', oga: 'audio/ogg', ogg: 'audio/ogg', flac: 'audio/flac',
}

/**
 * Whether a field has a FILE_PREVIEW adornment.
 *
 * @param field - Field metadata.
 * @returns `true` when the field is adorned for previews.
 */
export function hasFilePreview(field: { adornments?: FieldAdornment[] } | undefined): boolean {
  return Boolean(field?.adornments?.some((adornment) => adornment.type === 'FILE_PREVIEW'))
}

/**
 * A URL that may be loaded into an image, media element or frame and opened in a new tab:
 * an http(s) URL or a same-origin path (never `//host`, `javascript:` or other schemes). Backend
 * field-download paths (`/data/...`) are served from the v1 route. Inline `data:image/*` sources
 * are accepted for images only.
 *
 * @param value - A URL from a record value.
 * @param allowDataImage - Whether `data:image/*` is acceptable (thumbnails and image previews).
 * @returns The URL to use, or `undefined` when it is unsafe or empty.
 */
export function safePreviewUrl(value: unknown, allowDataImage = false): string | undefined {
  if (typeof value !== 'string') return undefined
  const url = value.trim()
  if (!url || url.startsWith('//') || UNSAFE_URL_CHARACTERS.test(url)) return undefined
  if (/^data:/i.test(url)) return allowDataImage && /^data:image\//i.test(url) && isSafeImageSource(url) ? url : undefined
  if (!url.startsWith('/') && !/^https?:\/\//i.test(url)) return undefined
  if (!isSafeImageSource(url)) return undefined
  return fieldDownloadUrl(url)
}

/**
 * Whether a URL is served by the page's own origin (frames and media are limited to `'self'`
 * by the dashboard's Content-Security-Policy).
 *
 * @param url - An absolute URL or a path.
 * @returns `true` for paths and URLs on the current origin.
 */
export function isSameOrigin(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true
  if (typeof window === 'undefined') return false
  try {
    return new URL(url).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Whether a URL is a file served by the QQQ backend on this origin (a path under `/qqq/`). Only
 * these are framed in the preview: any other same-origin page in an iframe would run with the
 * dashboard's own origin.
 *
 * @param url - A URL or path.
 * @returns True for a same-origin `/qqq/...` path.
 */
export function isBackendFileUrl(url: string): boolean {
  if (!isSameOrigin(url)) return false
  try {
    return new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin).pathname.startsWith('/qqq/')
  } catch {
    return false
  }
}

/**
 * The preview kind of a MIME type.
 *
 * @param mimeType - A MIME type such as `image/png`.
 * @returns The kind, or `other`.
 */
export function kindOfMimeType(mimeType: string | undefined): FilePreviewKind {
  const type = (mimeType ?? '').toLowerCase().split(';')[0].trim()
  if (type.startsWith('image/')) return 'image'
  if (type === 'application/pdf') return 'pdf'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  return 'other'
}

/**
 * The MIME type of a file name or URL, from its extension.
 *
 * @param name - A file name or URL.
 * @returns The MIME type, or `undefined` for an unknown extension.
 */
export function mimeTypeOfName(name: string | undefined): string | undefined {
  const path = (name ?? '').split(/[?#]/)[0]
  const dot = path.lastIndexOf('.')
  if (dot < 0 || dot < path.lastIndexOf('/')) return undefined
  return EXTENSION_TYPES[path.slice(dot + 1).toLowerCase()]
}

/**
 * Formats a byte count for people (`1.4 MB`).
 *
 * @param bytes - Number of bytes.
 * @returns The formatted size.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`
}

/**
 * Resolves the FILE_PREVIEW adornment of a field against a record.
 *
 * The adorned field's own value is the default thumbnail and full-size source; for a field that
 * also has FILE_DOWNLOAD (a BLOB), the download URL the backend wrote into the value is used.
 * Unsafe or missing URLs yield `null`, so the caller renders the value as usual.
 *
 * @param field - Field metadata with a FILE_PREVIEW adornment.
 * @param record - The record holding the value and the fields the adornment names.
 * @param tableVariant - Selected table variant as v1 JSON, for backend field-download URLs.
 * @returns The preview item, or `null` when the field is not adorned or has no usable URL.
 */
export function filePreview(field: QFieldMetaData, record: QRecord, tableVariant?: string): FilePreviewItem | null {
  const adornment = findAdornment(field, 'FILE_PREVIEW')
  if (!adornment) return null
  const settings = adornment.values ?? {}
  const fieldName = (key: keyof typeof FILE_PREVIEW_KEYS): string | undefined => {
    const name = settings[FILE_PREVIEW_KEYS[key]]
    return typeof name === 'string' && name ? name : undefined
  }
  const valueOf = (key: keyof typeof FILE_PREVIEW_KEYS): unknown => {
    const name = fieldName(key)
    return name ? record.values[name] : undefined
  }
  const text = (value: unknown): string | undefined =>
    ((typeof value === 'string' && value.trim()) || typeof value === 'number') ? String(value).trim() : undefined
  const positive = (value: unknown): number | undefined => {
    const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
    return Number.isFinite(number) && number > 0 ? number : undefined
  }

  const download = findAdornment(field, 'FILE_DOWNLOAD') ? fileDownload(field, record, tableVariant) : null
  const ownUrl = download?.url ?? safePreviewUrl(record.values[field.name], true)
  const fullSizeField = fieldName('fullSizeUrlField')
  const url = fullSizeField ? safePreviewUrl(record.values[fullSizeField], true) ?? ownUrl : ownUrl
  const thumbnailField = fieldName('thumbnailUrlField')
  const thumbnailSource = thumbnailField ? safePreviewUrl(record.values[thumbnailField], true) : undefined
  if (!url && !thumbnailSource) return null

  const display = record.displayValues?.[field.name]
  const fileName = text(valueOf('fileNameField')) ?? download?.fileName
    ?? (typeof display === 'string' && display && !/^(https?:)?\//i.test(display) ? display : undefined)
    ?? lastSegment(url ?? thumbnailSource ?? '') ?? field.label
  const defaultMimeType = typeof settings.defaultMimeType === 'string' ? settings.defaultMimeType : undefined
  const declaredType = text(valueOf('mimeTypeField')) ?? (defaultMimeType && !defaultMimeType.endsWith('/*') ? defaultMimeType : undefined)
  const mimeType = declaredType ?? mimeTypeOfName(fileName) ?? mimeTypeOfName(url) ?? defaultMimeType
  const kind = kindOfMimeType(mimeType)
  const size = positive(settings.thumbnailMaxSize)
  const previewable = settings.previewable !== false && String(settings.previewable).toLowerCase() !== 'false'

  return {
    ...(kind === 'image' && (thumbnailSource ?? url) ? { thumbnailUrl: thumbnailSource ?? url } : {}),
    url: url ?? thumbnailSource ?? '',
    fileName,
    ...(mimeType ? { mimeType } : {}),
    kind,
    alt: text(valueOf('altTextField')) ?? text(valueOf('captionField')) ?? fileName,
    ...optional('caption', text(valueOf('captionField'))),
    ...optional('width', positive(valueOf('widthField'))),
    ...optional('height', positive(valueOf('heightField'))),
    ...optional('sizeBytes', positive(valueOf('sizeBytesField'))),
    previewable,
    thumbnailSize: size ? Math.min(MAX_THUMBNAIL_SIZE, Math.max(MIN_THUMBNAIL_SIZE, Math.round(size))) : DEFAULT_THUMBNAIL_SIZE,
  }
}

/**
 * Previewable items of the given fields across records, in record then field order: the set the
 * lightbox steps through with the arrow keys.
 *
 * @param records - Records on screen.
 * @param fields - Fields shown for them.
 * @param tableVariant - Selected table variant as v1 JSON.
 * @returns The items with the record and field each came from.
 */
export function filePreviewItems(records: QRecord[], fields: QFieldMetaData[], tableVariant?: string): Array<{ record: QRecord; field: QFieldMetaData; item: FilePreviewItem }> {
  const adorned = fields.filter(hasFilePreview)
  if (adorned.length === 0) return []
  const items: Array<{ record: QRecord; field: QFieldMetaData; item: FilePreviewItem }> = []
  for (const record of records) {
    for (const field of adorned) {
      const item = filePreview(field, record, tableVariant)
      if (item?.previewable) items.push({ record, field, item })
    }
  }
  return items
}

/**
 * An object holding one optional property, or none when the value is missing.
 *
 * @param key - Property name.
 * @param value - Property value.
 * @returns `{ [key]: value }` or `{}`.
 */
function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : { [key]: value } as Record<K, V>
}

/**
 * The decoded last path segment of a URL.
 *
 * @param url - A URL or path.
 * @returns The segment, or `undefined` when there is none.
 */
function lastSegment(url: string): string | undefined {
  if (/^data:/i.test(url)) return undefined
  const segment = url.split(/[?#]/)[0].split('/').pop()
  if (!segment) return undefined
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * A join column's field as its record values are keyed (`joinTable.field`): the field name and
 * the FILE_PREVIEW field references get the join table prefix. Fields without FILE_PREVIEW are
 * returned as they are.
 *
 * @param field - The joined table's field.
 * @param joinTableName - The join table's name.
 * @returns The field to resolve against a main-table record holding join values.
 */
export function joinedPreviewField<F extends { name: string; adornments?: FieldAdornment[] }>(field: F, joinTableName: string): F {
  if (!hasFilePreview(field)) return field
  const fieldKeys = new Set<string>(Object.values(FILE_PREVIEW_KEYS).filter((key) => key.endsWith('Field')))
  return {
    ...field,
    name: `${joinTableName}.${field.name}`,
    adornments: (field.adornments ?? []).map((adornment) => adornment.type !== 'FILE_PREVIEW' ? adornment : {
      ...adornment,
      values: Object.fromEntries(Object.entries(adornment.values ?? {}).map(([key, value]) =>
        [key, fieldKeys.has(key) && typeof value === 'string' && value ? `${joinTableName}.${value}` : value])),
    }),
  }
}
