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
 * @file Material Dashboard link compatibility: the hash links and table-scoped process
 * paths that backend widgets (AbstractHTMLWidgetRenderer) and existing bookmarks use.
 *
 * - `#audit` on a record view opens its audit history.
 * - `#/launchProcess={process}` on a record view runs the process for that record.
 * - `#/createChild={table}/defaultValues={json}/disabledFields={json}` on a record view
 *   opens a create form for a child record.
 * - `#/defaultValues={json}/disabledFields={json}` on a create page presets fields.
 * - `/app/{table}/{process}` and `/app/{table}/{id}/{process}` run a table's process.
 */

import type { QInstance, QTableMetaData } from '@/types'

/**
 * Splits a Material hash (`#/a=1/b=2`, `#a=1`) into its named, URI-decoded values.
 *
 * @param hash - `window.location.hash` (with or without the leading `#`).
 * @returns Name to value; parts without `=` are ignored.
 */
export function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  for (const part of hash.replace(/^#/, '').split('/')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const raw = part.slice(index + 1)
    try {
      params[part.slice(0, index)] = decodeURIComponent(raw)
    } catch {
      params[part.slice(0, index)] = raw
    }
  }
  return params
}

/**
 * Parses a JSON object value from a hash parameter.
 *
 * @param value - The decoded parameter.
 * @returns The object, or `null` when absent or not a JSON object.
 */
function jsonObject(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

/**
 * Field presets from a hash: default values and the fields locked to them.
 * Material accepts `disabledFields` as an object (`{"field": 1}`) or a list.
 */
export interface HashFormPresets {
  /** Field name to preset value. */
  defaultValues: Record<string, unknown>
  /** Fields shown read-only with their preset value. */
  disabledFields: string[]
}

/**
 * Reads `defaultValues` and `disabledFields` from a hash.
 *
 * @param hash - `window.location.hash`.
 * @returns The presets (empty when the hash has none).
 */
export function formPresetsFromHash(hash: string): HashFormPresets {
  const params = parseHashParams(hash)
  return presetsFromParams(params)
}

/**
 * Builds presets from already-parsed hash parameters.
 *
 * @param params - Parsed hash parameters.
 * @returns The presets.
 */
function presetsFromParams(params: Record<string, string>): HashFormPresets {
  const defaultValues = jsonObject(params.defaultValues) ?? {}
  let disabledFields: string[] = []
  if (params.disabledFields) {
    try {
      const parsed: unknown = JSON.parse(params.disabledFields)
      if (Array.isArray(parsed)) disabledFields = parsed.filter((name): name is string => typeof name === 'string')
      else if (parsed && typeof parsed === 'object') disabledFields = Object.entries(parsed).filter(([, on]) => Boolean(on)).map(([name]) => name)
    } catch {
      disabledFields = []
    }
  }
  return { defaultValues, disabledFields }
}

/** What a record-view hash asks for. */
export type RecordHashAction =
  | { type: 'audit' }
  | { type: 'launchProcess'; processName: string }
  | ({ type: 'createChild'; tableName: string } & HashFormPresets)
  | { type: 'section'; name: string }

/**
 * Interprets a record-view hash the way Material's RecordView does.
 *
 * @param hash - `window.location.hash`.
 * @returns The requested action, or `null` for an empty or unrecognized hash.
 */
export function recordHashAction(hash: string): RecordHashAction | null {
  const trimmed = hash.replace(/^#/, '')
  if (!trimmed) return null
  if (trimmed === 'audit' || trimmed === '/audit') return { type: 'audit' }
  const params = parseHashParams(hash)
  if (params.launchProcess) return { type: 'launchProcess', processName: params.launchProcess }
  if (params.createChild) return { type: 'createChild', tableName: params.createChild, ...presetsFromParams(params) }
  if (!trimmed.includes('=') && !trimmed.includes('/')) {
    try {
      return { type: 'section', name: decodeURIComponent(trimmed) }
    } catch {
      return { type: 'section', name: trimmed }
    }
  }
  return null
}

/**
 * Resolves the process a Material table-scoped path names. Material opens a process over the
 * query screen for `/app/{table}/{process}` (exact name, the table's or an instance-wide one)
 * and over a record for `/app/{table}/{id}/{process}` (the table's processes, also by suffix).
 *
 * @param instance - Instance metadata.
 * @param tableName - The table in the path.
 * @param segment - The path segment after the table, or after the record id.
 * @param recordScoped - `true` for the segment after a record id (enables suffix matching).
 * @returns The process name, or `null` when no process the user can see has that name.
 */
export function tableProcessForSegment(instance: QInstance | undefined, tableName: string, segment: string, recordScoped = false): string | null {
  const processes = instance?.processes ?? {}
  const tableProcesses = Object.values(processes).filter((process) => process.tableName === tableName)
  const match = tableProcesses.find((process) => process.name === segment)
    ?? (recordScoped ? tableProcesses.find((process) => process.name.endsWith(segment)) : undefined)
    ?? processes[segment]
  return match?.name ?? null
}

/**
 * The report a Material `/app/{table}/{report}` path names.
 *
 * @param instance - Instance metadata.
 * @param tableName - The table in the path.
 * @param segment - The path segment after the table.
 * @returns The report name, or `null`.
 */
export function tableReportForSegment(instance: QInstance | undefined, tableName: string, segment: string): string | null {
  const report = instance?.reports?.[segment]
  return report && report.tableName === tableName ? segment : null
}

/**
 * The process-run URL for a Material-style launch, returning to `returnTo` afterwards.
 *
 * @param processName - Process to run.
 * @param options - Where the run starts from.
 * @param options.recordId - Record the process runs for.
 * @param options.search - Query string of the launching URL (its record selection and
 *   default process values are kept).
 * @param options.returnTo - In-app path to come back to.
 * @param options.tableName - Table the records come from, for a process that is not that
 *   table's own (one added to every screen).
 * @returns The URL.
 */
export function processRunHref(processName: string, options: { recordId?: string | number; search?: string; returnTo: string; tableName?: string }): string {
  const params = new URLSearchParams(options.search ?? '')
  if (options.recordId !== undefined && options.recordId !== '') {
    params.set('recordsParam', 'recordIds')
    params.set('recordIds', String(options.recordId))
  }
  if (options.tableName) params.set('tableName', options.tableName)
  params.set('returnTo', options.returnTo)
  return `/app/${encodeURIComponent(processName)}?${params.toString()}`
}

/**
 * The preset values of the locked (`disabledFields`) fields, submitted as fixed values so a
 * disabled input can never drop them; only fields the table declares with scalar values.
 *
 * @param table - Metadata of the table being created.
 * @param presets - Presets read from the hash.
 * @returns Field name to value.
 */
export function lockedPresetValues(table: QTableMetaData, presets: HashFormPresets): Record<string, string | number | boolean> {
  const locked: Record<string, string | number | boolean> = {}
  for (const name of presets.disabledFields) {
    const value = presets.defaultValues[name]
    if (table.fields[name] && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) locked[name] = value
  }
  return locked
}
