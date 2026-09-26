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
 * @file Possible Values API — Endpoints for fetching possible-value lists for table fields, process fields, and standalone PVSes.
 */

import { z } from 'zod'

import type { QPossibleValue } from '@/types'
import apiClient from './client'

/**
 * Common request parameters accepted by all possible-values endpoints.
 *
 * At least one of `searchTerm`, `ids`, `labels`, or `values` is typically
 * supplied; all fields are optional so callers can pass only what is relevant.
 */
export interface PossibleValuesRequest {
  /** Free-text search string used to filter possible values by label. */
  searchTerm?: string
  /**
   * Comma-separated list of internal IDs to look up by identity.
   * Used to resolve stored IDs back to their display labels.
   */
  ids?: string
  /**
   * Comma-separated list of display labels to resolve to their corresponding values.
   */
  labels?: string
  /**
   * Comma-separated list of stored values to look up.
   * Semantically equivalent to `ids` for most PVS implementations.
   */
  values?: string
  /**
   * Optional hint string indicating the UI context in which possible values are
   * being requested (e.g. `"filter"` or `"form"`). The server may use this to
   * return a different, context-appropriate subset.
   */
  useCase?: string
  /**
   * The current values of the form (or process screen) the field is on. Sent as the
   * `values` map of the v1 JSON body, which the backend reads to resolve
   * `${input.fieldName}` variables in the field's `possibleValueSourceFilter`.
   * Distinct from `values`/`ids`, which look choices up by identity.
   */
  formValues?: Record<string, unknown>
}

/** Validate the native envelope before exposing options to a picker. */
const possibleValuesResponse = z.union([z.object({
  options: z.array(z.object({ id: z.union([z.string(), z.number().finite()]), label: z.string() }).passthrough()),
}), z.object({}).strict().transform(() => ({ options: [] }))])

/**
 * Search a possible-value source through its v1 route (`POST`, JSON body).
 * @param url - v1 route relative to the API base URL.
 * @param request - Search text, identifiers, form values and field context.
 * @returns Validated native options; rejects HTTP and response-format failures.
 */
async function loadPossibleValues(url: string, request: PossibleValuesRequest): Promise<QPossibleValue[]> {
  const { searchTerm, useCase } = request
  const ids = request.ids ?? request.values
  const body: Record<string, unknown> = {}
  if (searchTerm !== undefined) body.searchTerm = searchTerm
  if (ids) body.ids = ids.split(',')
  else if (request.labels) body.labels = request.labels.split(',')
  if (useCase) body.useCase = useCase
  if (request.formValues) body.values = request.formValues
  const result = await apiClient.post<unknown>(url, body)
  return possibleValuesResponse.parse(result).options
}

/**
 * Load choices for a declared table field through its v1 route.
 * @param tableName - Exact table identifier.
 * @param fieldName - Exact field identifier.
 * @param request - Search and identifier filters.
 * @returns Validated choices for the field.
 */
export async function fetchTablePossibleValues(
  tableName: string,
  fieldName: string,
  request: PossibleValuesRequest = {}
): Promise<QPossibleValue[]> {
  return loadPossibleValues(`/table/${encodeURIComponent(tableName)}/possibleValues/${encodeURIComponent(fieldName)}`, request)
}

/**
 * Load choices for a process field through its v1 route.
 * @param processName - Exact process identifier.
 * @param fieldName - Exact field identifier.
 * @param request - Search and identifier filters.
 * @returns Validated choices for the field.
 */
export async function fetchProcessPossibleValues(
  processName: string,
  fieldName: string,
  request: PossibleValuesRequest = {}
): Promise<QPossibleValue[]> {
  return loadPossibleValues(`/processes/${encodeURIComponent(processName)}/possibleValues/${encodeURIComponent(fieldName)}`, request)
}

/**
 * Load choices from a named standalone source through its v1 route.
 * @param fieldName - Exact possible-value source identifier.
 * @param request - Search and identifier filters.
 * @returns Validated choices from the source.
 */
export async function fetchPossibleValues(
  fieldName: string,
  request: PossibleValuesRequest = {}
): Promise<QPossibleValue[]> {
  return loadPossibleValues(`/possibleValues/${encodeURIComponent(fieldName)}`, request)
}
