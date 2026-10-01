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
 * @file record-search — which tables the backend can search (from metadata) and
 * where a record search result links to. Record search is a backend capability:
 * a table is searchable only when its metadata lists `searchFields`.
 */

import type { QInstance } from '@/types'
import type { RecordSearchResult } from '@/lib/api/tables'

/** Shortest term sent to record search (shorter terms still match pages locally). */
export const MIN_RECORD_SEARCH_LENGTH = 2

/** A table the current user can search. */
export interface SearchableTable {
  /** Backend table name. */
  name: string
  /** Metadata label. */
  label: string
}

/**
 * Tables that record search covers for this user: tables whose metadata lists
 * search fields, that the user may read and that are not hidden. An empty list
 * means the backend has no record search capability for this user, and no
 * search request may be made.
 *
 * @param metaData - Instance metadata, or `undefined` while loading.
 * @returns Searchable tables in metadata order.
 */
export function searchableTables(metaData: QInstance | undefined): SearchableTable[] {
  return Object.values(metaData?.tables ?? {})
    .filter((table) => (table.searchFields?.length ?? 0) > 0 && table.readPermission !== false && table.isHidden !== true)
    .map((table) => ({ name: table.name, label: table.label }))
}

/**
 * Whether a term is long enough to send to record search.
 *
 * @param term - Raw search text.
 * @returns `true` when the trimmed term has at least {@link MIN_RECORD_SEARCH_LENGTH} characters.
 */
export function isRecordSearchTerm(term: string): boolean {
  return term.trim().length >= MIN_RECORD_SEARCH_LENGTH
}

/**
 * The record view path for a search result.
 *
 * @param result - A record search result.
 * @returns `/app/{tableName}/{recordId}`, with both segments URL-encoded.
 */
export function recordSearchResultPath(result: RecordSearchResult): string {
  return `/app/${encodeURIComponent(result.tableName)}/${encodeURIComponent(result.recordId)}`
}
