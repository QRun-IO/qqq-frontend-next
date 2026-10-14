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

/** @file Quick Search typeahead extension, normalized for the shared record search UI. */

import { z } from 'zod'

import apiClient from './client'
import type { RecordSearchResponse } from './record-search'

const SuggestItemSchema = z.object({
  recordId: z.string().min(1),
  label: z.string(),
  subtitle: z.string().nullish(),
})

const SuggestResponseSchema = z.object({
  query: z.string(),
  groups: z.array(z.object({
    tableName: z.string().min(1),
    tableLabel: z.string(),
    hasMore: z.boolean(),
    items: z.array(z.unknown()),
  })),
  truncated: z.boolean(),
})

/** Scope, limits and cancellation for {@link suggestRecords}. */
export interface SuggestRecordsOptions {
  /** Searchable table metadata names; omitted means all eligible tables. */
  tableNames?: string[]
  /** Maximum items per table (server default 5). */
  limitPerTable?: number
  /** Maximum table groups (server default 8). */
  maxTables?: number
  /** Cancels a superseded request. */
  signal?: AbortSignal
}

/**
 * Fetches permission-filtered suggestions, skipping malformed items within valid groups.
 *
 * @param term - Free-text term (server normalizes whitespace and enforces length limits).
 * @param options - Table scope, limits and abort signal.
 * @returns Suggestions and per-table summaries in the shared record search shape.
 * @throws When the request fails, is aborted, or has a malformed response envelope.
 */
export async function suggestRecords(term: string, options: SuggestRecordsOptions = {}): Promise<RecordSearchResponse> {
  options.signal?.throwIfAborted()
  const raw = await apiClient.get<unknown>('/qbit/quick-search/suggest', {
    params: {
      q: term,
      ...(options.tableNames ? { tables: options.tableNames.join(',') } : {}),
      ...(options.limitPerTable !== undefined ? { limitPerTable: options.limitPerTable } : {}),
      ...(options.maxTables !== undefined ? { maxTables: options.maxTables } : {}),
    },
    signal: options.signal,
  })
  options.signal?.throwIfAborted()
  const response = SuggestResponseSchema.parse(raw)
  const groups = response.groups.map((group) => ({
    ...group,
    items: group.items.flatMap((rawItem) => {
      const item = SuggestItemSchema.safeParse(rawItem)
      return item.success ? [item.data] : []
    }),
  }))
  return {
    results: groups.flatMap((group) => group.items.map((item) => ({
      tableName: group.tableName,
      tableLabel: group.tableLabel,
      recordId: item.recordId,
      recordLabel: item.label,
      details: item.subtitle ? [{ fieldName: 'subtitle', displayValue: item.subtitle }] : [],
    }))),
    tables: groups.map((group) => ({
      tableName: group.tableName,
      tableLabel: group.tableLabel,
      resultCount: group.items.length,
      hasMore: group.hasMore,
      source: 'PROVIDER',
    })),
  }
}
