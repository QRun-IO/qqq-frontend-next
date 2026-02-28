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
 * schemas.ts — Zod runtime validation schemas for key QQQ API response shapes.
 *
 * These schemas are used at the API boundary to detect contract drift between the
 * frontend types and the actual backend responses.  All validations use `safeParse`
 * so a mismatch logs a warning but does NOT throw — the app continues to function
 * with whatever data the server returned.
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
 * `values` may contain any serialisable type; `displayValues`, when present,
 * contains pre-formatted strings ready for display in the UI.
 */
export const QRecordSchema = z.object({
  /** Raw field values keyed by field name. */
  values: z.record(z.unknown()),
  /** Pre-formatted display strings keyed by field name. */
  displayValues: z.record(z.string()).optional(),
}).passthrough()

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
// GlobalSearch — POST /search
// ---------------------------------------------------------------------------

/**
 * Zod schema for a single entry in the global search result array.
 *
 * `tableLabel` is optional because some backends omit it when the table
 * has no configured display label.
 */
export const GlobalSearchResultSchema = z.object({
  tableName: z.string(),
  tableLabel: z.string().optional(),
  recordId: z.string(),
  recordLabel: z.string(),
})

/**
 * Zod schema for the full global search response — an array of result entries.
 */
export const GlobalSearchResponseSchema = z.array(GlobalSearchResultSchema)

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
  /** Branding configuration. */
  branding: z.object({
    companyName: z.string(),
    companyUrl: z.string(),
    appName: z.string(),
  }),
})
