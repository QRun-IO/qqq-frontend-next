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
 * @file Helpers shared by the script viewer and editor (QQQ scripts model: script type file
 * modes, file schemas, revision files).
 */

import type { QRecord } from '@/types'
import { SCRIPT_LOG_TABLE, scriptLogsFilter } from '@/lib/api/developer'
import { formatDateTime } from '@/lib/utils/datetime-utils'

/** Script type file modes (`scriptType.fileMode`). */
export const FILE_MODE_SINGLE = 1
export const FILE_MODE_MULTI_PRE_DEFINED = 2

/** A file a script revision is made of. */
export interface ScriptFileSchema {
  /** File name, e.g. `Script.js`. */
  name: string
  /** Language of the file, from the script type file schema (an Ace mode name). */
  fileType: string
}

/** The one file of a single-file script type, as Material names it. */
export const SINGLE_FILE: ScriptFileSchema = { name: 'Script.js', fileType: 'javascript' }

/**
 * Makes a value safe to use inside an HTML id.
 * @param value - Raw name.
 * @returns The name with every character outside `[A-Za-z0-9_-]` replaced by `-`.
 */
export function domId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-')
}

/**
 * Plain text of a backend value.
 * @param value - Any wire value.
 * @returns The text (`''` for null/undefined, JSON for objects).
 */
export function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Formats a timestamp with the dashboards' date-time format, keeping unreadable values as they are.
 * @param value - Wire timestamp.
 * @returns The display text.
 */
export function dateTimeText(value: unknown): string {
  return formatDateTime(value) ?? text(value)
}

/**
 * Whether two record ids are the same (ids may arrive as numbers or strings).
 * @param a - First id.
 * @param b - Second id.
 * @returns True when both are present and equal as text.
 */
export function sameId(a: unknown, b: unknown): boolean {
  return a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)
}

/**
 * The files of a revision in the script type's order, with their contents.
 *
 * - Single-file types have one file, `Script.js`, whatever name it was stored under (the
 *   backend's create-script route stores the first revision's file as "script").
 * - Multi-file types list their pre-defined files in schema order (Material's order), each
 *   with its stored contents or an empty file.
 * - Other modes show the stored files as they are.
 *
 * @param fileMode - The script type's file mode.
 * @param schemas - The type's file schema records (multi-file types).
 * @param files - The revision's file records (`fileName`, `contents`).
 * @returns The ordered file schemas and the contents by file name.
 */
export function revisionFiles(fileMode: number, schemas: QRecord[], files: QRecord[]): {
  fileSchemas: ScriptFileSchema[]
  contents: Record<string, string>
} {
  const stored: Record<string, string> = {}
  for (const file of files) stored[text(file.values.fileName)] = text(file.values.contents)
  if (fileMode === FILE_MODE_SINGLE) {
    const names = Object.keys(stored)
    const single = stored[SINGLE_FILE.name] ?? (names.length === 1 ? stored[names[0]] : undefined)
    return { fileSchemas: [SINGLE_FILE], contents: single === undefined ? {} : { [SINGLE_FILE.name]: single } }
  }
  if (fileMode === FILE_MODE_MULTI_PRE_DEFINED) {
    const fileSchemas = schemas.map((schema) => ({ name: text(schema.values.name), fileType: text(schema.values.fileType) }))
    return { fileSchemas, contents: Object.fromEntries(fileSchemas.map((schema) => [schema.name, stored[schema.name] ?? ''])) }
  }
  return {
    fileSchemas: Object.keys(stored).map((name) => ({ name, fileType: name.endsWith('.js') ? 'javascript' : 'text' })),
    contents: stored,
  }
}

/**
 * The "API: <name> version <version>" line of a revision (Material's ScriptViewer), shown only
 * when the revision names an API or version.
 * @param revision - A script revision record.
 * @returns The line, or `undefined` when neither is set.
 */
export function revisionApiLine(revision: QRecord): string | undefined {
  const apiName = revision.values.apiName
  const apiVersion = revision.values.apiVersion
  if ((apiName === null || apiName === undefined || apiName === '') && (apiVersion === null || apiVersion === undefined || apiVersion === '')) {
    return undefined
  }
  const name = text(revision.displayValues?.apiName ?? apiName) || 'None'
  const version = text(revision.displayValues?.apiVersion ?? apiVersion) || 'None'
  return `API: ${name} version ${version}`
}

/**
 * The query-screen link of the script log table filtered to one revision (Material's "View All").
 * @param scriptRevisionId - Revision id.
 * @returns The link.
 */
export function scriptLogsQueryHref(scriptRevisionId: string | number): string {
  return `/app/${SCRIPT_LOG_TABLE}?filter=${encodeURIComponent(JSON.stringify(scriptLogsFilter(scriptRevisionId)))}`
}
