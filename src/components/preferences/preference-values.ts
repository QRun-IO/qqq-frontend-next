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

/** @file Mapping metadata into flat form slots and partial preference patches. */
import type { QFieldMetaData } from '@/types/metadata'
import type { PreferenceSection, PreferenceSectionPatch } from '@/types/preferences'
import { fromLocalDateTimeInput, toLocalDateTimeInput } from '@/lib/utils/datetime-utils'

/** One form slot, independent of punctuation in provider row keys or field names. */
export interface PreferenceSlot {
  name: string
  field: QFieldMetaData
  value: unknown
  list?: string
  row?: string
  readOnly: boolean
  reason?: string | null
}

/** Flattens section fields and list cells into stable React Hook Form names.
 * @param section - Section snapshot.
 * @returns Editable and read-only slots.
 */
export function preferenceSlots(section: PreferenceSection): PreferenceSlot[] {
  const slots: PreferenceSlot[] = section.fields.map((field, i) => ({
    name: `scalar${i}`,
    field,
    value: Object.prototype.hasOwnProperty.call(section.values, field.name)
      ? section.values[field.name]
      : (field.defaultValue ?? null),
    readOnly: field.isEditable === false,
  }))
  section.lists.forEach((list, li) =>
    list.rows.forEach((row, ri) =>
      list.fields.forEach((field, fi) => {
        slots.push({
          name: `list${li}row${ri}field${fi}`,
          field,
          list: list.name,
          row: row.key,
          value: Object.prototype.hasOwnProperty.call(row.values, field.name)
            ? row.values[field.name]
            : (field.defaultValue ?? null),
          readOnly: field.isEditable === false || Boolean(row.readOnlyFields?.includes(field.name)),
          reason: row.readOnlyReason,
        })
      })
    )
  )
  return slots
}

/** Converts wire values to editor values, retaining booleans for the toggle.
 * @param slots - Flattened metadata.
 * @returns Initial form values.
 */
export function preferenceDefaults(slots: PreferenceSlot[]): Record<string, unknown> {
  return Object.fromEntries(
    slots.map(({ name, field, value }) => [
      name,
      field.type === 'DATE_TIME'
        ? toLocalDateTimeInput(value)
        : field.type === 'BOOLEAN'
          ? value
          : value == null
            ? ''
            : String(value),
    ])
  )
}

/** Coerces an edited control value back to its wire type.
 * @param slot - Metadata and original value.
 * @param value - Editor value.
 * @returns Typed JSON value.
 */
export function wireValue(slot: PreferenceSlot, value: unknown): unknown {
  if (value === '' || value == null) return null
  if (slot.field.type === 'INTEGER' || slot.field.type === 'DECIMAL') return Number(value)
  if (slot.field.type === 'DATE_TIME') return fromLocalDateTimeInput(String(value), slot.value)
  if (slot.field.type === 'TIME' && /^\d{2}:\d{2}$/.test(String(value))) return `${value}:00`
  return value
}

/** Builds a minimal patch; hidden/read-only slots are never submitted.
 * @param slots - Snapshot used to start editing.
 * @param values - Current control values.
 * @returns Only changed fields, grouped by provider row key.
 */
export function preferencePatch(
  slots: PreferenceSlot[],
  values: Record<string, unknown>
): PreferenceSectionPatch {
  const patch: PreferenceSectionPatch = {}
  const defaults = preferenceDefaults(slots)
  for (const slot of slots) {
    if (slot.readOnly || slot.field.isHidden) continue
    const value = wireValue(slot, values[slot.name])
    if (Object.is(value, wireValue(slot, defaults[slot.name]))) continue
    if (slot.list !== undefined && slot.row !== undefined) {
      patch.lists ??= {}
      const rows = (patch.lists[slot.list] ??= [])
      let row = rows.find((row) => row.key === slot.row)
      if (!row) {
        row = { key: slot.row, values: {} }
        rows.push(row)
      }
      row.values[slot.field.name] = value
    } else {
      patch.values ??= {}
      patch.values[slot.field.name] = value
    }
  }
  return patch
}
