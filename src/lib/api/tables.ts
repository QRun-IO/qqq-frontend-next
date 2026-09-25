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
 * @file Tables API — CRUD, query, count, global search, and audit endpoints for QQQ table records.
 */

import { isAxiosError } from 'axios'
import { z } from 'zod'

import type { QRecord, QRecordInput, QQueryFilter, QueryJoin } from '@/types'
import apiClient from './client'
import {
  QRecordSchema,
  QueryRecordsResponseSchema,
  CountRecordsResponseSchema,
  GlobalSearchResponseSchema,
} from './schemas'

/**
 * Request body shape accepted by the query and count endpoints.
 */
export interface QueryRecordsRequest {
  /**
   * Filter criteria to apply to the query. Supports:
   * - `criteria` — list of field conditions with operators such as `EQUALS`,
   *   `CONTAINS`, `BETWEEN`, `IS_BLANK`, etc.
   * - `orderBy` — array of `{ fieldName, isAscending }` sort descriptors.
   * - `skip` — zero-based record offset for pagination.
   * - `limit` — maximum records per page; omit for the backend default page size.
   *
   * Pass an empty object `{}` to retrieve all records up to the default page size.
   */
  filter: Partial<QQueryFilter>
  /** Optional join specifications to include related table data in the result. */
  joins?: QueryJoin[]
  /** Optional table variant name to use an alternate backend configuration. */
  tableVariant?: string
}

/**
 * Response body returned by `POST /table/{tableName}/query`.
 */
export interface QueryRecordsResponse {
  /** Ordered list of records matching the supplied filter. */
  records: QRecord[]
}

/**
 * Response body returned by `POST /table/{tableName}/count`.
 */
export interface CountRecordsResponse {
  /** Total number of records matching the filter. */
  count: number
  /**
   * Number of distinct records, populated only when the request
   * was made with `includeDistinct = true`.
   */
  distinctCount?: number
}

/**
 * Validated single-record delete result returned by this client.
 */
export interface DeleteRecordResponse {
  /** Number of records that were successfully deleted. */
  deletedCount: number
}

/**
 * Queries records from a table via `POST /table/{tableName}/query`.
 *
 * Sends the filter, optional joins, and optional table variant in the request body.
 * Results are ordered and paginated according to the filter's `orderBy`, `skip`,
 * and `limit` properties.
 *
 * @param tableName - Exact backend table identifier used as a URL path segment;
 *   case-sensitive and must match the backend declaration exactly (e.g. `"person"`,
 *   not `"Person"` or `"persons"`).
 * @param request - Filter with criteria (operators like EQUALS, CONTAINS, BETWEEN),
 *   sort order array, and pagination (skip/limit); omit `filter.criteria` for all
 *   records up to the default page size.
 * @returns An object containing the matching records array.
 */
export async function queryRecords(
  tableName: string,
  request: QueryRecordsRequest
): Promise<QueryRecordsResponse> {
  const result = await apiClient.post<QueryRecordsResponse>(
    `/table/${encodeURIComponent(tableName)}/query`,
    request
  )
  const parsed = QueryRecordsResponseSchema.safeParse(result)
  if (!parsed.success) {
    console.warn('[API] QueryRecords response failed schema validation:', parsed.error.flatten())
  }
  return parsed.success ? parsed.data : result
}

/**
 * Counts records in a table via `POST /table/{tableName}/count`.
 *
 * Accepts the same filter body as {@link queryRecords} and optionally returns a
 * distinct count when `includeDistinct` is `true`.
 *
 * @param tableName - Exact backend table identifier used as a URL path segment;
 *   case-sensitive and must match the backend declaration exactly.
 * @param request - Filter with criteria (operators like EQUALS, CONTAINS, BETWEEN),
 *   sort order array, and pagination (skip/limit); omit `filter.criteria` for a
 *   total count of all records.
 * @param includeDistinct - When `true`, the response includes a `distinctCount` field.
 * @returns An object with `count` and optionally `distinctCount`.
 */
export async function countRecords(
  tableName: string,
  request: QueryRecordsRequest,
  includeDistinct = false
): Promise<CountRecordsResponse> {
  const result = await apiClient.post<CountRecordsResponse>(
    `/table/${encodeURIComponent(tableName)}/count`,
    request,
    { params: { includeDistinct } }
  )
  const parsed = CountRecordsResponseSchema.safeParse(result)
  if (!parsed.success) {
    console.warn('[API] CountRecords response failed schema validation:', parsed.error.flatten())
  }
  return parsed.success ? parsed.data : result
}

/**
 * Fetches a single record through the legacy `GET /data/{tableName}/{primaryKey}` route.
 *
 * Optional flags control whether associations and joined-table data are included
 * in the response.
 *
 * @param tableName - Exact backend table identifier used as a URL path segment;
 *   case-sensitive and must match the backend declaration exactly.
 * @param primaryKey - Primary key value of the record to retrieve; may be a
 *   numeric database ID or a string identifier depending on the table's PK type.
 * @param options - Optional query parameters forwarded verbatim to the server.
 * @param options.tableVariant - JSON-encoded backend variant with `type` and `id`.
 * @param options.includeAssociations - When `true`, associated child records are embedded.
 * @param options.queryJoins - JSON-encoded query join descriptors to include.
 * @returns The matching `QRecord`.
 */
export async function getRecord(
  tableName: string,
  primaryKey: string | number,
  options?: {
    tableVariant?: string
    includeAssociations?: boolean
    queryJoins?: string
  }
): Promise<QRecord> {
  const baseURL = legacyBaseURL()
  const result = await apiClient.get<QRecord>(`/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(primaryKey))}`, {
    baseURL,
    params: options,
  })
  if (!result || typeof result !== 'object' || typeof result.tableName !== 'string' ||
    !result.values || typeof result.values !== 'object' || Array.isArray(result.values)) {
    throw new Error('Invalid record response')
  }
  return result
}

/**
 * Preserve the configured host and deployment prefix for legacy CRUD routes.
 * @returns The configured base URL without the V1 route suffix.
 */
function legacyBaseURL() {
  return apiClient.getInstance().defaults.baseURL?.replace(/\/qqq\/v1\/?$/, '')
}

/**
 * Encode the legacy multipart field contract without coercing objects to unusable text.
 * @param values - Declared field values to save.
 * @returns Multipart fields, preserving explicit clears and omitted values.
 */
function recordFormData(values: Record<string, unknown>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue
    if (value instanceof File) {
      formData.append(key, value)
    } else if (value === null) {
      // The legacy multipart endpoint treats an empty field as an explicit clear.
      formData.append(key, '')
    } else if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value))
    } else if (typeof value === 'object') {
      throw new Error(`Invalid field value for ${key}`)
    } else {
      formData.append(key, String(value))
    }
  }
  return formData
}

const WriteRecordResponseSchema = z.object({ records: z.array(QRecordSchema).length(1) })
const DeleteRecordResponseSchema = z.object({
  deletedRecordCount: z.literal(1),
  recordsWithErrors: z.array(z.unknown()).length(0).nullish(),
})

/**
 * Reject partial association failures before announcing a successful save.
 * @param record - A validated response record and any returned children.
 */
function checkRecordErrors(record: QRecord): void {
  if (record.errors?.length) throw new Error(record.errors.join('; '))
  for (const records of Object.values(record.associatedRecords ?? {})) {
    for (const child of records) checkRecordErrors(child)
  }
}

/**
 * Validate the legacy write envelope and surface record errors.
 * @param response - Untrusted response body.
 * @param tableName - Expected backend table identifier.
 * @returns The single saved record.
 */
function savedRecord(response: unknown, tableName: string): QRecord {
  const parsed = WriteRecordResponseSchema.safeParse(response)
  if (!parsed.success || parsed.data.records[0].tableName !== tableName) {
    throw new Error('Invalid saved record response')
  }
  const record = parsed.data.records[0]
  checkRecordErrors(record)
  return record
}

/**
 * Creates a record through legacy `POST /data/{tableName}`.
 * Files remain binary, arrays are JSON, null clears a field and undefined is omitted.
 * Resolves only when exactly one valid record is returned without record errors.
 * @param tableName - Exact backend table identifier.
 * @param values - Field values to save.
 * @param associations - Exact named descendants using the explicit recursive wire format.
 * @returns The validated saved record.
 */
export async function insertRecord(
  tableName: string,
  values: Record<string, unknown>,
  associations?: Record<string, QRecordInput[]>
): Promise<QRecord> {
  const formData = recordFormData(values)
  if (associations !== undefined) formData.set('associations', JSON.stringify(await associationWireValues(associations)))
  const response = await apiClient.post(`/data/${encodeURIComponent(tableName)}`, formData, {
    baseURL: legacyBaseURL(),
    headers: { 'Content-Type': 'multipart/form-data', ...(associations !== undefined ? { 'X-QQQ-Association-Format': 'record-v1' } : {}) },
  })
  return savedRecord(response, tableName)
}

/**
 * Updates a record through legacy PUT, using the same value rules as insert.
 * @param tableName - Exact backend table identifier.
 * @param primaryKey - Record identifier, encoded as one path segment.
 * @param values - Field values to change; undefined fields remain untouched.
 * @returns The validated saved record.
 */
export async function updateRecord(
  tableName: string,
  primaryKey: string | number,
  values: Record<string, unknown>
): Promise<QRecord> {
  const response = await apiClient.put(
    `/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(primaryKey))}`,
    recordFormData(values),
    { baseURL: legacyBaseURL(), headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return savedRecord(response, tableName)
}

/**
 * Deletes a record through legacy DELETE and requires one confirmed deletion.
 * @param tableName - Exact backend table identifier.
 * @param primaryKey - Record identifier, encoded as one path segment.
 * @returns The confirmed deletion count.
 */
export async function deleteRecord(
  tableName: string,
  primaryKey: string | number
): Promise<DeleteRecordResponse> {
  const response = await apiClient.delete(
    `/data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(primaryKey))}`,
    { baseURL: legacyBaseURL() }
  )
  const parsed = DeleteRecordResponseSchema.safeParse(response)
  if (!parsed.success) throw new Error('Invalid delete response: record deletion was not confirmed')
  return { deletedCount: parsed.data.deletedRecordCount }
}

/**
 * Single result entry returned by the global search endpoint.
 */
export interface GlobalSearchResult {
  /** Backend-registered name of the table containing this result. */
  tableName: string
  /** Human-readable label for the table. Omitted by some backends when the table has no display label configured. */
  tableLabel?: string
  /** Primary key of the matching record, serialised as a string. */
  recordId: string
  /** Human-readable label for the matching record. */
  recordLabel: string
}

/**
 * Global search across tables. Posts to /search endpoint.
 * Falls back to empty results if the endpoint returns 404.
 *
 * Sends `searchTerm` and an optional list of `tableNames` to scope the search.
 * A 404 response is swallowed and returns an empty array because the `/search`
 * endpoint is optional — backends that do not implement it return 404.
 * All other errors are re-thrown.
 *
 * @param searchTerm - Free-text query string to search for.
 * @param tableNames - Optional list of table names to restrict the search scope.
 * @returns Array of matching result entries, or an empty array when the endpoint is absent.
 */
export async function globalSearch(
  searchTerm: string,
  tableNames: string[] = []
): Promise<GlobalSearchResult[]> {
  try {
    const result = await apiClient.post<GlobalSearchResult[]>('/search', {
      searchTerm,
      tableNames,
    })
    const parsed = GlobalSearchResponseSchema.safeParse(result)
    if (!parsed.success) {
      console.warn('[API] GlobalSearch response failed schema validation:', parsed.error.flatten())
    }
    return parsed.success ? parsed.data : result
  } catch (err) {
    // Only swallow 404 — the search endpoint is optional
    if (isAxiosError(err) && err.response?.status === 404) return []
    throw err
  }
}

/**
 * Preserve binary values without guessing field types in the recursive wire tree.
 * @param groups - Exact named child records prepared by the form.
 * @returns JSON-safe values, including explicit BLOB tags.
 */
async function associationWireValues(groups: Record<string, QRecordInput[]>): Promise<unknown> {
  let count = 0
  /**
   * Encode one bounded level without sending any partial request.
   * @param input - Named records at this level.
   * @param depth - Association depth, excluding the root record.
   * @returns JSON-safe exact groups.
   */
  async function encode(input: Record<string, QRecordInput[]>, depth: number): Promise<unknown> {
    if (depth > 64 && Object.values(input).some(records => records.length > 0)) throw new Error('Full copy exceeds 64 association levels.')
    return Object.fromEntries(await Promise.all(Object.entries(input).map(async ([name, records]) => [name, await Promise.all(records.map(async record => {
      if (++count > 1000) throw new Error('Full copy exceeds 1000 associated records.')
      const values = Object.fromEntries(await Promise.all(Object.entries(record.values).filter(([, value]) => value !== undefined).map(async ([field, value]) => {
        if (value instanceof File) {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result).split(',')[1])
            reader.onerror = () => reject(new Error('Could not read a copied file.'))
            reader.readAsDataURL(value)
          })
          return [field, { base64 }]
        }
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) throw new Error(`Invalid associated field value for ${field}`)
        return [field, value]
      })))
      return { values, ...(record.associatedRecords !== undefined ? { associatedRecords: await encode(record.associatedRecords, depth + 1) } : {}) }
    }))])))
  }
  return encode(groups, 1)
}
