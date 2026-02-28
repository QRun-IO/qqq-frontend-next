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

/** query-client — TanStack Query v5 client configuration and centralized query key factory */

import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query'

/**
 * Singleton TanStack Query client shared across the application.
 *
 * Configured with conservative defaults suitable for a metadata-driven admin UI:
 * - 5-minute stale time so metadata and record lists stay fresh without excessive refetching.
 * - 10-minute GC time keeps recently visited pages snappy when navigating back.
 * - Single retry for queries; zero retries for mutations (mutations should be idempotent or surfaced to the user).
 * - Pending queries are included in dehydration so SSR can pass them to the client shell.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes default
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
    dehydrate: {
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
    },
  },
})

/**
 * Centralized query key factory for all TanStack Query cache entries.
 *
 * Using a factory ensures consistent, hierarchical keys across components so that:
 * - Broad invalidations (e.g. `queryKeys.records()`) cascade to all table-scoped queries.
 * - Narrow invalidations (e.g. `queryKeys.tableRecord('order', 42)`) only bust one entry.
 *
 * Key structure (from broadest to narrowest):
 * - `['qqq']` — root namespace
 * - `['qqq', 'auth', ...]` — authentication / session queries
 * - `['qqq', 'metadata', ...]` — metadata queries (tables, processes)
 * - `['qqq', 'records', tableName, ...]` — record list and count queries
 * - `['qqq', 'processes', processName, processUUID, ...]` — process status polling
 * - `['qqq', 'widgets', widgetName, ...]` — widget data queries
 * - `['qqq', 'possibleValues', ...]` — possible-value / enum queries
 * - `['qqq', 'search', ...]` — global search queries
 */
export const queryKeys = {
  /** Root namespace key shared by all QQQ queries. */
  all: () => ['qqq'] as const,

  // Auth
  /** Key for auth-scoped queries. */
  auth: () => [...queryKeys.all(), 'auth'] as const,
  /** Key for the current session metadata (e.g. user info, permissions). */
  authMeta: () => [...queryKeys.auth(), 'metadata'] as const,

  // Metadata
  /** Key for all metadata queries. */
  metadata: () => [...queryKeys.all(), 'metadata'] as const,
  /** Key for the full application metadata payload (all tables + processes). */
  metadataAll: () => [...queryKeys.metadata(), 'all'] as const,
  /**
   * Key for a single table's metadata.
   *
   * @param tableName - Backend table name (e.g. `"order"`).
   */
  tableMetadata: (tableName: string) =>
    [...queryKeys.metadata(), 'table', tableName] as const,
  /**
   * Key for a single process's metadata.
   *
   * @param processName - Backend process name (e.g. `"importOrders"`).
   */
  processMetadata: (processName: string) =>
    [...queryKeys.metadata(), 'process', processName] as const,

  // Records
  /** Key for all record queries (parent of all table record keys). */
  records: () => [...queryKeys.all(), 'records'] as const,
  /**
   * Key for all records belonging to a specific table.
   *
   * @param tableName - Backend table name.
   */
  tableRecords: (tableName: string) => [...queryKeys.records(), tableName] as const,
  /**
   * Key for a single record identified by its primary key.
   *
   * @param tableName - Backend table name.
   * @param id - Primary key value (string or number).
   */
  tableRecord: (tableName: string, id: string | number) =>
    [...queryKeys.tableRecords(tableName), id] as const,
  /**
   * Key for a count query scoped to a specific filter.
   *
   * @param tableName - Backend table name.
   * @param filterHash - Stable serialized representation of the active filter.
   */
  tableCount: (tableName: string, filterHash: string) =>
    [...queryKeys.tableRecords(tableName), 'count', filterHash] as const,

  // Processes
  /** Key for all process queries (parent of all process status keys). */
  processes: () => [...queryKeys.all(), 'processes'] as const,
  /**
   * Key for a process job status poll.
   *
   * Includes both `processUUID` and `jobUUID` so each async job gets its own
   * cache slot and polling interval, preventing stale data from a prior job
   * bleeding into a new submission.
   *
   * @param processName - Backend process name.
   * @param processUUID - Server-assigned session UUID for the process instance.
   * @param jobUUID - Server-assigned UUID for the specific async job being polled.
   */
  processStatus: (processName: string, processUUID: string, jobUUID: string) =>
    [...queryKeys.processes(), processName, processUUID, 'status', jobUUID] as const,

  // Widgets
  /** Key for all widget data queries (parent of all widget keys). */
  widgets: () => [...queryKeys.all(), 'widgets'] as const,
  /**
   * Key for a widget's data payload.
   *
   * Parameter keys are sorted alphabetically before inclusion so that
   * `{ b: 2, a: 1 }` and `{ a: 1, b: 2 }` produce the same cache entry (LOW-2).
   *
   * @param widgetName - Backend widget name.
   * @param params - Optional arbitrary query parameters forwarded to the widget API.
   */
  widgetData: (widgetName: string, params?: Record<string, unknown>) =>
    [...queryKeys.widgets(), widgetName, params ? Object.fromEntries(Object.entries(params).sort()) : undefined] as const,

  // Possible Values
  /** Key for all possible-value queries (parent of all PV keys). */
  possibleValues: () => [...queryKeys.all(), 'possibleValues'] as const,
  /**
   * Key for a field's possible-value list, optionally filtered by a search term.
   *
   * @param tableName - Backend table name.
   * @param fieldName - Field whose enum/possible values are being fetched.
   * @param searchTerm - Optional type-ahead search string.
   */
  tablePossibleValues: (tableName: string, fieldName: string, searchTerm?: string) =>
    [...queryKeys.possibleValues(), 'table', tableName, fieldName, searchTerm] as const,

  // Audits
  /**
   * Key for the audit log of a specific record.
   *
   * Scoped under the record key so invalidating the record also invalidates its audits.
   *
   * @param tableName - Backend table name.
   * @param primaryKey - Primary key of the record.
   */
  audits: (tableName: string, primaryKey: string | number) =>
    [...queryKeys.tableRecord(tableName, primaryKey), 'audits'] as const,

  // Search
  /** Key for all global search queries. */
  search: () => [...queryKeys.all(), 'search'] as const,
  /**
   * Key for a global search result set.
   *
   * @param searchTerm - The user's search string.
   */
  globalSearch: (searchTerm: string) =>
    [...queryKeys.search(), searchTerm] as const,
}
