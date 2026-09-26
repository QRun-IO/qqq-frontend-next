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
 * @file process-utils — utility functions for filtering and categorizing QQQ processes.
 */

import type { QInstance, QProcessMetaData } from '@/types'

/**
 * Returns all visible, permitted processes that belong to a given table, followed by the
 * processes the instance adds to every query and record screen ({@link getProcessesForAllScreens}).
 *
 * Filters out processes where `isHidden === true` (admin-only or suppressed entries)
 * and where `hasPermission === false` (backend signals the current user lacks access).
 * Processes with `hasPermission` unset (`undefined`) are treated as permitted.
 *
 * Typically called from the Record Query and Record View pages before splitting the
 * result into single-record and bulk process lists via `getSingleRecordProcesses` and
 * `getBulkProcesses`.
 *
 * @param metaData - The full `QInstance` metadata object, typically returned by
 *   `useMetadata()` and passed down as a prop — never fetched directly inside components.
 * @param tableName - The backend-registered name of the table (e.g. `'person'`), not
 *   the human-readable label. Must match `QProcessMetaData.tableName` exactly.
 * @returns An array of `QProcessMetaData` objects whose `tableName` matches, that are
 *   not hidden, and that the current user has permission to run, then the all-screens
 *   processes not already listed. Returns an empty array when `metaData.processes` is
 *   absent or no processes match.
 */
export function getProcessesForTable(
  metaData: QInstance,
  tableName: string
): QProcessMetaData[] {
  const own = Object.values(metaData.processes ?? {}).filter(
    (p) => p.tableName === tableName && !p.isHidden && p.hasPermission !== false
  )
  const added = getProcessesForAllScreens(metaData).filter((p) => !own.some((o) => o.name === p.name))
  return [...own, ...added]
}

/** Process Material adds to every screen when the instance has no Material dashboard metadata (deprecated). */
export const DEPRECATED_ALL_SCREENS_PROCESS = 'runRecordScript'

/**
 * Processes the instance adds to every table's query and record screens, as Material does:
 * `supplementalInstanceMetaData.materialDashboard.processNamesToAddToAllQueryAndViewScreens`,
 * in order, or (deprecated) the `runRecordScript` process when there is no Material dashboard
 * instance metadata. Only processes present in the metadata the user received (so permitted,
 * or at least visible) are returned; hidden processes are included, as in Material.
 *
 * @param metaData - Instance metadata (with the legacy route's supplemental instance metadata).
 * @returns The processes, without those the user may not run.
 */
export function getProcessesForAllScreens(metaData: QInstance): QProcessMetaData[] {
  const processes = metaData.processes ?? {}
  const supplemental = metaData.supplementalInstanceMetaData?.materialDashboard
  let names: unknown[]
  if (supplemental && typeof supplemental === 'object') {
    const configured = (supplemental as { processNamesToAddToAllQueryAndViewScreens?: unknown }).processNamesToAddToAllQueryAndViewScreens
    names = Array.isArray(configured) ? configured : []
  } else {
    names = [DEPRECATED_ALL_SCREENS_PROCESS]
  }
  const found: QProcessMetaData[] = []
  for (const name of names) {
    const process = typeof name === 'string' ? processes[name] : undefined
    if (process && process.hasPermission !== false && !found.includes(process)) found.push(process)
  }
  return found
}

/**
 * The processes a record screen's Actions menu offers: the table's own visible, permitted
 * processes and the processes added to every screen (which may be hidden), when they accept a
 * single record.
 *
 * @param processes - The screen's processes (from {@link getProcessesForTable}).
 * @param tableName - The record's table.
 * @returns The processes to list, in order.
 */
export function getRecordActionProcesses(processes: QProcessMetaData[] | undefined, tableName: string): QProcessMetaData[] {
  return (processes ?? []).filter(
    (p) => (p.tableName !== tableName || !p.isHidden) && p.hasPermission && (p.maxInputRecords ?? Infinity) >= 1
  )
}

/**
 * The table a launch should name for a process: the launching table, for a process that is not
 * that table's own (a process added to every screen reads its records from that table).
 *
 * @param process - The process being launched.
 * @param tableName - The table the launch starts from.
 * @returns The table name, or `undefined` for the table's own processes.
 */
export function launchTableName(process: Pick<QProcessMetaData, 'tableName'> | undefined, tableName: string): string | undefined {
  return process && process.tableName === tableName ? undefined : tableName
}

/**
 * Returns processes that can run against a single record (maxInputRecords >= 1).
 *
 * Used by the Record View page to build the "Actions" menu shown when viewing one record.
 * A process with `maxInputRecords` unset is treated as unlimited and therefore included.
 *
 * @param processes - The list of processes to filter; typically the return value of
 *   `getProcessesForTable()` already scoped to the current table and user permissions.
 * @returns Processes whose `maxInputRecords` is `>= 1` or is unset (treated as unlimited).
 *   Returns an empty array when `processes` is empty.
 */
export function getSingleRecordProcesses(
  processes: QProcessMetaData[]
): QProcessMetaData[] {
  return processes.filter(
    (p) => (p.maxInputRecords ?? Infinity) >= 1
  )
}

/**
 * Returns processes that can run against multiple records (maxInputRecords > 1 or unlimited).
 *
 * Used by the Record Query page to build the bulk-action menu shown when one or more
 * rows are selected in the data grid. A `maxInputRecords` value of `0` is the backend's
 * convention for "no upper limit"; unset values are also treated as unlimited.
 *
 * @param processes - The list of processes to filter; typically the return value of
 *   `getProcessesForTable()` already scoped to the current table and user permissions.
 * @returns Processes whose `maxInputRecords` is `> 1`, is `0` (backend convention for
 *   unlimited), or is unset. Returns an empty array when `processes` is empty.
 */
export function getBulkProcesses(
  processes: QProcessMetaData[]
): QProcessMetaData[] {
  return processes.filter(
    (p) => (p.maxInputRecords ?? Infinity) > 1 || p.maxInputRecords === 0
  )
}
