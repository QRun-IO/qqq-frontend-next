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
 * @file query-client — TanStack Query v5 client configuration and centralized query key factory.
 */

import { QueryClient, QueryCache, MutationCache, defaultShouldDehydrateQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorStatusCode } from '@/lib/utils/error-utils'

/**
 * Returns a toast message for a query/mutation error based on HTTP status.
 *
 * 401 responses are silently ignored — the axios interceptor already redirects
 * to login, so surfacing a toast would be redundant and confusing.
 *
 * @param error - The unknown error thrown by the query or mutation.
 * @param context - `'query'` or `'mutation'` — selects message wording.
 */
function handleQueryError(error: unknown, context: 'query' | 'mutation'): void {
  const status = getErrorStatusCode(error)

  if (status === 401) {
    // Already handled by the axios interceptor (→ redirect to login).
    return
  }

  if (status === 403) {
    if (context === 'mutation') {
      toast.error('You do not have permission to perform this action')
    } else {
      toast.error('Permission denied')
    }
    return
  }

  if (status === 404) {
    toast.error('Resource not found')
    return
  }

  if (status !== undefined && status >= 500) {
    if (context === 'mutation') {
      toast.error('Server error — please try again')
    } else {
      toast.error('Server error — retrying…')
    }
    return
  }

  // Network failure (no status) or unexpected status codes.
  if (context === 'mutation') {
    toast.error('Something went wrong')
  } else {
    toast.error('Something went wrong')
  }
}

/**
 * Smart retry predicate for queries (mutations are never retried automatically).
 *
 * - Never retries 4xx client errors — these are deterministic failures.
 * - Retries server errors (5xx) and network failures up to 3 times with
 *   exponential back-off capped at 30 seconds.
 *
 * @param failureCount - Number of failed attempts so far (0-indexed for retryDelay, 1-indexed here).
 * @param error - The error from the most recent attempt.
 * @returns `true` when the request should be retried, `false` to stop retrying.
 */
function smartRetry(failureCount: number, error: unknown): boolean {
  const status = getErrorStatusCode(error)
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < 3
}

/**
 * Exponential back-off with a 30-second ceiling.
 *
 * Delays: 1 s → 2 s → 4 s → 8 s … capped at 30 s.
 *
 * @param attemptIndex - Zero-based attempt index (0 = first retry).
 * @returns Delay in milliseconds before the next retry attempt.
 */
function exponentialBackoff(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30_000)
}

/**
 * Singleton TanStack Query client shared across the application.
 *
 * Configured with conservative defaults suitable for a metadata-driven admin UI:
 * - 5-minute stale time so metadata and record lists stay fresh without excessive refetching.
 * - 10-minute GC time keeps recently visited pages snappy when navigating back.
 * - Smart query retry: never retries 4xx errors; retries server errors up to 3 times. Mutations are not retried.
 * - Global `QueryCache.onError` and `MutationCache.onError` surface toast notifications
 *   for all unhandled API errors without requiring per-call error handling.
 * - Pending queries are included in dehydration so SSR can pass them to the client shell.
 */
/**
 * Meta flag for queries and mutations whose component renders its own error state
 * (for example a record-not-found panel, a form error alert, or a widget's inline
 * error with a retry button). The global toast is
 * skipped for them so the user sees one accurate message instead of a generic duplicate.
 */
export const HANDLES_OWN_ERRORS = { handlesOwnErrors: true } as const

/**
 * Whether a query or mutation opted out of the global error toast.
 *
 * @param meta - The query or mutation `meta` object.
 * @returns `true` when `meta.handlesOwnErrors` is set.
 */
function handlesOwnErrors(meta: Record<string, unknown> | undefined): boolean {
  return meta?.handlesOwnErrors === true
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Queries that render their own error state (records, widgets) opt out with HANDLES_OWN_ERRORS.
    onError: (error, query) => {
      if (!handlesOwnErrors(query.meta)) handleQueryError(error, 'query')
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!handlesOwnErrors(mutation.meta)) handleQueryError(error, 'mutation')
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes default
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: smartRetry,
      retryDelay: exponentialBackoff,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Writes are not idempotent: a failed insert/process step is never re-sent
      // automatically (a retry after a lost response would duplicate the change).
      retry: false,
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
 * - `['qqq', 'esb', ...]` — ESB publications, triggers and counters
 */
export const queryKeys = {
  /**
   * Root namespace key shared by all QQQ queries.
   *
   * @returns The root query key tuple.
   */
  all: () => ['qqq'] as const,

  // Auth
  /**
   * Key for auth-scoped queries.
   *
   * @returns The auth namespace query key tuple.
   */
  auth: () => [...queryKeys.all(), 'auth'] as const,
  /**
   * Key for the current session metadata (e.g. user info, permissions).
   *
   * @returns The auth metadata query key tuple.
   */
  authMeta: () => [...queryKeys.auth(), 'metadata'] as const,

  // Metadata
  /**
   * Key for all metadata queries.
   *
   * @returns The metadata namespace query key tuple.
   */
  metadata: () => [...queryKeys.all(), 'metadata'] as const,
  /**
   * Key for the full application metadata payload (all tables + processes).
   *
   * @returns The full metadata query key tuple.
   */
  metadataAll: () => [...queryKeys.metadata(), 'all'] as const,
  /**
   * Key for a single table's metadata.
   *
   * @param tableName - Backend table name (e.g. `"order"`).
   * @returns The table metadata query key tuple.
   */
  tableMetadata: (tableName: string) =>
    [...queryKeys.metadata(), 'table', tableName] as const,
  /**
   * Key for a single process's metadata.
   *
   * @param processName - Backend process name (e.g. `"importOrders"`).
   * @returns The process metadata query key tuple.
   */
  processMetadata: (processName: string) =>
    [...queryKeys.metadata(), 'process', processName] as const,

  // Records
  /**
   * Key for all record queries (parent of all table record keys).
   *
   * @returns The records namespace query key tuple.
   */
  records: () => [...queryKeys.all(), 'records'] as const,
  /**
   * Key for all records belonging to a specific table.
   *
   * @param tableName - Backend table name.
   * @returns The table records query key tuple.
   */
  tableRecords: (tableName: string) => [...queryKeys.records(), tableName] as const,
  /**
   * Key for a single record identified by its primary key.
   *
   * @param tableName - Backend table name.
   * @param id - Primary key value (string or number).
   * @returns The single record query key tuple.
   */
  tableRecord: (tableName: string, id: string | number) =>
    [...queryKeys.tableRecords(tableName), String(id)] as const,
  /**
   * Key for a count query scoped to a specific filter.
   *
   * @param tableName - Backend table name.
   * @param filterHash - Stable serialized representation of the active filter.
   * @returns The count query key tuple.
   */
  tableCount: (tableName: string, filterHash: string) =>
    [...queryKeys.tableRecords(tableName), 'count', filterHash] as const,

  // Processes
  /**
   * Key for all process queries (parent of all process status keys).
   *
   * @returns The processes namespace query key tuple.
   */
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
   * @returns The process status query key tuple.
   */
  processStatus: (processName: string, processUUID: string, jobUUID: string) =>
    [...queryKeys.processes(), processName, processUUID, 'status', jobUUID] as const,

  // Widgets
  /**
   * Key for all widget data queries (parent of all widget keys).
   *
   * @returns The widgets namespace query key tuple.
   */
  widgets: () => [...queryKeys.all(), 'widgets'] as const,
  /**
   * Key for a widget's data payload.
   *
   * Parameter keys are sorted alphabetically before inclusion so that
   * `{ b: 2, a: 1 }` and `{ a: 1, b: 2 }` produce the same cache entry (LOW-2).
   *
   * @param widgetName - Backend widget name.
   * @param params - Optional arbitrary query parameters forwarded to the widget API.
   * @returns The widget data query key tuple.
   */
  widgetData: (widgetName: string, params?: Record<string, unknown>) =>
    [...queryKeys.widgets(), widgetName, params ? Object.fromEntries(Object.entries(params).sort()) : undefined] as const,

  // Possible Values
  /**
   * Key for all possible-value queries (parent of all PV keys).
   *
   * @returns The possible values namespace query key tuple.
   */
  possibleValues: () => [...queryKeys.all(), 'possibleValues'] as const,
  /**
   * Key for a field's possible-value list, optionally filtered by a search term.
   *
   * @param tableName - Backend table name.
   * @param fieldName - Field whose enum/possible values are being fetched.
   * @param searchTerm - Optional type-ahead search string.
   * @param formValues - Optional current form values a dependent filter reads.
   * @returns The possible values query key tuple.
   */
  tablePossibleValues: (tableName: string, fieldName: string, searchTerm?: string, formValues?: Record<string, unknown>) =>
    [...queryKeys.possibleValues(), 'table', tableName, fieldName, searchTerm, ...(formValues ? [formValues] : [])] as const,

  // Audits
  /**
   * Key for the audit log of a specific record.
   *
   * Scoped under the record key so invalidating the record also invalidates its audits.
   *
   * @param tableName - Backend table name.
   * @param primaryKey - Primary key of the record.
   * @returns The audits query key tuple.
   */
  audits: (tableName: string, primaryKey: string | number) =>
    [...queryKeys.tableRecord(tableName, primaryKey), 'audits'] as const,

  // Developer mode
  /**
   * Key for a record's developer data (record plus associated scripts).
   *
   * Scoped under the record key so invalidating the record also invalidates it.
   *
   * @param tableName - Backend table name.
   * @param primaryKey - Primary key of the record.
   * @returns The record developer query key tuple.
   */
  recordDeveloper: (tableName: string, primaryKey: string | number) =>
    [...queryKeys.tableRecord(tableName, primaryKey), 'developer'] as const,
  /**
   * Key for the run logs of one revision of a record's associated script.
   *
   * @param tableName - Backend table name.
   * @param primaryKey - Primary key of the record.
   * @param fieldName - Associated-script field.
   * @param scriptRevisionId - Revision whose logs are read.
   * @returns The associated script logs query key tuple.
   */
  associatedScriptLogs: (tableName: string, primaryKey: string | number, fieldName: string, scriptRevisionId: string | number) =>
    [...queryKeys.recordDeveloper(tableName, primaryKey), 'logs', fieldName, String(scriptRevisionId)] as const,
  /**
   * Key for the revisions of a script (scoped under the revision table's records).
   *
   * @param scriptId - Script id.
   * @returns The script revisions query key tuple.
   */
  scriptRevisions: (scriptId: string | number) =>
    [...queryKeys.tableRecords('scriptRevision'), 'script', String(scriptId)] as const,
  /**
   * Key for the files of one script revision.
   *
   * @param scriptRevisionId - Revision id.
   * @returns The script revision files query key tuple.
   */
  scriptRevisionFiles: (scriptRevisionId: string | number) =>
    [...queryKeys.tableRecords('scriptRevisionFile'), 'revision', String(scriptRevisionId)] as const,
  /**
   * Key for the pre-defined files of a script type.
   *
   * @param scriptTypeId - Script type id.
   * @returns The script type file schema query key tuple.
   */
  scriptTypeFileSchemas: (scriptTypeId: string | number) =>
    [...queryKeys.tableRecords('scriptTypeFileSchema'), 'scriptType', String(scriptTypeId)] as const,
  /**
   * Key for the application APIs that expose a table.
   *
   * @param tableName - Backend table name.
   * @returns The table APIs query key tuple.
   */
  tableApis: (tableName: string) => [...queryKeys.all(), 'apis', 'table', tableName] as const,
  /**
   * Key for the versions of one application API.
   *
   * @param apiPath - The API's base path.
   * @returns The API versions query key tuple.
   */
  apiVersions: (apiPath: string) => [...queryKeys.all(), 'apis', 'versions', apiPath] as const,

  // ESB
  /**
   * Key for all ESB queries.
   *
   * @returns The ESB namespace query key tuple.
   */
  esb: () => [...queryKeys.all(), 'esb'] as const,
  /**
   * Key for a table's ESB publications and subscribers.
   *
   * @param tableName - Backend table name.
   * @returns The table ESB query key tuple.
   */
  esbTable: (tableName: string) => [...queryKeys.esb(), 'table', tableName] as const,

  // Search
  /**
   * Key for all global search queries.
   *
   * @returns The search namespace query key tuple.
   */
  search: () => [...queryKeys.all(), 'search'] as const,
  /**
   * Key for a record search result set (`POST /search`).
   *
   * @param searchTerm - The trimmed search term.
   * @param tableNames - The searched tables.
   * @param limitPerTable - Maximum records per table.
   * @returns The record search query key tuple.
   */
  recordSearch: (searchTerm: string, tableNames: string[], limitPerTable: number) =>
    [...queryKeys.search(), 'records', searchTerm, tableNames, limitPerTable] as const,
}
