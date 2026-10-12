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
 * @file record-search API — `POST /search` (QQQ v1 record search). Every backend returns
 * each match's table, id and label; backends with the extended contract also return a
 * relevance score, plain-text highlights with match ranges, secondary field values, the
 * record's modify date, per-table summaries (counts, more-available, source) and the
 * status of the search provider (so a UI can say when an index failed and it is showing
 * fallback matches). Every extension field is optional.
 */

import { z } from 'zod'

import apiClient from './client'

// The response schemas live here, not in ./schemas: only record search uses them, and
// keeping them out of the shared module keeps them out of every screen's chunks.

/** A `[start, end)` character range of a match inside a highlight's text. */
const RecordSearchMatchSchema = z.object({ start: z.number().int().nonnegative(), end: z.number().int().nonnegative() })

/**
 * One highlighted field of a record search result: plain text (never HTML) plus the
 * ranges that matched the search term.
 */
export const RecordSearchHighlightSchema = z.object({
  fieldName: z.string(),
  fieldLabel: z.string().nullish(),
  text: z.string(),
  matches: z.array(RecordSearchMatchSchema).nullish(),
})

/** A secondary (non-matching) field value shown under a result's label. */
export const RecordSearchDetailSchema = z.object({
  fieldName: z.string(),
  fieldLabel: z.string().nullish(),
  displayValue: z.string(),
})

/**
 * Zod schema for one record search result. `tableName` and `recordId` are required (a
 * result cannot link anywhere without them); `recordId` may arrive as a number. Labels may
 * be missing, null or empty: QQQ leaves empty values out of its JSON, so a record whose
 * label fields are empty arrives without `recordLabel`, and callers label it themselves.
 * The extension fields (score, highlights, details, updatedAt) are optional, and a
 * malformed one is dropped (`catch`) instead of failing the result.
 */
export const RecordSearchResultSchema = z.object({
  tableName: z.string().min(1),
  tableLabel: z.string().nullish().transform((value) => value || undefined),
  recordId: z.union([z.string().min(1), z.number()]).transform(String),
  recordLabel: z.string().nullish().transform((value) => value || undefined),
  score: z.number().nullish().catch(undefined),
  updatedAt: z.string().nullish().catch(undefined),
  highlights: z.array(RecordSearchHighlightSchema).nullish().catch(undefined),
  details: z.array(RecordSearchDetailSchema).nullish().catch(undefined),
})

/** Per-table summary of a record search (newer backends). */
export const RecordSearchTableSchema = z.object({
  tableName: z.string(),
  tableLabel: z.string().nullish(),
  resultCount: z.number().nullish(),
  hasMore: z.boolean().nullish(),
  totalCount: z.number().nullish(),
  source: z.string().nullish(),
})

/** Status of the instance's record search provider (e.g. a search index), newer backends. */
export const RecordSearchProviderStatusSchema = z.object({
  status: z.string(),
  failureClass: z.string().nullish(),
  message: z.string().nullish(),
})

/**
 * Zod schema for the record search response: `{ results: [...] }`, plus the optional
 * per-table summaries and provider status of newer backends. Each result is validated
 * separately ({@link RecordSearchResultSchema}), so one malformed result is skipped
 * rather than failing the whole search.
 */
export const RecordSearchResponseSchema = z.object({
  results: z.array(z.unknown()),
  tables: z.array(RecordSearchTableSchema).nullish().catch(undefined),
  provider: RecordSearchProviderStatusSchema.nullish().catch(undefined),
})

/** A `[start, end)` character range of a match inside a highlight's text. */
export interface RecordSearchMatch {
  /** Offset of the first matched character. */
  start: number
  /** Offset just past the last matched character. */
  end: number
}

/** One highlighted field of a record search result (plain text, never HTML). */
export interface RecordSearchHighlight {
  /** Backend field name. */
  fieldName: string
  /** Field label, when the backend sent one. */
  fieldLabel?: string
  /** Plain-text snippet of the field value. */
  text: string
  /** Matched ranges inside `text` (validated: in bounds, sorted, non-overlapping). */
  matches: RecordSearchMatch[]
}

/** A secondary field value of a record search result. */
export interface RecordSearchDetail {
  /** Backend field name. */
  fieldName: string
  /** Field label, when the backend sent one. */
  fieldLabel?: string
  /** Display value. */
  displayValue: string
}

/**
 * One record matched by record search. Only the table, id and label come from every
 * backend; the rest come from backends with the extended contract.
 */
export interface RecordSearchResult {
  /** Backend-registered name of the table containing this record. */
  tableName: string
  /** User-facing label of the table. */
  tableLabel?: string
  /** Primary key of the matching record, serialised as a string. */
  recordId: string
  /** User-facing label of the matching record (falls back to `{table} {id}`). */
  recordLabel: string
  /** Provider relevance score (higher is better); absent for the default search. */
  score?: number
  /** When the record was last modified (ISO-8601), when the table has a visible modify date. */
  updatedAt?: string
  /** Fields that matched, as plain-text snippets with match ranges. */
  highlights?: RecordSearchHighlight[]
  /** Secondary field values (not matched, not part of the label). */
  details?: RecordSearchDetail[]
}

/** Where a table's results came from: the provider, the default search, or the default search after the provider failed. */
export type RecordSearchSource = 'PROVIDER' | 'DEFAULT' | 'FALLBACK'

/** Per-table summary of a record search (extended contract). */
export interface RecordSearchTableSummary {
  /** Backend table name. */
  tableName: string
  /** Table label. */
  tableLabel?: string
  /** Results returned for the table. */
  resultCount?: number
  /** Whether the table has more matches than were returned. */
  hasMore?: boolean
  /** Total matches, when known (approximate when it comes from a search index). */
  totalCount?: number
  /** Which search produced the table's results. */
  source?: string
}

/** Status of the instance's record search provider (extended contract). */
export interface RecordSearchProviderStatus {
  /** `OK`, `FAILED` (its tables fell back to the default search) or `NONE`. */
  status: string
  /** Simple class name of the provider's failure, e.g. `ConnectException`. */
  failureClass?: string
  /** Short failure message. */
  message?: string
}

/** A record search response. */
export interface RecordSearchResponse {
  /** Matching records, grouped by table in backend order. */
  results: RecordSearchResult[]
  /** Per-table summaries (extended contract; absent from older backends). */
  tables?: RecordSearchTableSummary[]
  /** Provider status (extended contract; absent from older backends). */
  provider?: RecordSearchProviderStatus
}

/** Result order requested from record search. */
export type RecordSearchSort = 'relevance' | 'recent'

/** Options for {@link searchRecords}. */
export interface RecordSearchOptions {
  /** Tables to search; when omitted the backend searches every searchable table the user may read. */
  tableNames?: string[]
  /** Maximum records per table (the backend caps it, at 25 in QQQ 4.1). */
  limitPerTable?: number
  /** Records to skip per table (paging one table; ignored by older backends). */
  offset?: number
  /** Requested order (ignored by older backends, which order by relevance or primary key). */
  sort?: RecordSearchSort
  /** Aborts the request (a newer search superseded it). */
  signal?: AbortSignal
}

/** The record search response did not have the expected shape. */
export class RecordSearchResponseError extends Error {
  /** Creates the error. */
  constructor() {
    super('Invalid record search response')
    this.name = 'RecordSearchResponseError'
  }
}

/**
 * Drops match ranges that are out of bounds, empty, unsorted or overlapping.
 *
 * @param text - Highlight text.
 * @param matches - Ranges from the backend.
 * @returns The valid ranges, in order.
 */
export function validMatches(text: string, matches: RecordSearchMatch[] | null | undefined): RecordSearchMatch[] {
  const valid: RecordSearchMatch[] = []
  let floor = 0
  for (const match of matches ?? []) {
    if (match.start < floor || match.end <= match.start || match.end > text.length) continue
    valid.push({ start: match.start, end: match.end })
    floor = match.end
  }
  return valid
}

/**
 * Record search across tables: `POST /search` (QQQ v1). Call it only when the
 * metadata advertises searchable tables (`searchFields`); a backend without the
 * capability has no such endpoint, so every error is re-thrown.
 *
 * The backend matches the term against each table's declared search fields,
 * searches only the tables the session may read, and applies record security locks.
 * `offset` and `sort` are sent only when they differ from the defaults, so the
 * request body stays exactly what older backends expect.
 *
 * @param searchTerm - Free-text search term (the backend trims it).
 * @param options - Table scope, per-table limit, paging, order and abort signal.
 * A result without a record label is labeled "{table label} {record id}"; a result that
 * cannot link to a record (no table name or record id) is skipped with a console warning.
 *
 * @returns Matching records (grouped by table in backend order), plus per-table summaries and provider status when the backend sends them.
 * @throws When the request fails (an `AxiosError`, or a cancel when aborted) or the response is not a record search response ({@link RecordSearchResponseError}).
 */
export async function searchRecords(searchTerm: string, options: RecordSearchOptions = {}): Promise<RecordSearchResponse> {
  const body = {
    searchTerm,
    ...(options.tableNames ? { tableNames: options.tableNames } : {}),
    ...(options.limitPerTable ? { limitPerTable: options.limitPerTable } : {}),
    ...(options.offset ? { offset: options.offset } : {}),
    ...(options.sort === 'recent' ? { sort: 'RECENT' } : {}),
  }
  const raw = options.signal
    ? await apiClient.post<unknown>('/search', body, { signal: options.signal })
    : await apiClient.post<unknown>('/search', body)
  const parsed = RecordSearchResponseSchema.safeParse(raw)
  if (!parsed.success) throw new RecordSearchResponseError()
  const { tables, provider } = parsed.data
  const results = parsed.data.results.flatMap((raw) => {
    const result = RecordSearchResultSchema.safeParse(raw)
    return result.success ? [result.data] : []
  })
  const skipped = parsed.data.results.length - results.length
  if (skipped > 0) console.warn(`Record search: skipped ${skipped} malformed result(s) without a table name or record id`)
  return {
    results: results.map((item) => ({
      tableName: item.tableName,
      tableLabel: item.tableLabel ?? undefined,
      recordId: item.recordId,
      recordLabel: item.recordLabel?.trim() || `${item.tableLabel ?? item.tableName} ${item.recordId}`,
      score: item.score ?? undefined,
      updatedAt: item.updatedAt ?? undefined,
      highlights: item.highlights?.map((highlight) => ({
        fieldName: highlight.fieldName,
        fieldLabel: highlight.fieldLabel ?? undefined,
        text: highlight.text,
        matches: validMatches(highlight.text, highlight.matches),
      })),
      details: item.details?.map((detail) => ({ fieldName: detail.fieldName, fieldLabel: detail.fieldLabel ?? undefined, displayValue: detail.displayValue })),
    })),
    tables: tables?.map((table) => ({
      tableName: table.tableName,
      tableLabel: table.tableLabel ?? undefined,
      resultCount: table.resultCount ?? undefined,
      hasMore: table.hasMore ?? undefined,
      totalCount: table.totalCount ?? undefined,
      source: table.source ?? undefined,
    })),
    provider: provider ? { status: provider.status, failureClass: provider.failureClass ?? undefined, message: provider.message ?? undefined } : undefined,
  }
}
