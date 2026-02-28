/** Tables API — CRUD, query, count, global search, and audit endpoints for QQQ table records. */

import { isAxiosError } from 'axios'

import type { QRecord, QQueryFilter, QueryJoin, QAuditRecord } from '@/types'
import apiClient from './client'
import {
  QueryRecordsResponseSchema,
  CountRecordsResponseSchema,
  GlobalSearchResponseSchema,
} from './schemas'

/**
 * Request body shape accepted by the query and count endpoints.
 */
export interface QueryRecordsRequest {
  /** Filter criteria (criteria list, order-by, skip/limit) to apply to the query. */
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
 * Response body returned by `DELETE /table/{tableName}/{primaryKey}`.
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
 * @param tableName - Backend-registered table name.
 * @param request - Filter criteria and optional join / variant configuration.
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
  return parsed.success ? (parsed.data as unknown as QueryRecordsResponse) : result
}

/**
 * Counts records in a table via `POST /table/{tableName}/count`.
 *
 * Accepts the same filter body as {@link queryRecords} and optionally returns a
 * distinct count when `includeDistinct` is `true`.
 *
 * @param tableName - Backend-registered table name.
 * @param request - Filter criteria and optional join / variant configuration.
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
 * Fetches a single record by primary key via `GET /table/{tableName}/{primaryKey}`.
 *
 * Optional flags control whether associations and joined-table data are included
 * in the response.
 *
 * @param tableName - Backend-registered table name.
 * @param primaryKey - Primary key value of the record to retrieve.
 * @param options - Optional query parameters forwarded verbatim to the server.
 * @param options.tableVariant - Alternate backend table configuration to use.
 * @param options.includeAssociations - When `true`, associated child records are embedded.
 * @param options.queryJoins - Comma-separated join names to include.
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
  return apiClient.get<QRecord>(`/table/${encodeURIComponent(tableName)}/${primaryKey}`, {
    params: options,
  })
}

/**
 * Creates a new record via `POST /table/{tableName}` using multipart/form-data.
 *
 * Each value in `values` is appended to the form:
 * - `File` instances are appended as binary parts.
 * - Arrays are JSON-stringified before appending.
 * - All other values are coerced to strings.
 * - `null` and `undefined` values are omitted.
 *
 * @param tableName - Backend-registered table name.
 * @param values - Map of field names to their new values.
 * @returns The newly created `QRecord` as returned by the server.
 */
export async function insertRecord(
  tableName: string,
  values: Record<string, unknown>
): Promise<QRecord> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue
    if (value instanceof File) {
      formData.append(key, value)
    } else if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value))
    } else {
      formData.append(key, String(value))
    }
  }
  return apiClient.post<QRecord>(`/table/${encodeURIComponent(tableName)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/**
 * Updates an existing record via `PUT /table/{tableName}/{primaryKey}` using multipart/form-data.
 *
 * Follows the same value serialization rules as {@link insertRecord}:
 * `File` → binary part, arrays → JSON string, others → string, null/undefined → omitted.
 *
 * @param tableName - Backend-registered table name.
 * @param primaryKey - Primary key of the record to update.
 * @param values - Map of field names to their updated values.
 * @returns The updated `QRecord` as returned by the server.
 */
export async function updateRecord(
  tableName: string,
  primaryKey: string | number,
  values: Record<string, unknown>
): Promise<QRecord> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue
    if (value instanceof File) {
      formData.append(key, value)
    } else if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value))
    } else {
      formData.append(key, String(value))
    }
  }
  return apiClient.put<QRecord>(
    `/table/${encodeURIComponent(tableName)}/${primaryKey}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

/**
 * Deletes a single record via `DELETE /table/{tableName}/{primaryKey}`.
 *
 * @param tableName - Backend-registered table name.
 * @param primaryKey - Primary key of the record to delete.
 * @returns An object containing the number of records that were deleted.
 */
export async function deleteRecord(
  tableName: string,
  primaryKey: string | number
): Promise<DeleteRecordResponse> {
  return apiClient.delete<DeleteRecordResponse>(
    `/table/${encodeURIComponent(tableName)}/${primaryKey}`
  )
}

/**
 * Single result entry returned by the global search endpoint.
 */
export interface GlobalSearchResult {
  /** Backend-registered name of the table containing this result. */
  tableName: string
  /** Human-readable label for the table. */
  tableLabel: string
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
    return parsed.success ? (parsed.data as GlobalSearchResult[]) : result
  } catch (err) {
    // Only swallow 404 — the search endpoint is optional
    if (isAxiosError(err) && err.response?.status === 404) return []
    throw err
  }
}

/**
 * Response body returned by the audits endpoint.
 */
export interface AuditRecordsResponse {
  /** Ordered list of audit log entries for the requested record. */
  records: QAuditRecord[]
}

/**
 * Fetches the audit log for a single record via `GET /table/{tableName}/{primaryKey}/audits`.
 *
 * @param tableName - Backend-registered table name.
 * @param primaryKey - Primary key of the record whose audit trail to retrieve.
 * @returns An array of audit log entries in reverse-chronological order.
 */
export async function getAuditRecords(
  tableName: string,
  primaryKey: string | number
): Promise<QAuditRecord[]> {
  const response = await apiClient.get<AuditRecordsResponse>(
    `/table/${encodeURIComponent(tableName)}/${primaryKey}/audits`
  )
  return response.records
}
