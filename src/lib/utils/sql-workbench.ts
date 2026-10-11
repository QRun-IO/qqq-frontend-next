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
 * @file SQL Workbench helpers — value formatting, :parameter detection, dialect mapping,
 * autocomplete sources, chart data and plan costs. Pure functions; no React, no CodeMirror.
 */

import type {
  SqlBinaryValue,
  SqlColumn,
  SqlNotebookParameter,
  SqlPlanNode,
  SqlSchema,
  SqlValue,
  SqlWorkbenchDialect,
} from '@/types'

/** CodeMirror `@codemirror/lang-sql` dialect export names. */
export type EditorDialectName = 'PostgreSQL' | 'MySQL' | 'SQLite' | 'StandardSQL'

/** `sql-formatter` language names. */
export type FormatterLanguage = 'postgresql' | 'mysql' | 'sqlite' | 'sql'

/** One completion entry for QQQ names that insert SQL names. */
export interface QqqNameCompletion {
  label: string
  apply: string
  detail: string
  type: 'class' | 'property'
}

/**
 * Whether a value is a binary placeholder from the backend.
 *
 * @param value - A result value.
 * @returns True for `{ $binary: true, ... }`.
 */
export function isBinaryValue(value: unknown): value is SqlBinaryValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as SqlBinaryValue).$binary === true
  )
}

/**
 * Text for one result value in the grid, the clipboard and charts' labels.
 *
 * @param value - The value.
 * @returns `NULL` for null, `<binary N bytes>` for binary, JSON for arrays, else the value as text.
 */
export function formatSqlValue(value: SqlValue | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  if (isBinaryValue(value)) return `<binary ${value.length} bytes>`
  if (Array.isArray(value)) return JSON.stringify(value)
  return String(value)
}

/**
 * Pretty-prints a JSON column value, or returns it unchanged when it is not valid JSON.
 *
 * @param value - The JSON text.
 * @returns Indented JSON.
 */
export function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

/**
 * Tab-separated text of a result, for copying into a spreadsheet.
 *
 * @param columns - The columns (header row).
 * @param rows - The rows.
 * @returns Header and rows, tab-separated; NULL as empty.
 */
export function rowsToTsv(columns: SqlColumn[], rows: SqlValue[][]): string {
  const cell = (value: SqlValue) =>
    value === null ? '' : formatSqlValue(value).replace(/[\t\r\n]+/g, ' ')
  return [columns.map((c) => c.label).join('\t'), ...rows.map((r) => r.map(cell).join('\t'))].join(
    '\n'
  )
}

/**
 * Names of the `:name` parameters in SQL, in order of first appearance. Skips string literals,
 * quoted identifiers, comments, dollar quotes and Postgres `::` casts — the same rules as the
 * backend's scanner, so the UI asks for exactly the values the server will require.
 *
 * @param sql - The SQL text.
 * @returns Unique parameter names.
 */
export function extractSqlParameters(sql: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  let i = 0
  const n = sql.length
  const isStart = (c: string) => /[A-Za-z_]/.test(c)
  const isPart = (c: string) => /[A-Za-z0-9_]/.test(c)

  while (i < n) {
    const c = sql[i]
    const next = sql[i + 1]
    if (c === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') i++
    } else if (c === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2)
      i = end < 0 ? n : end + 2
    } else if (c === "'" || c === '"' || c === '`') {
      i++
      while (i < n) {
        if (sql[i] === c && sql[i + 1] === c) i += 2
        else if (sql[i] === c) break
        else i++
      }
      i++
    } else if (c === '$' && /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i))) {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))![0]
      const end = sql.indexOf(tag, i + tag.length)
      i = end < 0 ? n : end + tag.length
    } else if (c === ':' && next === ':') {
      i += 2
    } else if (c === ':' && next !== undefined && isStart(next) && sql[i - 1] !== ':') {
      let j = i + 1
      while (j < n && isPart(sql[j])) j++
      const name = sql.slice(i + 1, j)
      if (!seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
      i = j
    } else {
      i++
    }
  }
  return names
}

/**
 * Converts a parameter's text input to the JSON value the backend binds.
 *
 * @param raw - What the user typed.
 * @param type - The notebook parameter's declared type, if any.
 * @returns `null` for empty input; a number for numeric types (or numeric-looking untyped input
 * is still sent as text, so `'007'` stays a string); a boolean for BOOLEAN; else the text.
 */
export function coerceParameterValue(
  raw: string | null | undefined,
  type?: SqlNotebookParameter['type']
): string | number | boolean | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (type === 'INTEGER' || type === 'DECIMAL') {
    const number = Number(raw)
    return Number.isFinite(number) ? number : raw
  }
  if (type === 'BOOLEAN') {
    return /^(true|1|yes|y)$/i.test(raw.trim())
  }
  return raw
}

/**
 * The CodeMirror dialect for a backend dialect.
 *
 * @param dialect - The backend's dialect name.
 * @returns The `@codemirror/lang-sql` dialect export name.
 */
export function editorDialectName(dialect: SqlWorkbenchDialect | undefined): EditorDialectName {
  switch (dialect) {
    case 'postgresql':
      return 'PostgreSQL'
    case 'mysql':
      return 'MySQL'
    case 'sqlite':
      return 'SQLite'
    default:
      return 'StandardSQL'
  }
}

/**
 * The `sql-formatter` language for a backend dialect.
 *
 * @param dialect - The backend's dialect name.
 * @returns The formatter language.
 */
export function formatterLanguage(dialect: SqlWorkbenchDialect | undefined): FormatterLanguage {
  switch (dialect) {
    case 'postgresql':
      return 'postgresql'
    case 'mysql':
      return 'mysql'
    case 'sqlite':
      return 'sqlite'
    default:
      return 'sql'
  }
}

/**
 * The `schema` option for `@codemirror/lang-sql`: every table (bare and schema-qualified) mapped
 * to its column names.
 *
 * @param schema - The backend schema.
 * @returns Table name to column names.
 */
export function editorSchema(schema: SqlSchema | undefined): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const s of schema?.schemas ?? []) {
    for (const table of s.tables) {
      const columns = table.columns.map((c) => c.name)
      result[`${s.name}.${table.name}`] = columns
      if (!(table.name in result)) result[table.name] = columns
    }
  }
  return result
}

/**
 * Completions that let users type QQQ table and field names and insert the SQL names.
 *
 * @param schema - The backend schema (with its QQQ tables).
 * @returns One entry per QQQ table, and per field as `table.field`.
 */
export function qqqNameCompletions(schema: SqlSchema | undefined): QqqNameCompletion[] {
  const completions: QqqNameCompletion[] = []
  for (const table of schema?.qqqTables ?? []) {
    completions.push({
      label: table.name,
      apply: table.sqlName,
      detail: `QQQ table → ${table.sqlName}`,
      type: 'class',
    })
    for (const field of table.fields) {
      completions.push({
        label: `${table.name}.${field.name}`,
        apply: `${table.sqlName}.${field.sqlName}`,
        detail: `QQQ field → ${field.sqlName}`,
        type: 'property',
      })
    }
  }
  return completions
}

/**
 * Indexes of the columns a chart can plot as values (numbers, or every row numeric text).
 *
 * @param columns - Result columns.
 * @param rows - Result rows.
 * @returns Column indexes.
 */
export function numericColumnIndexes(columns: SqlColumn[], rows: SqlValue[][]): number[] {
  return columns
    .map((column, index) => ({ column, index }))
    .filter(
      ({ column, index }) =>
        column.kind === 'number' ||
        (rows.length > 0 &&
          rows.every(
            (r) =>
              r[index] === null ||
              (typeof r[index] === 'string' && r[index] !== '' && Number.isFinite(Number(r[index])))
          ))
    )
    .map(({ index }) => index)
}

/**
 * Rows for a Recharts chart: the x column's text as `x`, and each y column as a number keyed by its label.
 *
 * @param columns - Result columns.
 * @param rows - Result rows.
 * @param xIndex - Category column.
 * @param yIndexes - Value columns.
 * @returns Chart rows (nulls and non-numbers become 0).
 */
export function toChartRows(
  columns: SqlColumn[],
  rows: SqlValue[][],
  xIndex: number,
  yIndexes: number[]
): Record<string, string | number>[] {
  return rows.map((row) => {
    const point: Record<string, string | number> = { x: formatSqlValue(row[xIndex]) }
    for (const y of yIndexes) {
      const number = Number(row[y])
      point[columns[y].label] = row[y] === null || !Number.isFinite(number) ? 0 : number
    }
    return point
  })
}

/**
 * The largest total cost (or actual time) in a plan, to scale per-node cost bars.
 *
 * @param node - Plan root.
 * @param useActual - Use actual time instead of cost.
 * @returns The maximum, or 0.
 */
export function planMax(node: SqlPlanNode, useActual: boolean): number {
  const own = (useActual ? node.actualTimeMs : node.totalCost) ?? 0
  return Math.max(own, ...node.children.map((c) => planMax(c, useActual)))
}

/**
 * A new, stable cell key.
 *
 * @returns A UUID.
 */
export function newCellKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return `cell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * A human-readable duration.
 *
 * @param ms - Milliseconds.
 * @returns e.g. `38 ms`, `1.2 s`.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return ''
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}
