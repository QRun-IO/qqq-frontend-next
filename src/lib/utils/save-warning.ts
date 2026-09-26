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
 * @file save-warning — the warning a save or delete returns, carried to the screen shown next,
 * as the Material dashboard does (EntityForm and RecordView pass it in the navigation state):
 *
 * - a saved record's first warning (`record.warnings[0]`), or a save or delete error whose message
 *   starts with "warning", is a success with a warning, not a failure;
 * - the record view shows the warning once, after the redirect that follows the save.
 *
 * The warning is kept in session storage for the record's next view only, so it survives the
 * client-side navigation (and a reload before the view renders) but is shown only once.
 */

import type { QRecord } from '@/types'

/** Session storage key prefix; the table name and primary key complete it. */
const STORAGE_PREFIX = 'qqq.recordView.saveWarning.'

/**
 * Whether an error message is a warning (Material: the message starts with "warning").
 *
 * @param message - An error message.
 * @returns `true` for a warning.
 */
export function isWarningMessage(message: string | undefined | null): boolean {
  return typeof message === 'string' && message.trim().toLowerCase().startsWith('warning')
}

/**
 * The warning to show after a save: the saved record's first warning.
 *
 * @param record - The record the save returned.
 * @returns The warning text, or `undefined`.
 */
export function firstRecordWarning(record: QRecord | undefined): string | undefined {
  const text = record?.warnings?.[0]
  return typeof text === 'string' && text.trim() !== '' ? text : undefined
}

/**
 * Storage key for a record.
 *
 * @param tableName - Backend table name.
 * @param primaryKey - Record primary key.
 * @returns The key.
 */
function storageKey(tableName: string, primaryKey: string | number): string {
  return `${STORAGE_PREFIX}${tableName}.${String(primaryKey)}`
}

/**
 * Remembers a warning for the record's next view.
 *
 * @param tableName - Backend table name.
 * @param primaryKey - Record primary key.
 * @param warning - The warning text.
 */
export function rememberSaveWarning(tableName: string, primaryKey: string | number, warning: string): void {
  try {
    window.sessionStorage.setItem(storageKey(tableName, primaryKey), warning)
  } catch {
    // storage unavailable: the success toast still reports the save
  }
}

/**
 * Takes (reads and forgets) the warning remembered for a record.
 *
 * @param tableName - Backend table name.
 * @param primaryKey - Record primary key.
 * @returns The warning, or `null`.
 */
export function takeSaveWarning(tableName: string, primaryKey: string | number): string | null {
  try {
    const key = storageKey(tableName, primaryKey)
    const warning = window.sessionStorage.getItem(key)
    if (warning !== null) window.sessionStorage.removeItem(key)
    return warning
  } catch {
    return null
  }
}
