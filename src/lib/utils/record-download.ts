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
 * @file record-download — the file behind a record field, for the record view's DOWNLOAD_FILE
 * menu items (Material `downloadFileFromField`): a BLOB is saved as a download, any other file
 * (a URL value or a FILE_DOWNLOAD link) opens in a new window.
 */

import type { QRecord, QTableMetaData } from '@/types'
import { attachmentUrl, fileDownload } from './adornment-utils'
import { storedRecordVariantJson } from './table-variant'
import { isHttpUrl } from './string-utils'

/** A field's file and how to deliver it. */
export interface RecordFieldFile {
  /** URL of the file (a v1 download route, a data URL of an inline BLOB, or the value's URL). */
  url: string
  /** Name to save a download as. */
  fileName: string
  /** `download` saves the file; `open` opens it in a new window. */
  mode: 'download' | 'open'
}

/**
 * The file a record field holds.
 *
 * @param table - The record's table.
 * @param record - The record.
 * @param fieldName - The field.
 * @returns The file, or `null` when the field is empty or holds no file.
 */
export function recordFieldFile(table: QTableMetaData, record: QRecord, fieldName: string): RecordFieldFile | null {
  const field = table.fields[fieldName]
  const value = record.values[fieldName]
  if (!field || value === null || value === undefined || value === '') return null

  const linked = fileDownload(field, record, storedRecordVariantJson(table))
  if (linked) {
    return field.type === 'BLOB'
      ? { url: attachmentUrl(linked.url), fileName: linked.fileName, mode: 'download' }
      : { url: linked.url, fileName: linked.fileName, mode: 'open' }
  }

  if (typeof value !== 'string') return null
  if (field.type === 'BLOB') {
    const primaryKey = record.values[table.primaryKeyField]
    const displayName = record.displayValues?.[fieldName]
    const fileName = typeof displayName === 'string' && displayName && displayName !== value
      ? displayName
      : `${table.label} ${primaryKey ?? ''} ${field.label}`.replace(/\s+/g, ' ').trim()
    return { url: `data:application/octet-stream;base64,${value}`, fileName, mode: 'download' }
  }
  if (isHttpUrl(value) || (value.startsWith('/') && !value.startsWith('//'))) {
    return { url: value, fileName: value.split('?')[0].split('/').pop() || field.label, mode: 'open' }
  }
  return null
}

/**
 * Delivers a field's file: saves a download through a temporary link, or opens a new window.
 *
 * @param file - The file.
 */
export function deliverRecordFieldFile(file: RecordFieldFile): void {
  if (file.mode === 'open') {
    window.open(file.url, '_blank', 'noopener,noreferrer')
    return
  }
  const link = document.createElement('a')
  link.href = file.url
  link.download = file.fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
