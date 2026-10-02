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

/** @file Query-view storage keys and cleanup, independent of view parsing and API utilities. */

/** Root of the per-table key for the last view. */
export const VIEW_STORAGE_KEY_ROOT = 'qqq.recordQueryView'
/** Root of the per-table key for the last saved view's id. */
export const CURRENT_SAVED_VIEW_ID_STORAGE_KEY_ROOT = 'qqq.currentSavedViewId'

/** Forgets every table's remembered view and saved-view selection, preserving machine preferences. */
export function clearAllStoredQueryState(): void {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index)
      if (key?.startsWith(`${VIEW_STORAGE_KEY_ROOT}.`) || key?.startsWith(`${CURRENT_SAVED_VIEW_ID_STORAGE_KEY_ROOT}.`)) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // persistence is best-effort
  }
}
