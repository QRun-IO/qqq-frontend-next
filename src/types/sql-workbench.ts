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
 * @file SQL Workbench types — the `/qqq/v1/sql-workbench` contract of the qbit-sql-workbench
 * QBit (see that repository's docs/DESIGN.md, section 5).
 */

/** Dialect names the backend reports; drive the editor and formatter. */
export type SqlWorkbenchDialect = 'postgresql' | 'mysql' | 'sqlite' | 'h2' | 'sql'

/** One target backend. */
export interface SqlWorkbenchBackend {
  name: string
  label: string
  vendor: string | null
  dialect: SqlWorkbenchDialect
  /** Read-only sessions use dedicated (least-privilege) credentials. */
  readOnlyCredentials: boolean
  /** The database enforces read-only sessions (false on H2 without dedicated credentials). */
  readOnlyEnforced: boolean
  /** DDL can be dry-run (rolled back) on this backend. */
  transactionalDdl: boolean
  writeAllowed: boolean
}

/** Server limits. */
export interface SqlWorkbenchLimits {
  maxRows: number
  pageSize: number
  maxPageSize: number
  maxResultBytes: number
  statementTimeoutSeconds: number
  writeStatementTimeoutSeconds: number
  maxAffectedRowsWithoutAcknowledgement: number
  maxAffectedRows: number
  maxSqlLength: number
  maxStatementsPerRun: number
}

/** `GET /capabilities`. */
export interface SqlWorkbenchCapabilities {
  version: string
  canWrite: boolean
  canShare: boolean
  writeModeEnabled: boolean
  limits: SqlWorkbenchLimits
  backends: SqlWorkbenchBackend[]
}

/** How the UI renders a result column. */
export type SqlColumnKind =
  | 'number'
  | 'string'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'json'
  | 'binary'
  | 'array'
  | 'other'

/** One result column. */
export interface SqlColumn {
  name: string
  label: string
  typeName: string
  jdbcType: number
  kind: SqlColumnKind
}

/** A binary value as the backend sends it. */
export interface SqlBinaryValue {
  $binary: true
  length: number
  hexPreview: string
}

/** One result value (already JSON-safe). */
export type SqlValue = string | number | boolean | null | SqlBinaryValue | SqlValue[]

/** One statement of a run, as the backend classified it. */
export interface SqlStatementView {
  index: number
  kind: 'READ' | 'EXPLAIN_ANALYZE' | 'WRITE' | 'DDL' | 'FORBIDDEN'
  leadingKeyword: string | null
  text: string
  affectedRows: number | null
}

/** Outcome of a run. */
export type SqlExecutionStatus =
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'CANCELLED'
  | 'REJECTED'
  | 'PREVIEW'
  | 'DRIFTED'

/** `POST /execute` request. */
export interface SqlExecuteRequest {
  backendName: string
  sql: string
  params?: Record<string, string | number | boolean | null>
  mode?: 'READ_ONLY' | 'WRITE'
  notebookId?: number
  cellKey?: string
  pageSize?: number
  confirmToken?: string
  acknowledgeRowGuard?: boolean
  /** Client-chosen id (a UUID), so a running statement can be cancelled before it answers. */
  executionUuid?: string
}

/** `POST /execute` response (fields depend on the status). */
export interface SqlExecuteResponse {
  executionUuid: string
  status: SqlExecutionStatus
  mode: string
  backendName: string
  durationMs?: number | null
  statements?: SqlStatementView[]
  columns?: SqlColumn[]
  rows?: SqlValue[][]
  rowCount?: number
  hasMore?: boolean
  truncated?: boolean
  truncatedReason?: 'ROWS' | 'BYTES' | null
  rowsAffected?: number
  error?: string
  sqlState?: string | null
  dryRunSupported?: boolean
  dryRunNote?: string | null
  totalAffectedRows?: number | null
  rowGuardExceeded?: boolean
  rowGuardLimit?: number
  confirmToken?: string
  expiresAt?: string
  previewAffectedRows?: number
  actualAffectedRows?: number
}

/** `GET /executions/{uuid}/rows`. */
export interface SqlRowsPage {
  executionUuid: string
  columns: SqlColumn[]
  rows: SqlValue[][]
  offset: number
  rowCount: number
  truncated: boolean
  truncatedReason: 'ROWS' | 'BYTES' | null
}

/** One node of a normalized query plan. */
export interface SqlPlanNode {
  label: string
  detail: string | null
  startupCost: number | null
  totalCost: number | null
  planRows: number | null
  actualTimeMs: number | null
  actualRows: number | null
  loops: number | null
  extra: Record<string, unknown>
  children: SqlPlanNode[]
}

/** `POST /explain` response. */
export interface SqlExplainResponse {
  executionUuid: string
  status: SqlExecutionStatus
  dialect?: SqlWorkbenchDialect
  analyze?: boolean
  plan?: SqlPlanNode
  raw?: string
  error?: string
  durationMs?: number | null
}

/** Schema column. */
export interface SqlSchemaColumn {
  name: string
  typeName: string
  nullable: boolean
}

/** Schema table. */
export interface SqlSchemaTable {
  name: string
  type: string
  columns: SqlSchemaColumn[]
}

/** A QQQ table on a backend, with its SQL names. */
export interface SqlQqqTable {
  name: string
  label: string | null
  sqlName: string
  fields: { name: string; label: string | null; sqlName: string; type: string | null }[]
}

/** `GET /schema/{backend}`. */
export interface SqlSchema {
  backendName: string
  dialect: SqlWorkbenchDialect
  schemas: { name: string; tables: SqlSchemaTable[] }[]
  truncated: boolean
  keywords: string[]
  functions: string[]
  qqqTables: SqlQqqTable[]
  cachedAt: string
}

/** One audit row from `GET /history`. */
export interface SqlHistoryEntry {
  executionUuid: string
  backendName: string
  mode: string
  status: string
  sqlText: string
  notebookId: number | null
  cellKey: string | null
  startTime: string | null
  durationMs: number | null
  rowsReturned: number | null
  rowsAffected: number | null
  errorMessage: string | null
}

/** A notebook parameter definition. */
export interface SqlNotebookParameter {
  name: string
  type?: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATE_TIME'
  defaultValue?: string | null
  label?: string | null
}

/** One notebook cell. */
export interface SqlNotebookCell {
  cellKey: string
  cellType: 'SQL' | 'MARKDOWN'
  title?: string | null
  content: string
  backendName?: string | null
  sortOrder?: number
}

/** Notebook list entry. */
export interface SqlNotebookSummary {
  id: number
  title: string
  description: string | null
  visibility: 'PERSONAL' | 'SHARED'
  ownerUserId: string
  ownerName: string | null
  defaultBackendName: string | null
  currentVersion: number
  canEdit: boolean
  createDate: string | null
  modifyDate: string | null
}

/** A full notebook. */
export interface SqlNotebook extends SqlNotebookSummary {
  parameters: SqlNotebookParameter[]
  cells: SqlNotebookCell[]
}

/** Notebook save / create body. */
export interface SqlNotebookInput {
  title: string
  description?: string | null
  defaultBackendName?: string | null
  parameters?: SqlNotebookParameter[]
  cells?: SqlNotebookCell[]
  comment?: string
}

/** One notebook version (list entry). */
export interface SqlNotebookVersionSummary {
  versionNumber: number
  savedByName: string | null
  comment: string | null
  createDate: string
}

/** A pinned result. */
export interface SqlResultSnapshot {
  id: number
  cellKey: string | null
  executionUuid: string | null
  label: string | null
  backendName: string | null
  rowCount: number
  truncated: boolean
  createDate: string | null
  result: { columns?: SqlColumn[]; rows?: SqlValue[][] }
}

/** Export formats. */
export type SqlExportFormat = 'csv' | 'xlsx' | 'json'
