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

import type { QPossibleValue, QQueryFilter } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import apiClient from './client'

/**
 * A record picker page request (the v1 body's `picker` object), for a field whose possible value
 * source declares a picker. The server allows criteria only on the picker's filter fields and
 * orderings only on its sort fields (or the primary key).
 */
export interface PickerPageRequest {
  /** Criteria (`AND`ed with the field's own filter) and the ordering; `skip`/`limit` are ignored. */
  filter?: Pick<QQueryFilter, 'criteria' | 'orderBys'> & { booleanOperator?: 'AND' | 'OR' }
  /** Keyset paging: the last option id of the previous page (ordering by the primary key alone). */
  afterId?: string | number
  /** Offset paging, for other orderings. */
  skip?: number
  /** Options per page (default: the picker's page size). */
  limit?: number
}

/** A page of picker options and whether another follows (the picker never counts). */
export interface PossibleValuesPage {
  /** The options, each with its picker display values. */
  options: QPossibleValue[]
  /** Whether another page follows. */
  hasMore: boolean
}

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
   * Display labels to resolve, as a list (for labels that contain commas, such as pasted
   * filter values). Takes precedence over `labels`.
   */
  labelList?: string[]
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
  /** A record picker request: options carry display values and the response says whether more follow. */
  picker?: PickerPageRequest
}

/**
 * Validate the native envelope before exposing options to a picker. Jackson omits an empty
 * `options` list, so `{}` (or `{ hasMore: false }` for a picker request) means no options.
 */
const possibleValuesResponse = z.union([
  z.object({
    options: z.array(z.object({
      id: z.union([z.string(), z.number().finite()]),
      label: z.string(),
      values: z.record(z.unknown()).optional(),
      displayValues: z.record(z.string()).optional(),
    }).passthrough()),
    hasMore: z.boolean().optional(),
  }),
  z.object({ hasMore: z.boolean().optional() }).strict().transform((empty) => ({ options: [], hasMore: empty.hasMore })),
])

/**
 * Search a possible-value source through its v1 route (`POST`, JSON body).
 * @param url - v1 route relative to the API base URL.
 * @param request - Search text, identifiers, form values and field context.
 * @returns Validated native options and whether more follow; rejects HTTP and response-format failures.
 */
async function loadPossibleValuesPage(url: string, request: PossibleValuesRequest): Promise<PossibleValuesPage> {
  const { searchTerm, useCase } = request
  const ids = request.ids ?? request.values
  const body: Record<string, unknown> = {}
  if (searchTerm !== undefined) body.searchTerm = searchTerm
  if (ids) body.ids = ids.split(',')
  else if (request.labelList) body.labels = request.labelList
  else if (request.labels) body.labels = request.labels.split(',')
  if (useCase) body.useCase = useCase
  if (request.formValues) body.values = request.formValues
  if (request.picker) body.picker = request.picker
  const result = await apiClient.post<unknown>(url, body)
  const page = possibleValuesResponse.parse(result)
  return { options: page.options as QPossibleValue[], hasMore: page.hasMore ?? false }
}

/**
 * Search a possible-value source through its v1 route, returning the options only.
 * @param url - v1 route relative to the API base URL.
 * @param request - Search text, identifiers, form values and field context.
 * @returns Validated native options.
 */
async function loadPossibleValues(url: string, request: PossibleValuesRequest): Promise<QPossibleValue[]> {
  return (await loadPossibleValuesPage(url, request)).options
}

/**
 * The v1 possible-values route of a field: a table or process field, or a standalone source.
 * @param context - Where the field is (table, process or standalone).
 * @param fieldName - Exact field identifier.
 * @param possibleValueSourceName - Source name for a standalone lookup (defaults to the field name).
 * @returns The route relative to the API base URL.
 */
export function possibleValuesUrl(context: PossibleValueContext, fieldName: string, possibleValueSourceName?: string): string {
  if (context.type === 'table') return `/table/${encodeURIComponent(context.tableName)}/possibleValues/${encodeURIComponent(fieldName)}`
  if (context.type === 'process') return `/processes/${encodeURIComponent(context.processName)}/possibleValues/${encodeURIComponent(fieldName)}`
  return `/possibleValues/${encodeURIComponent(possibleValueSourceName ?? fieldName)}`
}

/**
 * Load a page of a field's choices with the record picker (options with display values).
 * @param context - Where the field is (table, process or standalone).
 * @param fieldName - Exact field identifier.
 * @param possibleValueSourceName - Source name for a standalone lookup.
 * @param request - Search, ids, form values and the picker page request.
 * @returns The options and whether another page follows.
 */
export async function fetchPossibleValuesPage(
  context: PossibleValueContext,
  fieldName: string,
  possibleValueSourceName: string | undefined,
  request: PossibleValuesRequest & { picker: PickerPageRequest }
): Promise<PossibleValuesPage> {
  return loadPossibleValuesPage(possibleValuesUrl(context, fieldName, possibleValueSourceName), request)
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
