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
}

/**
 * Fetches possible values for a specific field on a table via
 * `POST /table/{tableName}/possibleValues/{fieldName}`.
 *
 * Encodes the request as `multipart/form-data`. Only non-empty fields are
 * appended to the form to keep the request body minimal.
 *
 * @param tableName - Exact backend table identifier; determines which
 *   possible-value source provider is consulted on the backend. Case-sensitive;
 *   must match the backend declaration exactly and is used as a URL path segment.
 * @param fieldName - Name of the field whose possible-value source to query.
 * @param request - Use `searchTerm` for live filtering in comboboxes as the
 *   user types; use `ids` or `labels` to resolve pre-populated values for
 *   existing records (e.g. when opening an edit form that already has a value).
 * @returns An array of matching `QPossibleValue` objects, each with an `id`
 *   and a `label` suitable for display in a dropdown or combobox.
 */
export async function fetchTablePossibleValues(
  tableName: string,
  fieldName: string,
  request: PossibleValuesRequest = {}
): Promise<QPossibleValue[]> {
  const formData = new FormData()
  if (request.searchTerm) formData.append('searchTerm', request.searchTerm)
  if (request.ids) formData.append('ids', request.ids)
  if (request.labels) formData.append('labels', request.labels)
  if (request.values) formData.append('values', request.values)
  if (request.useCase) formData.append('useCase', request.useCase)

  return apiClient.post<QPossibleValue[]>(
    `/table/${encodeURIComponent(tableName)}/possibleValues/${encodeURIComponent(fieldName)}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

/**
 * Fetches possible values for a specific field on a process step via
 * `POST /processes/{processName}/possibleValues/{fieldName}`.
 *
 * Encodes the request as `multipart/form-data`. Only non-empty fields are
 * appended to the form to keep the request body minimal.
 *
 * @param processName - Exact backend process identifier; determines which
 *   possible-value source provider is consulted on the backend. Case-sensitive;
 *   must match the backend declaration exactly and is used as a URL path segment.
 * @param fieldName - Name of the process field whose possible-value source to query.
 * @param request - Use `searchTerm` for live filtering in comboboxes as the
 *   user types; use `ids` or `labels` to resolve pre-populated values for
 *   existing process input (e.g. when re-opening a step with stored values).
 * @returns An array of matching `QPossibleValue` objects, each with an `id`
 *   and a `label` suitable for display in a dropdown or combobox.
 */
export async function fetchProcessPossibleValues(
  processName: string,
  fieldName: string,
  request: PossibleValuesRequest = {}
): Promise<QPossibleValue[]> {
  const formData = new FormData()
  if (request.searchTerm) formData.append('searchTerm', request.searchTerm)
  if (request.ids) formData.append('ids', request.ids)
  if (request.labels) formData.append('labels', request.labels)
  if (request.values) formData.append('values', request.values)
  if (request.useCase) formData.append('useCase', request.useCase)

  return apiClient.post<QPossibleValue[]>(
    `/processes/${encodeURIComponent(processName)}/possibleValues/${encodeURIComponent(fieldName)}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

/**
 * Fetches possible values for a standalone possible-value source (PVS) via
 * `POST /possibleValues/{fieldName}`.
 *
 * Used for PVSes that are not tied to a specific table or process — for example,
 * enum-style lists shared across multiple fields or contexts.
 *
 * Encodes the request as `multipart/form-data`. Only non-empty fields are
 * appended to the form to keep the request body minimal.
 *
 * @param fieldName - Name of the standalone possible-value source to query;
 *   determines which PVS provider is consulted on the backend. Case-sensitive;
 *   used as a URL path segment.
 * @param request - Use `searchTerm` for live filtering in comboboxes as the
 *   user types; use `ids` or `labels` to resolve pre-populated values for
 *   existing records (e.g. when opening an edit form that already has a value).
 * @returns An array of matching `QPossibleValue` objects, each with an `id`
 *   and a `label` suitable for display in a dropdown or combobox.
 */
export async function fetchPossibleValues(
  fieldName: string,
  request: PossibleValuesRequest = {}
): Promise<QPossibleValue[]> {
  const formData = new FormData()
  if (request.searchTerm) formData.append('searchTerm', request.searchTerm)
  if (request.ids) formData.append('ids', request.ids)
  if (request.labels) formData.append('labels', request.labels)
  if (request.values) formData.append('values', request.values)
  if (request.useCase) formData.append('useCase', request.useCase)

  return apiClient.post<QPossibleValue[]>(
    `/possibleValues/${encodeURIComponent(fieldName)}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}
