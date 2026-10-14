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

/** @file Reads the optimistic version from the loaded record, never from a realtime hint. */
import type { QRecord, QTableMetaData } from '@/types'
/** Uses explicit metadata when exposed, otherwise the conventional modify-date field.
 * @param table - Table metadata (empty version field opts out).
 * @param record - Loaded record.
 * @returns Wire version or undefined when unavailable.
 */
export function recordVersion(table: QTableMetaData, record?: QRecord): string | undefined {
  if (!record || table.recordVersionField === '') return undefined
  const dateField = Object.values(table.fields).find((field) =>
    field.behaviors?.includes('MODIFY_DATE')
  )?.name
  const value = record.values[table.recordVersionField ?? dateField ?? 'modifyDate']
  return ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : undefined
}
