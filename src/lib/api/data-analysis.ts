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

/** @file Typed calls to the data-analysis v1 UI API extension. */

import type {
  DataAnalysisSavedRequestV1,
  DataAnalysisSavedResultV1,
  DataAnalysisSavedListV1,
  DataAnalysisSqlV1,
  DataAnalysisStarV1,
  DataAnalysisWatchPreviewV1,
  DataAnalysisCompareRequestV1,
  DataAnalysisCompareV1,
  DataAnalysisCorrelationRequestV1,
  DataAnalysisCorrelationV1,
  DataAnalysisCrosstabRequestV1,
  DataAnalysisCrosstabV1,
  DataAnalysisScatterRequestV1,
  DataAnalysisScatterV1,
  DataAnalysisShiftRequestV1,
  DataAnalysisShiftV1,
  DataAnalysisCapabilitiesV1,
  DataAnalysisColumnProfileRequestV1,
  DataAnalysisColumnProfileV1,
  DataAnalysisDistinctValuesRequestV1,
  DataAnalysisDistinctValuesPageV1,
  DataAnalysisTableProfileRequestV1,
  DataAnalysisTableProfileV1,
  DataAnalysisDuplicatesRequestV1,
  DataAnalysisDuplicatesResultV1,
  DataAnalysisStartRunRequestV1,
  DataAnalysisRunStartedV1,
  DataAnalysisRunStatusV1,
  DataAnalysisPivotRequestV1,
  DataAnalysisPivotV1,
} from '@/types/data-analysis'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient from './client'
import { getUiApiVersion } from './ui-api-version'

const ROOT = '/qbit/data-analysis'

/** Computes a pivot for the current filtered population.
 * @param table - Metadata table name.
 * @param request - Dimensions, measures and query filter.
 * @returns Sparse pivot cells and totals.
 */
export async function pivot(
  table: string,
  request: DataAnalysisPivotRequestV1
): Promise<DataAnalysisPivotV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/pivot`, request)
}

/** Detects availability without changing the legacy query UI.
 * @param table - Metadata table name.
 * @returns Capabilities, or null for an absent or forbidden extension.
 */
export async function getCapabilities(table: string): Promise<DataAnalysisCapabilitiesV1> {
  // ask only servers that register the extension, so apps without the qbit see no failed request
  if (!(await isDataAnalysisInstalled())) return null
  try {
    const data = await apiClient.get<DataAnalysisCapabilitiesV1>(
      `${ROOT}/tables/${encodeURIComponent(table)}/capabilities`
    )
    return data && typeof data.canAnalyze === 'boolean' ? data : null
  } catch (error) {
    if ([403, 404].includes(getErrorStatusCode(error) ?? 0)) return null
    throw error
  }
}

let installed: Promise<boolean> | null = null

/** Whether the server registers the `data-analysis` UI API extension (`GET /version`), asked once per page load.
 * @returns True when the extension is registered.
 */
export function isDataAnalysisInstalled(): Promise<boolean> {
  installed ??= getUiApiVersion()
    .then((info) => info.extensions.some((extension) => extension?.name === 'data-analysis'))
    .catch(() => {
      installed = null
      return false
    })
  return installed
}

/** Forgets the cached extension check (tests, and after signing in to another server).
 */
export function resetDataAnalysisInstalled(): void {
  installed = null
}

/** Profiles one readable field.
 * @param table - Metadata table name.
 * @param request - Field and filter.
 * @returns The column profile.
 */
export async function columnProfile(
  table: string,
  request: DataAnalysisColumnProfileRequestV1
): Promise<DataAnalysisColumnProfileV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/column-profile`, request)
}

/** Enumerates distinct values.
 * @param table - Metadata table name.
 * @param request - Field, filter and paging.
 * @returns A page of values.
 */
export async function distinctValues(
  table: string,
  request: DataAnalysisDistinctValuesRequestV1
): Promise<DataAnalysisDistinctValuesPageV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/distinct-values`, request)
}

/** Profiles table completeness and keys.
 * @param table - Metadata table name.
 * @param request - Filter and optional fields.
 * @returns The table profile.
 */
export async function tableProfile(
  table: string,
  request: DataAnalysisTableProfileRequestV1
): Promise<DataAnalysisTableProfileV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/table-profile`, request)
}

/** Finds duplicate groups.
 * @param table - Metadata table name.
 * @param request - Selected fields and filter.
 * @returns Duplicate groups and drills.
 */
export async function duplicates(
  table: string,
  request: DataAnalysisDuplicatesRequestV1
): Promise<DataAnalysisDuplicatesResultV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/duplicates`, request)
}

/** Starts an owner-scoped exact analysis.
 * @param request - Operation, table and profile request.
 * @returns The run identifier.
 */
export async function startRun(
  request: DataAnalysisStartRunRequestV1
): Promise<DataAnalysisRunStartedV1> {
  return apiClient.post(`${ROOT}/runs`, request)
}

/** Reads an owner-scoped run.
 * @param runId - Identifier returned by startRun.
 * @returns Status and the completed typed result.
 */
export async function getRun(runId: string): Promise<DataAnalysisRunStatusV1> {
  return apiClient.get(`${ROOT}/runs/${encodeURIComponent(runId)}`)
}

/** Computes compare for permitted records.
 * @param table - Metadata table name.
 * @param request - Analysis parameters and population filters.
 * @returns The typed analysis result.
 */
export async function compare(
  table: string,
  request: DataAnalysisCompareRequestV1
): Promise<DataAnalysisCompareV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/compare`, request)
}

/** Computes correlation for permitted records.
 * @param table - Metadata table name.
 * @param request - Analysis parameters and population filters.
 * @returns The typed analysis result.
 */
export async function correlation(
  table: string,
  request: DataAnalysisCorrelationRequestV1
): Promise<DataAnalysisCorrelationV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/correlation`, request)
}

/** Computes crosstab for permitted records.
 * @param table - Metadata table name.
 * @param request - Analysis parameters and population filters.
 * @returns The typed analysis result.
 */
export async function crosstab(
  table: string,
  request: DataAnalysisCrosstabRequestV1
): Promise<DataAnalysisCrosstabV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/crosstab`, request)
}

/** Computes scatter for permitted records.
 * @param table - Metadata table name.
 * @param request - Analysis parameters and population filters.
 * @returns The typed analysis result.
 */
export async function scatter(
  table: string,
  request: DataAnalysisScatterRequestV1
): Promise<DataAnalysisScatterV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/scatter`, request)
}

/** Computes shift for permitted records.
 * @param table - Metadata table name.
 * @param request - Analysis parameters and population filters.
 * @returns The typed analysis result.
 */
export async function shift(
  table: string,
  request: DataAnalysisShiftRequestV1
): Promise<DataAnalysisShiftV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/shift`, request)
}

/** Lists visible saved analyses and the viewer's stars.
 * @returns Saved library entries.
 */
export async function listSavedAnalyses(): Promise<DataAnalysisSavedListV1> {
  return apiClient.get(`${ROOT}/saved`)
}
/** Re-runs a saved analysis with current viewer permissions.
 * @param id - Saved record id.
 * @returns Typed result and warnings.
 */
export async function runSavedAnalysis(id: string): Promise<DataAnalysisSavedResultV1> {
  return apiClient.post(`${ROOT}/saved/${encodeURIComponent(id)}/run`, {})
}
/** Updates the viewer's star idempotently.
 * @param id - Saved record id.
 * @param starred - Desired state.
 * @returns Confirmed state.
 */
export async function starAnalysis(id: string, starred: boolean): Promise<DataAnalysisStarV1> {
  return starred
    ? apiClient.put(`${ROOT}/saved/${encodeURIComponent(id)}/star`, {})
    : apiClient.delete(`${ROOT}/saved/${encodeURIComponent(id)}/star`)
}
/** Downloads an ad hoc result through the authenticated binary API client.
 * @param request - Current typed analysis and format.
 * @returns File contents.
 */
export async function exportAnalysis(request: DataAnalysisSavedRequestV1): Promise<Blob> {
  return apiClient.post(`${ROOT}/export`, request, { responseType: 'blob', timeout: 300000 })
}
/** Downloads a saved analysis as the current viewer.
 * @param id - Saved record id.
 * @param format - File format.
 * @returns File contents.
 */
export async function exportSavedAnalysis(id: string, format: 'csv' | 'xlsx'): Promise<Blob> {
  return apiClient.get(`${ROOT}/saved/${encodeURIComponent(id)}/export`, {
    params: { format },
    responseType: 'blob',
    timeout: 300000,
  })
}
/** Gets the permitted aggregate SQL without executing it in the workbench.
 * @param table - Source table.
 * @param request - Typed analysis.
 * @returns SQL or an explanation of unavailability.
 */
export async function analysisSql(
  table: string,
  request: DataAnalysisSavedRequestV1
): Promise<DataAnalysisSqlV1> {
  return apiClient.post(`${ROOT}/tables/${encodeURIComponent(table)}/sql`, request)
}
/** Evaluates a persisted watch without altering its alert state.
 * @param id - Watch record id.
 * @returns Series, baseline and verdict.
 */
export async function previewWatch(id: string): Promise<DataAnalysisWatchPreviewV1> {
  return apiClient.post(`${ROOT}/watches/${encodeURIComponent(id)}/preview`, {})
}
