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
 * @file query-columns — the columns a record query grid can show: the table's own fields and
 * the fields of its readable exposed joins (named `joinTable.field`, labelled
 * "Join Label: Field Label", hidden by default), as in the Material dashboard.
 */

import type { QFieldMetaData, QTableMetaData } from '@/types'

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
}

/**
 * Lists every column for a table, base fields first (metadata order), then join fields.
 * Hidden fields and heavy non-BLOB fields are excluded.
 *
 * @param table - Table metadata.
 * @returns The columns in default order.
 */
export function getQueryColumns(table: QTableMetaData): QueryColumn[] {
  const usable = (f: QFieldMetaData) => !f.isHidden && (!f.isHeavy || f.type === 'BLOB')
  const columns: QueryColumn[] = fieldsInSectionOrder(table)
    .filter(usable)
    .map((field) => ({ name: field.name, label: field.label, field, isJoin: false, group: `${table.label} Fields` }))
  for (const join of table.exposedJoins ?? []) {
    const joinTable = join.joinTable
    if (!joinTable?.fields || joinTable.readPermission === false) continue
    const joinLabel = join.label || joinTable.label
    for (const field of fieldsInSectionOrder(joinTable).filter((f) => usable(f) && f.type !== 'BLOB')) {
      columns.push({ name: `${joinTable.name}.${field.name}`, label: `${joinLabel}: ${field.label}`, field, isJoin: true, group: `${joinTable.label} Fields` })
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
