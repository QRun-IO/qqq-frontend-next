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
 * @file Saved bulk load profile helpers — the unsaved changes between a saved profile and
 * the mapping on screen, described as the Material dashboard's `SavedBulkLoadProfileUtils`
 * describes them.
 */

import type { SavedBulkLoadProfileRecord } from '@/lib/api/processes'

import type { BulkLoadField, BulkLoadMapping, FileDescription } from './bulk-load-models'

type FieldMap = Map<string, BulkLoadField>

/**
 * The mapped fields by qualified name (with the WIDE repetition suffix).
 * @param mapping - A mapping.
 * @returns Fields by name.
 */
function fieldMap(mapping: BulkLoadMapping): FieldMap {
  return new Map(mapping.activeFields().map((field) => [field.getQualifiedNameWithWideSuffix(), field]))
}

/**
 * Join at most `n` values, summarizing the rest.
 * @param values - Values.
 * @param n - How many to name.
 * @returns `a, b and 3 others`.
 */
function joinUpToN(values: string[], n: number): string {
  if (values.length <= n) return values.join(', ')
  const others = values.length - (n - 1)
  return `${values.slice(0, n - 1).join(', ')} and ${others} other${others === 1 ? '' : 's'}`
}

/**
 * Fields mapped in `compare` but not in `base`, as one line.
 * @param base - Fields to compare against.
 * @param compare - Fields that may be new.
 * @param prefix - `Added` or `Removed`.
 * @returns The line, or none.
 */
function diffFieldSets(base: FieldMap, compare: FieldMap, prefix: string): string[] {
  const labels = [...compare.entries()].filter(([name]) => !base.has(name)).map(([, field]) => field.getQualifiedLabel())
  if (labels.length === 0) return []
  const s = labels.length === 1 ? '' : 's'
  return [`${prefix} mapping${s} for ${labels.length} field${s}: ${labels.join(', ')}`]
}

/**
 * Changes to fields mapped in both: value source, column, default value and value mapping flag.
 * @param file - The uploaded file.
 * @param hasHeaderRow - Whether the file has a header row now (columns compare by header name then).
 * @param base - Saved fields.
 * @param active - Fields on screen.
 * @returns One line per change.
 */
function diffFieldContents(file: FileDescription, hasHeaderRow: boolean, base: FieldMap, active: FieldMap): string[] {
  const columnNames = file.columnNames(hasHeaderRow)
  const column = (index: number | null) => (index === null || index === undefined ? undefined : columnNames[index])
  const lines: string[] = []
  for (const [name, compare] of active) {
    const saved = base.get(name)
    if (!saved) continue
    const label = compare.getQualifiedLabel()
    if (saved.valueType !== compare.valueType) {
      if (compare.valueType === 'column') {
        const name = column(compare.columnIndex)
        lines.push(`Changed ${label} from using a default value (${String(saved.defaultValue ?? '')}) to using a file column${name ? ` (${name})` : ''}`)
      } else {
        const value = compare.defaultValue
        lines.push(`Changed ${label} from using a file column (${column(saved.columnIndex) ?? '--'}) to using a default value${value === null || value === undefined || value === '' ? '' : ` (${String(value)})`}`)
      }
    } else if (compare.valueType === 'defaultValue') {
      if (String(saved.defaultValue ?? '') !== String(compare.defaultValue ?? '')) {
        const value = compare.defaultValue
        lines.push(`Changed ${label} default value from (${String(saved.defaultValue ?? '')}) to${value === null || value === undefined || value === '' ? '' : ` (${String(value)})`}`)
      }
    } else {
      const moved = hasHeaderRow ? (saved.headerName ?? null) !== (compare.headerName ?? null) : saved.columnIndex !== compare.columnIndex
      if (moved) {
        const from = column(saved.columnIndex)
        const to = column(compare.columnIndex)
        lines.push(`Changed ${label} file column from ${from ? `(${from})` : '--'} to ${to ? `(${to})` : '--'}`)
      }
      if (Boolean(saved.doValueMapping) !== Boolean(compare.doValueMapping)) {
        lines.push(`Changed ${label} to ${compare.doValueMapping ? '' : 'not '}map values`)
      }
    }
  }
  return lines
}

/**
 * Added, removed and changed mapped values of one field.
 * @param field - The field.
 * @param base - Saved value mappings.
 * @param active - Value mappings on screen.
 * @returns The line, or `null` without changes.
 */
function diffValueMappings(field: BulkLoadField, base: Record<string, unknown>, active: Record<string, unknown>): string | null {
  const has = (mappings: Record<string, unknown>, value: string) => mappings[value] !== undefined && mappings[value] !== null && mappings[value] !== ''
  const added = Object.keys(active).filter((value) => has(active, value) && !has(base, value))
  const removed = Object.keys(base).filter((value) => has(base, value) && !has(active, value))
  const changed = Object.keys(active).filter((value) => has(active, value) && has(base, value) && String(active[value]) !== String(base[value]))
  if (added.length + removed.length + changed.length === 0) return null
  const parts: string[] = []
  if (added.length) parts.push(`Added value${added.length === 1 ? '' : 's'} for: ${joinUpToN(added, 5)}`)
  if (removed.length) parts.push(`Removed value${removed.length === 1 ? '' : 's'} for: ${joinUpToN(removed, 5)}`)
  if (changed.length) parts.push(`Changed value${changed.length === 1 ? '' : 's'} for: ${joinUpToN(changed, 5)}`)
  return `Updated value mapping for ${field.getQualifiedLabel()}: ${parts.join('; ')}`
}

/**
 * Describe how the mapping on screen differs from a saved one (the "Unsaved Changes" list).
 * @param file - The uploaded file (for column names).
 * @param base - The saved profile's mapping.
 * @param active - The mapping on screen.
 * @returns One line per difference, in screen order; empty when they match.
 */
export function diffBulkLoadMappings(file: FileDescription, base: BulkLoadMapping, active: BulkLoadMapping): string[] {
  const diffs: string[] = []
  if (Boolean(base.hasHeaderRow) !== Boolean(active.hasHeaderRow)) {
    diffs.push(`Changed does the file have a header row? from ${base.hasHeaderRow ? 'Yes' : 'No'} to ${active.hasHeaderRow ? 'Yes' : 'No'}`)
  }
  if ((base.layout ?? null) !== (active.layout ?? null)) {
    const format = (layout: string | null) => (layout ? `${layout.substring(0, 1)}${layout.substring(1).toLowerCase()}` : '--')
    diffs.push(`Changed layout from ${format(base.layout)} to ${format(active.layout)}`)
  }
  if (active.isBulkEdit && (base.keyFields ?? null) !== (active.keyFields ?? null)) {
    diffs.push(`Changed key fields from ${base.keyFields ?? '--'} to ${active.keyFields ?? '--'}`)
  }
  const baseFields = fieldMap(base)
  const activeFields = fieldMap(active)
  diffs.push(...diffFieldSets(baseFields, activeFields, 'Added'))
  diffs.push(...diffFieldSets(activeFields, baseFields, 'Removed'))
  diffs.push(...diffFieldContents(file, active.hasHeaderRow, baseFields, activeFields))
  for (const field of activeFields.values()) {
    const name = field.getProfileFieldName()
    const line = diffValueMappings(field, base.valueMappings[name] ?? {}, active.valueMappings[name] ?? {})
    if (line) diffs.push(line)
  }
  return diffs
}

/**
 * Split saved profiles into the user's own and those other users shared with them.
 * @param profiles - Profiles the backend returned.
 * @param userId - The session user's id.
 * @returns `yours` and `shared`, each in the backend's order.
 */
export function splitProfilesByOwner(profiles: SavedBulkLoadProfileRecord[], userId: string | undefined): { yours: SavedBulkLoadProfileRecord[]; shared: SavedBulkLoadProfileRecord[] } {
  const yours: SavedBulkLoadProfileRecord[] = []
  const shared: SavedBulkLoadProfileRecord[] = []
  for (const profile of profiles) (isProfileOwner(profile, userId) ? yours : shared).push(profile)
  return { yours, shared }
}

/**
 * Whether the session user owns a saved profile (only the owner may save, rename or delete it).
 * @param profile - The profile.
 * @param userId - The session user's id.
 * @returns `true` for the owner.
 */
export function isProfileOwner(profile: SavedBulkLoadProfileRecord, userId: string | undefined): boolean {
  return Boolean(userId) && profile.userId === userId
}
