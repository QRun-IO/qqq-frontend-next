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
 * @file compact-columns — which columns an embedded table (a child-record list in a record
 * view panel) shows in the width it has.
 *
 * Every column gets a priority from its field metadata and the rows on screen, and an
 * estimated width; the highest-priority columns that fit are shown, in their metadata order:
 *
 * 1. the record's name: the first short text column, preferring the table's T1 section;
 * 2. status-like columns (a CHIP adornment or a possible-value source) and booleans;
 * 3. one date: the date column holding the latest value (so "modified" beats "created");
 * 4. other short text, then numbers, then other dates;
 * 5. the primary key only when nothing else names the row (otherwise it is left out, like the
 *    parent's key: the row already links to its record);
 * 6. long text last (TEXT / HTML / heavy fields, or values that run long in the rows shown).
 *
 * An application that lists `onlyIncludeFieldNames` on the widget has chosen its columns:
 * their order is their priority. Hidden columns stay one click away (the widget's
 * "more columns" toggle and View All).
 */

import { DATE_COLUMN_WIDTH, DATE_TIME_COLUMN_WIDTH } from './datetime-utils'

/** The field metadata the column choice reads. */
export interface CompactColumnField {
  name: string
  type?: string
  maxLength?: number
  isHeavy?: boolean
  possibleValueSourceName?: string
  adornments?: Array<{ type?: string }>
}

/** A column candidate: its value key, heading and field. */
export interface CompactColumn {
  name: string
  label: string
  field: CompactColumnField
}

/** What kind of value a column holds, for priority and width. */
export type CompactColumnKind = 'key' | 'label' | 'status' | 'boolean' | 'date' | 'dateTime' | 'number' | 'text' | 'longText'

/** Context for the choice. */
export interface CompactColumnContext {
  /** The table's primary key field. */
  primaryKeyField?: string
  /** Field names in the table's T1 sections (the record's identity). */
  t1FieldNames?: string[]
  /** Columns the application chose (`onlyIncludeFieldNames`), most important first. */
  explicitOrder?: string[]
  /** The text of each column's values in the rows shown. */
  samples?: (columnName: string) => string[]
}

/** The outcome: the columns to show (metadata order) and the ones left out. */
export interface CompactColumnChoice<T extends CompactColumn> {
  shown: T[]
  hidden: T[]
}

/** Average and longest sample length above which a text column counts as long text. */
const LONG_TEXT_AVERAGE = 40
const LONG_TEXT_MAX = 80
/** A declared maximum length that marks long text when there are no rows to look at. */
const LONG_TEXT_MAX_LENGTH = 255
/** Approximate width of one character of 14px table text, and a cell's horizontal padding. */
const CHAR_WIDTH = 7
const CELL_PADDING = 16

/**
 * Classifies a column.
 *
 * @param column - The column.
 * @param context - Primary key and sample rows.
 * @returns The kind (`label` is assigned later, by position).
 */
export function columnKind(column: CompactColumn, context: CompactColumnContext = {}): Exclude<CompactColumnKind, 'label'> {
  const { field } = column
  if (column.name === context.primaryKeyField) return 'key'
  if (field.adornments?.some((adornment) => adornment?.type === 'CHIP') || field.possibleValueSourceName) return 'status'
  switch (field.type) {
    case 'BOOLEAN': return 'boolean'
    case 'DATE': return 'date'
    case 'DATE_TIME': return 'dateTime'
    case 'INTEGER': case 'LONG': case 'DECIMAL': return 'number'
    case 'TEXT': case 'HTML': case 'BLOB': return 'longText'
    default: break
  }
  if (field.isHeavy) return 'longText'
  const samples = (context.samples?.(column.name) ?? []).filter((text) => text !== '')
  if (samples.length > 0) {
    const lengths = samples.map((text) => text.length)
    const average = lengths.reduce((sum, length) => sum + length, 0) / lengths.length
    return average > LONG_TEXT_AVERAGE || Math.max(...lengths) > LONG_TEXT_MAX ? 'longText' : 'text'
  }
  return (field.maxLength ?? 0) > LONG_TEXT_MAX_LENGTH ? 'longText' : 'text'
}

/**
 * Estimated width a column needs to show its values without crowding.
 *
 * @param column - The column.
 * @param kind - Its kind.
 * @param samples - Its values' text in the rows shown.
 * @returns Width in CSS pixels.
 */
export function estimateColumnWidth(column: CompactColumn, kind: CompactColumnKind, samples: string[] = []): number {
  const heading = Math.min(column.label.length * CHAR_WIDTH + CELL_PADDING, 140)
  switch (kind) {
    case 'key': case 'number': return Math.max(72, Math.min(heading, 110))
    case 'boolean': return Math.max(80, heading)
    case 'date': return DATE_COLUMN_WIDTH
    case 'dateTime': return DATE_TIME_COLUMN_WIDTH
    case 'longText': return 280
    default: {
      const longest = samples.reduce((max, text) => Math.max(max, text.length), 0)
      const content = longest * CHAR_WIDTH + CELL_PADDING
      return Math.round(Math.min(260, Math.max(kind === 'status' ? 100 : 90, heading, content)))
    }
  }
}

/** Base priority of each kind (higher is kept first). */
const KIND_PRIORITY: Record<CompactColumnKind, number> = {
  label: 100, status: 70, boolean: 65, dateTime: 40, date: 40, text: 45, number: 35, key: 20, longText: 5,
}
/** Extra priority of the one date column chosen to stay, and of a field in a T1 section. */
const CHOSEN_DATE_BONUS = 25
const T1_BONUS = 5

/**
 * The date column whose newest value is the latest (ties: the first), or undefined.
 *
 * @param candidates - Columns with their kinds.
 * @param samples - Sample values per column.
 * @returns The chosen date column's name.
 */
function chosenDate(candidates: Array<{ column: CompactColumn; kind: CompactColumnKind }>, samples: (name: string) => string[]): string | undefined {
  let best: { name: string; latest: string } | undefined
  for (const { column, kind } of candidates) {
    if (kind !== 'date' && kind !== 'dateTime') continue
    // ISO-8601 values sort as text; display text that is not ISO just keeps metadata order
    const latest = samples(column.name).reduce((max, text) => (text > max ? text : max), '')
    if (!best || latest > best.latest) best = { name: column.name, latest }
  }
  return best?.name
}

/**
 * Scores every column.
 *
 * @param columns - Candidates in metadata order.
 * @param context - Choice context.
 * @param rawSamples - Raw (ISO) values per column, for choosing the date.
 * @returns Each column with its kind, priority and estimated width.
 */
export function rankColumns<T extends CompactColumn>(columns: T[], context: CompactColumnContext = {}, rawSamples?: (name: string) => string[]):
  Array<{ column: T; kind: CompactColumnKind; priority: number; width: number }> {
  const samples = context.samples ?? (() => [])
  const kinds = columns.map((column) => ({ column, kind: columnKind(column, context) as CompactColumnKind }))
  const t1 = new Set(context.t1FieldNames ?? [])
  // the record's name: the first short text column, in a T1 section if there is one
  const texts = kinds.filter(({ kind }) => kind === 'text')
  const label = (texts.find(({ column }) => t1.has(column.name)) ?? texts[0])?.column.name
  for (const entry of kinds) if (entry.column.name === label) entry.kind = 'label'
  const date = chosenDate(kinds, rawSamples ?? samples)
  const explicit = context.explicitOrder ?? []

  return kinds.map(({ column, kind }) => {
    let priority = KIND_PRIORITY[kind]
    if (explicit.length > 0) {
      const index = explicit.indexOf(column.name)
      priority = index >= 0 ? 1000 - index : priority
    } else {
      if (column.name === date) priority += CHOSEN_DATE_BONUS
      if (t1.has(column.name) && kind !== 'key') priority += T1_BONUS
      // a key is the row's name when nothing else names it, and otherwise not worth the room
      if (kind === 'key') priority = label ? -1 : KIND_PRIORITY.label
    }
    return { column, kind, priority, width: estimateColumnWidth(column, kind, samples(column.name)) }
  })
}

/**
 * Chooses the columns that fit: the highest priorities first, while their estimated widths fit
 * the available width (at least one column is always shown; a negative priority is never used
 * to fill space), returned in metadata order.
 *
 * @param columns - Candidates in metadata order.
 * @param availableWidth - The table's width in CSS pixels; 0 or less shows every column.
 * @param context - Choice context.
 * @param rawSamples - Raw (ISO) values per column, for choosing the date.
 * @returns The shown and hidden columns.
 */
export function pickCompactColumns<T extends CompactColumn>(columns: T[], availableWidth: number, context: CompactColumnContext = {}, rawSamples?: (name: string) => string[]): CompactColumnChoice<T> {
  if (!(availableWidth > 0)) return { shown: columns, hidden: [] }
  const ranked = rankColumns(columns, context, rawSamples)
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
  const keep = new Set<string>()
  let used = 0
  for (const { column, width, priority } of ranked) {
    if (keep.size > 0 && (priority < 0 || used + width > availableWidth)) continue
    keep.add(column.name)
    used += width
  }
  return {
    shown: columns.filter((column) => keep.has(column.name)),
    hidden: columns.filter((column) => !keep.has(column.name)),
  }
}
