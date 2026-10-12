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
 * @file schemas.ts — Zod runtime validation schemas for key QQQ API response shapes.
 *
 * These schemas are used at the API boundary to detect contract drift between the
 * frontend types and the actual backend responses. Callers decide whether a
 * mismatch is a recoverable warning or must reject an invalid response.
 *
 * Only the highest-impact response shapes are validated here:
 *   - `QueryRecordsResponse` — drives the main data grid
 *   - `CountRecordsResponse` — controls pagination totals
 *   - `GlobalSearchResponse` — populates the command-palette search results
 *   - `QInstance` (minimal required fields) — the metadata backbone of the whole app
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// QRecord — individual record shape returned by query and get endpoints
// ---------------------------------------------------------------------------

/**
 * Zod schema for a single QQQ record.
 *
 * Mirrors the `QRecord` interface exactly so that `z.infer<typeof QRecordSchema>`
 * is structurally compatible with `QRecord` — eliminating the need for
 * `as unknown as` casts at call sites.
 *
 * `associatedRecords` is self-referential, so it uses `z.lazy` to break the
 * circular reference at schema-construction time.
 */
const StatusMessageSchema = z.union([z.string(), z.object({ message: z.string() })])
  .transform((status) => typeof status === 'string' ? status : status.message)

export const QRecordSchema: z.ZodType<import('@/types').QRecord, z.ZodTypeDef, unknown> = z.object({
  /** Name of the table this record belongs to. */
  tableName: z.string(),
  /** Human-readable label computed by the backend. */
  recordLabel: z.string().optional(),
  /** Raw field values keyed by field name. */
  values: z.record(z.unknown()),
  /** Pre-formatted display strings keyed by field name. */
  displayValues: z.record(z.string()).optional(),
  /** Optional map of relationship name → associated records for joined or child data. */
  associatedRecords: z.record(z.array(z.lazy(() => QRecordSchema))).optional(),
  /** Validation or server-side errors associated with this record. */
  errors: z.array(StatusMessageSchema).optional(),
  /** Non-fatal warnings associated with this record. */
  warnings: z.array(StatusMessageSchema).optional(),
})

// ---------------------------------------------------------------------------
// QueryRecords — POST /table/{name}/query
// ---------------------------------------------------------------------------

/**
 * Zod schema for the response body of `POST /table/{tableName}/query`.
 *
 * The critical invariant is that `records` is present and is an array.
 * Individual record shapes are validated by {@link QRecordSchema}.
 */
export const QueryRecordsResponseSchema = z.object({
  records: z.array(QRecordSchema),
})

// ---------------------------------------------------------------------------
// CountRecords — POST /table/{name}/count
// ---------------------------------------------------------------------------

/**
 * Zod schema for the response body of `POST /table/{tableName}/count`.
 *
 * `distinctCount` is optional and only present when the request included
 * `includeDistinct=true`.
 */
export const CountRecordsResponseSchema = z.object({
  count: z.number(),
  distinctCount: z.number().optional(),
})

// ---------------------------------------------------------------------------
// Record search — POST /search
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// QInstance — GET /metaData (minimal required-field validation)
// ---------------------------------------------------------------------------

/**
 * Zod schema for the minimal required fields of `QInstance`.
 *
 * Only top-level presence of the core maps is validated here; deep validation
 * of every table/process/widget would be prohibitively verbose and fragile.
 * The goal is to catch missing top-level keys that would break the entire app.
 */
export const QInstanceMinimalSchema = z.object({
  /** All registered apps (sidebar navigation source). */
  apps: z.record(z.unknown()),
  /** Navigation tree nodes. */
  appTree: z.array(z.unknown()),
  /** All registered tables (drives every record page). */
  tables: z.record(z.unknown()),
  /** All registered processes. */
  processes: z.record(z.unknown()),
  /** Branding configuration; every field is optional in QQQ branding, and branding itself may be absent. */
  branding: z.object({
    companyName: z.string().optional(),
    companyUrl: z.string().optional(),
    appName: z.string().optional(),
  }).optional(),
})
