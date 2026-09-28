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
 * @file query-columns — the columns a record query grid can show: the table's own fields, its
 * query-selectable virtual fields, and the fields of its readable exposed joins (named
 * `joinTable.field`, labelled "Join Label: Field Label", hidden by default), as in the Material
 * dashboard, with Next UI's readable default widths and column pinning.
 */

import type { QFieldMetaData, QTableMetaData, QVirtualFieldMetaData } from '@/types'
import { sizeWidth } from './adornment-utils'

/** One column the grid, column chooser and export can use. */
export interface QueryColumn {
  /** Column name: `field` or `joinTable.field` (also the key in record values). */
  name: string
  /** User-facing header. */
  label: string
  /** Field metadata. */
  field: QFieldMetaData
  /** Whether the column comes from an exposed join. */
  isJoin: boolean
  /** Column chooser group heading ("{Table} Fields"). */
  group: string
  /** Name of the table the field belongs to (the query table, or the join table). */
  tableName: string
  /** Whether the column is a virtual (computed) field. */
  isVirtual: boolean
  /** Whether the column can be sorted and filtered (false for virtual fields that are not query criteria). */
  isQueryCriteria: boolean
  /** Default width for the column, in pixels. */
  defaultWidth: number
}

/**
 * Remove joins whose target or an intermediate path table is not readable. The query page
 * passes this metadata to its grid, column chooser, filters and saved-view controls.
 *
 * @param table - Query table metadata.
 * @param allTables - Visible table registry with read permissions.
 * @returns The original table when every join is readable, otherwise a filtered copy.
 */
export function withReadableExposedJoins(table: QTableMetaData, allTables: Record<string, QTableMetaData>): QTableMetaData {
  const joins = (table.exposedJoins ?? []).filter(({ joinTable, joinPath = [] }) => {
    if (!joinTable?.name || joinTable.readPermission === false) return false
    const names = [joinTable.name, ...joinPath.flatMap(({ leftTable, rightTable }) => [leftTable, rightTable])]
    return names.every((name) => name === table.name || allTables[name]?.readPermission === true)
  })
  return joins.length === table.exposedJoins?.length ? table : { ...table, exposedJoins: joins }
}

/** The side a column is pinned to. */
export type ColumnPin = 'left' | 'right'

/** Pinned columns by name. */
export type ColumnPins = Record<string, ColumnPin>

/**
 * Preserve the original Next UI column width unless metadata explicitly sets a SIZE
 * adornment. Narrow Material defaults leave too little room for this grid's header controls.
 *
 * @param field - The field.
 * @returns The width in pixels.
 */
export function defaultColumnWidth(field: QFieldMetaData): number {
  return sizeWidth(field) ?? 150
}

/**
 * The query-selectable virtual fields of a table, in metadata order.
 *
 * @param table - Table metadata (a join table may have none).
 * @returns The virtual fields that are query columns.
 */
export function selectableVirtualFields(table: Pick<QTableMetaData, 'virtualFields'>): QVirtualFieldMetaData[] {
  return Object.values(table.virtualFields ?? {}).filter((field) => field && field.isQuerySelectable === true)
}

/**
 * Lists every column for a table: the primary key, then the other base fields in section order,
 * then its query-selectable virtual fields; then each readable join's fields and virtual fields.
 * Hidden fields and heavy non-BLOB fields are excluded.
 *
 * @param table - Table metadata.
 * @returns The columns in default order.
 */
export function getQueryColumns(table: QTableMetaData): QueryColumn[] {
  const usable = (f: QFieldMetaData) => !f.isHidden && (!f.isHeavy || f.type === 'BLOB')
  const group = `${table.label} Fields`
  const base = (field: QFieldMetaData): QueryColumn => ({
    name: field.name, label: field.label, field, isJoin: false, group, tableName: table.name, isVirtual: false, isQueryCriteria: true,
    defaultWidth: defaultColumnWidth(field),
  })
  const fields = fieldsInSectionOrder(table).filter(usable)
  // Material puts the primary key first (and pins it), whatever the sections say
  const primaryKey = fields.findIndex((field) => field.name === table.primaryKeyField)
  if (primaryKey > 0) fields.unshift(...fields.splice(primaryKey, 1))
  const columns: QueryColumn[] = fields.map(base)
  for (const field of selectableVirtualFields(table).filter((f) => !f.isHidden && !table.fields?.[f.name])) {
    columns.push({ ...base(field), isVirtual: true, isQueryCriteria: field.isQueryCriteria === true })
  }
  for (const join of table.exposedJoins ?? []) {
    const joinTable = join.joinTable
    if (!joinTable?.fields || joinTable.readPermission === false) continue
    const joinLabel = join.label || joinTable.label
    const joinGroup = `${joinTable.label} Fields`
    const joinColumn = (field: QFieldMetaData, isVirtual: boolean, isQueryCriteria: boolean): QueryColumn => ({
      name: `${joinTable.name}.${field.name}`, label: `${joinLabel}: ${field.label}`, field, isJoin: true, group: joinGroup, tableName: joinTable.name,
      isVirtual, isQueryCriteria, defaultWidth: defaultColumnWidth(field),
    })
    for (const field of fieldsInSectionOrder(joinTable).filter((f) => usable(f) && f.type !== 'BLOB')) columns.push(joinColumn(field, false, true))
    for (const field of selectableVirtualFields(joinTable).filter((f) => !f.isHidden && !joinTable.fields[f.name])) {
      columns.push(joinColumn(field, true, field.isQueryCriteria === true))
    }
  }
  return columns
}

/**
 * A table's fields in Material's default grid order: the fields of each section in section
 * order, then any field no section lists, in metadata order.
 *
 * @param table - Table metadata (sections may be absent, e.g. for join tables).
 * @returns The fields, each once.
 */
export function fieldsInSectionOrder(table: Pick<QTableMetaData, 'fields'> & { sections?: QTableMetaData['sections'] }): QFieldMetaData[] {
  const ordered: QFieldMetaData[] = []
  const seen = new Set<string>()
  for (const section of table.sections ?? []) {
    for (const name of section.fieldNames ?? []) {
      const field = table.fields[name]
      if (field && !seen.has(name)) {
        seen.add(name)
        ordered.push(field)
      }
    }
  }
  for (const field of Object.values(table.fields)) {
    if (!seen.has(field.name)) ordered.push(field)
  }
  return ordered
}

/**
 * Orders columns by a saved column order; columns missing from the order keep their default
 * position after the ordered ones.
 *
 * @param columns - Columns in default order.
 * @param columnOrder - Saved order of column names.
 * @returns Ordered columns.
 */
export function orderColumns<T extends { name: string }>(columns: T[], columnOrder: string[]): T[] {
  if (columnOrder.length === 0) return columns
  const index = new Map(columnOrder.map((name, i) => [name, i]))
  return columns
    .map((column, i) => ({ column, rank: index.get(column.name) ?? columnOrder.length + i }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ column }) => column)
}

/**
 * The pins in effect: explicit pins, or the table's primary key pinned left by default.
 *
 * @param orderedNames - Column names in display order.
 * @param pins - Explicit pins, or null for the default.
 * @param defaultPinnedName - The primary key, when known.
 * @returns Pinned columns by name.
 */
export function effectivePins(orderedNames: string[], pins: ColumnPins | null, defaultPinnedName = orderedNames[0]): ColumnPins {
  if (pins) return pins
  const name = orderedNames.includes(defaultPinnedName) ? defaultPinnedName : orderedNames[0]
  return name ? { [name]: 'left' } : {}
}

/**
 * Moves pinned columns to their side, as Material's grid shows them: left-pinned columns first,
 * then the others, then right-pinned columns, each group keeping its order.
 *
 * @param columns - Columns in display order.
 * @param pins - Pinned columns by name.
 * @returns The arranged columns.
 */
export function arrangePinnedColumns<T extends { name: string }>(columns: T[], pins: ColumnPins): T[] {
  return [
    ...columns.filter((c) => pins[c.name] === 'left'),
    ...columns.filter((c) => !pins[c.name]),
    ...columns.filter((c) => pins[c.name] === 'right'),
  ]
}

/**
 * Pins or unpins one column (Material's column menu "Pin to left", "Pin to right", "Unpin"),
 * starting from the pins in effect.
 *
 * @param orderedNames - Column names in display order.
 * @param pins - Explicit pins, or null for the default.
 * @param name - The column.
 * @param side - The side to pin to, or null to unpin.
 * @param defaultPinnedName - The primary-key column, when known.
 * @returns The new explicit pins.
 */
export function pinColumn(orderedNames: string[], pins: ColumnPins | null, name: string, side: ColumnPin | null, defaultPinnedName = orderedNames[0]): ColumnPins {
  const next = { ...effectivePins(orderedNames, pins, defaultPinnedName) }
  if (side) next[name] = side
  else delete next[name]
  return next
}

/**
 * Whether a table declares a capability. Tables without a capability list are treated as
 * fully capable (older backends).
 *
 * @param table - Table metadata.
 * @param capability - Capability name.
 * @returns True when enabled.
 */
export function hasCapability(table: QTableMetaData | undefined, capability: string): boolean {
  if (!table) return false
  if (!Array.isArray(table.capabilities)) return true
  return (table.capabilities as string[]).includes(capability)
}
