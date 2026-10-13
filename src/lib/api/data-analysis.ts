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
} from '@/types/data-analysis'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient from './client'

const ROOT = '/qbit/data-analysis'
const tablePath = (table: string) => `${ROOT}/tables/${encodeURIComponent(table)}`

/** Detects availability without changing the legacy query UI.
 * @param table - Metadata table name.
 * @returns Capabilities, or null for an absent or forbidden extension.
 */
export async function getCapabilities(table: string): Promise<DataAnalysisCapabilitiesV1> {
  try {
    const data = await apiClient.get<DataAnalysisCapabilitiesV1>(`${tablePath(table)}/capabilities`)
    return data && typeof data.canAnalyze === 'boolean' ? data : null
  } catch (error) {
    if ([403, 404].includes(getErrorStatusCode(error) ?? 0)) return null
    throw error
  }
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
  return apiClient.post(`${tablePath(table)}/column-profile`, request)
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
  return apiClient.post(`${tablePath(table)}/distinct-values`, request)
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
  return apiClient.post(`${tablePath(table)}/table-profile`, request)
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
  return apiClient.post(`${tablePath(table)}/duplicates`, request)
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
