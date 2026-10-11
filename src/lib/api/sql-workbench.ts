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
 * @file SQL Workbench API — permission-checked `/qqq/v1/sql-workbench` endpoints served by the
 * qbit-sql-workbench QBit. SQL errors come back as results (status FAILED / TIMED_OUT /
 * CANCELLED), not as request errors; request errors are 400 / 401 / 403 / 404.
 */

import type {
  SqlExecuteRequest,
  SqlExecuteResponse,
  SqlExplainResponse,
  SqlExportFormat,
  SqlHistoryEntry,
  SqlNotebook,
  SqlNotebookInput,
  SqlNotebookSummary,
  SqlNotebookVersionSummary,
  SqlResultSnapshot,
  SqlRowsPage,
  SqlSchema,
  SqlWorkbenchCapabilities,
} from '@/types'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient, { apiUrl } from './client'

/** Base path of the workbench routes under the API base URL. */
export const SQL_WORKBENCH_PATH = '/sql-workbench'

/**
 * Loads what the caller may do, the limits and the target backends from `GET /capabilities`.
 *
 * 403 (no access), 404, and a 2xx body that is not a capabilities object (the SPA fallback when
 * the backend does not have the QBit) all mean the workbench is unavailable.
 *
 * @returns The capabilities, or `null` when the workbench is unavailable to this user.
 * @throws The request error for any other failure.
 */
export async function getSqlWorkbenchCapabilities(): Promise<SqlWorkbenchCapabilities | null> {
  try {
    const data = await apiClient.get<unknown>(`${SQL_WORKBENCH_PATH}/capabilities`)
    return isObject(data) && Array.isArray(data.backends) && isObject(data.limits)
      ? (data as unknown as SqlWorkbenchCapabilities)
      : null
  } catch (error) {
    const status = getErrorStatusCode(error)
    if (status === 403 || status === 404) return null
    throw error
  }
}

/**
 * Loads a backend's schema for autocomplete from `GET /schema/{backend}`.
 *
 * @param backendName - Target backend.
 * @param refresh - Re-read instead of using the server's cache.
 * @returns The schema.
 */
export async function getSqlSchema(backendName: string, refresh = false): Promise<SqlSchema> {
  return apiClient.get<SqlSchema>(
    `${SQL_WORKBENCH_PATH}/schema/${encodeURIComponent(backendName)}`,
    {
      params: refresh ? { refresh: true } : undefined,
    }
  )
}

/**
 * Runs SQL via `POST /execute`: read-only, a write preview (mode WRITE without a token), or a
 * write commit (mode WRITE with the preview's `confirmToken`).
 *
 * @param request - The run.
 * @returns The outcome.
 */
export async function executeSql(request: SqlExecuteRequest): Promise<SqlExecuteResponse> {
  return apiClient.post<SqlExecuteResponse>(`${SQL_WORKBENCH_PATH}/execute`, request, {
    timeout: 0,
  })
}

/**
 * Explains one statement via `POST /explain`.
 *
 * @param request - Backend, SQL, parameters, and whether to ANALYZE (executes; rolled back).
 * @param request.backendName - Target backend.
 * @param request.sql - The statement.
 * @param request.params - Parameter values.
 * @param request.analyze - Run EXPLAIN ANALYZE.
 * @returns The plan.
 */
export async function explainSql(request: {
  backendName: string
  sql: string
  params?: Record<string, string | number | boolean | null>
  analyze?: boolean
}): Promise<SqlExplainResponse> {
  return apiClient.post<SqlExplainResponse>(`${SQL_WORKBENCH_PATH}/explain`, request, {
    timeout: 0,
  })
}

/**
 * Pages (and optionally sorts) a cached result via `GET /executions/{uuid}/rows`.
 *
 * @param executionUuid - The run.
 * @param offset - Rows to skip.
 * @param limit - Rows to return.
 * @param sort - Column index to sort by.
 * @param dir - Sort direction.
 * @returns The page.
 */
export async function getSqlRows(
  executionUuid: string,
  offset: number,
  limit: number,
  sort?: number,
  dir?: 'asc' | 'desc'
): Promise<SqlRowsPage> {
  return apiClient.get<SqlRowsPage>(
    `${SQL_WORKBENCH_PATH}/executions/${encodeURIComponent(executionUuid)}/rows`,
    {
      params: { offset, limit, ...(sort == null ? {} : { sort, dir: dir ?? 'asc' }) },
    }
  )
}

/**
 * Cancels a running execution via `POST /executions/{uuid}/cancel`.
 *
 * @param executionUuid - The run.
 * @returns Whether a running execution was found and cancelled.
 */
export async function cancelSqlExecution(executionUuid: string): Promise<boolean> {
  const data = await apiClient.post<{ cancelled: boolean }>(
    `${SQL_WORKBENCH_PATH}/executions/${encodeURIComponent(executionUuid)}/cancel`,
    {}
  )
  return data.cancelled === true
}

/**
 * The download URL of a cached result export (the browser opens it, sending its session cookie).
 *
 * @param executionUuid - The run.
 * @param format - csv, xlsx or json.
 * @returns The URL.
 */
export function sqlExportUrl(executionUuid: string, format: SqlExportFormat): string {
  return apiUrl(
    `${SQL_WORKBENCH_PATH}/executions/${encodeURIComponent(executionUuid)}/export?format=${format}`
  )
}

/**
 * The caller's recent executions from `GET /history`.
 *
 * @param limit - How many (server caps at 200).
 * @param backendName - Only this backend.
 * @returns Newest first.
 */
export async function getSqlHistory(limit = 50, backendName?: string): Promise<SqlHistoryEntry[]> {
  const data = await apiClient.get<{ executions: SqlHistoryEntry[] }>(
    `${SQL_WORKBENCH_PATH}/history`,
    {
      params: { limit, ...(backendName ? { backendName } : {}) },
    }
  )
  return data.executions ?? []
}

/**
 * Lists notebooks.
 *
 * @param scope - The caller's own, or the shared library.
 * @returns Summaries, most recently modified first.
 */
export async function listSqlNotebooks(scope: 'mine' | 'shared'): Promise<SqlNotebookSummary[]> {
  const data = await apiClient.get<{ notebooks: SqlNotebookSummary[] }>(
    `${SQL_WORKBENCH_PATH}/notebooks`,
    {
      params: { scope },
    }
  )
  return data.notebooks ?? []
}

/**
 * Loads one notebook with its cells.
 *
 * @param id - Notebook id.
 * @returns The notebook.
 */
export async function getSqlNotebook(id: number): Promise<SqlNotebook> {
  return apiClient.get<SqlNotebook>(`${SQL_WORKBENCH_PATH}/notebooks/${id}`)
}

/**
 * Creates a personal notebook.
 *
 * @param input - Title, cells and parameters.
 * @returns The new notebook (version 1).
 */
export async function createSqlNotebook(input: SqlNotebookInput): Promise<SqlNotebook> {
  return apiClient.post<SqlNotebook>(`${SQL_WORKBENCH_PATH}/notebooks`, input)
}

/**
 * Saves a notebook (its cells are replaced; a new version is recorded).
 *
 * @param id - Notebook id.
 * @param input - The new content.
 * @returns The saved notebook.
 */
export async function saveSqlNotebook(id: number, input: SqlNotebookInput): Promise<SqlNotebook> {
  return apiClient.put<SqlNotebook>(`${SQL_WORKBENCH_PATH}/notebooks/${id}`, input)
}

/**
 * Deletes a notebook (owner only).
 *
 * @param id - Notebook id.
 */
export async function deleteSqlNotebook(id: number): Promise<void> {
  await apiClient.delete(`${SQL_WORKBENCH_PATH}/notebooks/${id}`)
}

/**
 * Publishes a notebook to, or withdraws it from, the shared library.
 *
 * @param id - Notebook id.
 * @param shared - Publish (true) or withdraw (false).
 * @returns The notebook.
 */
export async function publishSqlNotebook(id: number, shared: boolean): Promise<SqlNotebook> {
  return apiClient.post<SqlNotebook>(`${SQL_WORKBENCH_PATH}/notebooks/${id}/publish`, { shared })
}

/**
 * Makes a personal copy of a readable notebook.
 *
 * @param id - Notebook id.
 * @returns The copy.
 */
export async function duplicateSqlNotebook(id: number): Promise<SqlNotebook> {
  return apiClient.post<SqlNotebook>(`${SQL_WORKBENCH_PATH}/notebooks/${id}/duplicate`, {})
}

/**
 * Lists a notebook's versions.
 *
 * @param id - Notebook id.
 * @returns Newest first.
 */
export async function listSqlNotebookVersions(id: number): Promise<SqlNotebookVersionSummary[]> {
  const data = await apiClient.get<{ versions: SqlNotebookVersionSummary[] }>(
    `${SQL_WORKBENCH_PATH}/notebooks/${id}/versions`
  )
  return data.versions ?? []
}

/**
 * Restores a version (saved as a new version).
 *
 * @param id - Notebook id.
 * @param versionNumber - Version to restore.
 * @returns The notebook.
 */
export async function restoreSqlNotebookVersion(
  id: number,
  versionNumber: number
): Promise<SqlNotebook> {
  return apiClient.post<SqlNotebook>(
    `${SQL_WORKBENCH_PATH}/notebooks/${id}/versions/${versionNumber}/restore`,
    {}
  )
}

/**
 * Lists a notebook's pinned results.
 *
 * @param id - Notebook id.
 * @returns Newest first.
 */
export async function listSqlSnapshots(id: number): Promise<SqlResultSnapshot[]> {
  const data = await apiClient.get<{ snapshots: SqlResultSnapshot[] }>(
    `${SQL_WORKBENCH_PATH}/notebooks/${id}/snapshots`
  )
  return data.snapshots ?? []
}

/**
 * Pins a cached result of the caller to a cell.
 *
 * @param id - Notebook id.
 * @param input - The run, the cell, an optional label.
 * @param input.executionUuid - The run to pin.
 * @param input.cellKey - The cell it belongs to.
 * @param input.label - Optional label.
 * @returns The snapshot.
 */
export async function createSqlSnapshot(
  id: number,
  input: { executionUuid: string; cellKey: string; label?: string }
): Promise<SqlResultSnapshot> {
  return apiClient.post<SqlResultSnapshot>(`${SQL_WORKBENCH_PATH}/notebooks/${id}/snapshots`, input)
}

/**
 * Unpins a snapshot.
 *
 * @param id - Notebook id.
 * @param snapshotId - Snapshot id.
 */
export async function deleteSqlSnapshot(id: number, snapshotId: number): Promise<void> {
  await apiClient.delete(`${SQL_WORKBENCH_PATH}/notebooks/${id}/snapshots/${snapshotId}`)
}

/**
 * Whether a value is a plain object.
 *
 * @param value - Anything.
 * @returns True for non-null, non-array objects.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
