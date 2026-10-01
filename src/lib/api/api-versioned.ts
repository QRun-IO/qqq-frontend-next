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
 * @file API-versioned table routes — the v1 table metadata, query and count endpoints served
 * under an application API's path and version (`/qqq/v1/{apiPath}/{apiVersion}/...`, the
 * `qqq-middleware-api` `ApiAwareMiddlewareVersionV1`). They answer with the table as that API
 * version exposes it (API field names and the fields the version includes), as Material's
 * `QControllerV1` does when given an `ApiVersion`.
 */

import type { QTableMetaData } from '@/types'
import apiClient from './client'
import type { CountRecordsResponse, QueryRecordsRequest, QueryRecordsResponse } from './tables'
import { CountRecordsResponseSchema, QueryRecordsResponseSchema } from './schemas'

/** An application API version (Material `ApiVersion`): the API's name, URL path and version. */
export interface ApiVersionRef {
  /** API name (`ApiInstanceMetaData` name). */
  name: string
  /** API URL path, e.g. `person-api` (slashes around it are ignored). */
  path: string
  /** API version, e.g. `2023.Q1`. */
  version: string
}

/**
 * The route prefix for an API version: `/{path}/{version}`, with slashes around each part
 * trimmed (as the backend registers them) and each path segment URL-encoded.
 *
 * @param api - The API version.
 * @returns The prefix, e.g. `/person-api/2023.Q1`.
 */
export function apiVersionPrefix(api: ApiVersionRef): string {
  const segments = (value: string) =>
    value
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
  return `/${[...segments(api.path), ...segments(api.version)].join('/')}`
}

/**
 * Loads a table's metadata as an API version exposes it, from
 * `GET /{apiPath}/{apiVersion}/metaData/table/{tableName}`.
 *
 * @param api - The API version.
 * @param tableName - Backend table name.
 * @returns The table metadata.
 */
export async function loadApiTableMetaData(api: ApiVersionRef, tableName: string): Promise<QTableMetaData> {
  return apiClient.get<QTableMetaData>(`${apiVersionPrefix(api)}/metaData/table/${encodeURIComponent(tableName)}`)
}

/**
 * Queries a table through an API version, `POST /{apiPath}/{apiVersion}/table/{tableName}/query`
 * (the same body as `queryRecords` in `tables.ts`).
 *
 * @param api - The API version.
 * @param tableName - Backend table name.
 * @param request - Filter (criteria, sort, paging) and joins.
 * @returns The matching records.
 */
export async function queryApiRecords(api: ApiVersionRef, tableName: string, request: QueryRecordsRequest): Promise<QueryRecordsResponse> {
  const result = await apiClient.post<QueryRecordsResponse>(`${apiVersionPrefix(api)}/table/${encodeURIComponent(tableName)}/query`, request)
  const parsed = QueryRecordsResponseSchema.safeParse(result)
  if (!parsed.success) {
    console.warn('[API] API-versioned query response failed schema validation:', parsed.error.flatten())
  }
  return parsed.success ? parsed.data : result
}

/**
 * Counts a table's records through an API version,
 * `POST /{apiPath}/{apiVersion}/table/{tableName}/count`.
 *
 * @param api - The API version.
 * @param tableName - Backend table name.
 * @param request - Filter and joins.
 * @param includeDistinct - When true the response also has `distinctCount`.
 * @returns The count.
 */
export async function countApiRecords(
  api: ApiVersionRef,
  tableName: string,
  request: QueryRecordsRequest,
  includeDistinct = false
): Promise<CountRecordsResponse> {
  const result = await apiClient.post<CountRecordsResponse>(`${apiVersionPrefix(api)}/table/${encodeURIComponent(tableName)}/count`, request, {
    params: { includeDistinct },
  })
  const parsed = CountRecordsResponseSchema.safeParse(result)
  if (!parsed.success) {
    console.warn('[API] API-versioned count response failed schema validation:', parsed.error.flatten())
  }
  return parsed.success ? parsed.data : result
}
