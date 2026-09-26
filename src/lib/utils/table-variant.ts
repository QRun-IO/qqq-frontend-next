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
 * @file The table variant a user chose on the query screen, remembered per table.
 */

import type { TableVariant } from '@/lib/api/tables'

/** localStorage key root for a table's selected variant (the same key Material uses). */
export const TABLE_VARIANT_STORAGE_KEY_ROOT = 'qqq.tableVariant'

/**
 * Reads a table's stored variant.
 *
 * @param tableName - Backend table name.
 * @returns The stored variant, or null.
 */
export function readStoredTableVariant(tableName: string): TableVariant | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${TABLE_VARIANT_STORAGE_KEY_ROOT}.${tableName}`)
    const parsed = raw ? (JSON.parse(raw) as TableVariant) : null
    return parsed && parsed.id !== undefined && typeof parsed.type === 'string' ? parsed : null
  } catch {
    return null
  }
}
