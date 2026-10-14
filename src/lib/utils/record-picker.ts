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
 * @file record-picker — display helpers of the record picker (a possible value source that
 * declares a `picker`): option thumbnails, subtitles and record links. The dialog's query and
 * preference helpers are in record-picker-query (loaded with the dialog).
 */

import type { QPossibleValue, QPossibleValuePicker } from '@/types'
import { safePreviewUrl } from './file-preview'

/**
 * The thumbnail URL of an option, when its thumbnail field holds a safe URL.
 * @param option - A picker option.
 * @param picker - The picker.
 * @returns The URL, or `undefined`.
 */
export function pickerThumbnailUrl(option: QPossibleValue | null | undefined, picker: QPossibleValuePicker | undefined): string | undefined {
  if (!option || !picker?.thumbnailField) return undefined
  return safePreviewUrl(option.values?.[picker.thumbnailField])
}

/**
 * The large preview URL of an option (its preview field, else its thumbnail).
 * @param option - A picker option.
 * @param picker - The picker.
 * @returns The URL, or `undefined`.
 */
export function pickerPreviewUrl(option: QPossibleValue | null | undefined, picker: QPossibleValuePicker | undefined): string | undefined {
  if (!option || !picker) return undefined
  return (picker.previewField ? safePreviewUrl(option.values?.[picker.previewField]) : undefined) ?? pickerThumbnailUrl(option, picker)
}

/**
 * The display text of one picker value of an option (formatted where the server formatted it).
 * @param option - A picker option.
 * @param fieldName - One of the picker's display fields.
 * @returns The text, or an empty string.
 */
export function pickerValueText(option: QPossibleValue, fieldName: string): string {
  const display = option.displayValues?.[fieldName]
  if (display !== undefined && display !== null) return display
  const raw = option.values?.[fieldName]
  return raw === null || raw === undefined ? '' : String(raw)
}

/**
 * The subtitle of an option: its subtitle fields' texts, joined.
 * @param option - A picker option.
 * @param picker - The picker.
 * @returns The subtitle, or an empty string.
 */
export function pickerSubtitle(option: QPossibleValue, picker: QPossibleValuePicker | undefined): string {
  return (picker?.subtitleFields ?? []).map((field) => pickerValueText(option, field)).filter(Boolean).join(' · ')
}

/**
 * The record view path of an option, opened from the picker.
 * @param tableName - The picker's table.
 * @param id - The option id.
 * @returns `/app/{tableName}/{id}`.
 */
export function pickerRecordPath(tableName: string, id: string | number): string {
  return `/app/${encodeURIComponent(tableName)}/${encodeURIComponent(String(id))}`
}
