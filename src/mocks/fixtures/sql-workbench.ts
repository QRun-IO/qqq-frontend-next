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
 * @file Fixtures for the SQL Workbench endpoints, shaped as qbit-sql-workbench answers.
 */

import type {
  SqlExecuteResponse,
  SqlExplainResponse,
  SqlHistoryEntry,
  SqlNotebook,
  SqlNotebookSummary,
  SqlRowsPage,
  SqlSchema,
  SqlWorkbenchCapabilities,
} from '@/types'

export const sqlCapabilities: SqlWorkbenchCapabilities = {
  version: '1.0.0-RC.1',
  canWrite: true,
  canShare: true,
  writeModeEnabled: true,
  limits: {
    maxRows: 10000,
    pageSize: 500,
    maxPageSize: 2000,
    maxResultBytes: 20971520,
    statementTimeoutSeconds: 30,
    writeStatementTimeoutSeconds: 60,
    maxAffectedRowsWithoutAcknowledgement: 1000,
    maxAffectedRows: 100000,
    maxSqlLength: 100000,
    maxStatementsPerRun: 50,
  },
  backends: [
    {
      name: 'postgres',
      label: 'postgres',
      vendor: 'postgres',
      dialect: 'postgresql',
      readOnlyCredentials: true,
      readOnlyEnforced: true,
      transactionalDdl: true,
      writeAllowed: true,
    },
  ],
}

export const sqlReadOnlyCapabilities: SqlWorkbenchCapabilities = {
  ...sqlCapabilities,
  canWrite: false,
  canShare: false,
  backends: sqlCapabilities.backends.map((b) => ({ ...b, writeAllowed: false })),
}

export const sqlSchema: SqlSchema = {
  backendName: 'postgres',
  dialect: 'postgresql',
  schemas: [
    {
      name: 'public',
      tables: [
        {
          name: 'person',
          type: 'TABLE',
          columns: [
            { name: 'id', typeName: 'int4', nullable: false },
            { name: 'first_name', typeName: 'text', nullable: true },
          ],
        },
      ],
    },
  ],
  truncated: false,
  keywords: ['SELECT', 'FROM'],
  functions: ['count'],
  qqqTables: [
    {
      name: 'person',
      label: 'Person',
      sqlName: 'person',
      fields: [{ name: 'firstName', label: 'First Name', sqlName: 'first_name', type: 'STRING' }],
    },
  ],
  cachedAt: '2026-10-11T00:00:00Z',
}

export const sqlSelectResult: SqlExecuteResponse = {
  executionUuid: 'exec-1',
  status: 'SUCCEEDED',
  mode: 'READ_ONLY',
  backendName: 'postgres',
  durationMs: 12,
  statements: [
    { index: 0, kind: 'READ', leadingKeyword: 'SELECT', text: 'SELECT ...', affectedRows: null },
  ],
  columns: [
    { name: 'id', label: 'id', typeName: 'int4', jdbcType: 4, kind: 'number' },
    { name: 'first_name', label: 'first_name', typeName: 'text', jdbcType: 12, kind: 'string' },
    { name: 'doc', label: 'doc', typeName: 'jsonb', jdbcType: 1111, kind: 'json' },
    { name: 'photo', label: 'photo', typeName: 'bytea', jdbcType: -2, kind: 'binary' },
  ],
  rows: [
    [1, 'Darin', '{"k":1}', { $binary: true, length: 4, hexPreview: 'cafebabe' }],
    [2, null, null, null],
  ],
  rowCount: 3,
  hasMore: true,
  truncated: false,
  truncatedReason: null,
}

export const sqlRowsPage: SqlRowsPage = {
  executionUuid: 'exec-1',
  columns: sqlSelectResult.columns!,
  rows: [[3, 'Tim', null, null]],
  offset: 2,
  rowCount: 3,
  truncated: false,
  truncatedReason: null,
}

export const sqlWritePreview: SqlExecuteResponse = {
  executionUuid: 'exec-2',
  status: 'PREVIEW',
  mode: 'WRITE_PREVIEW',
  backendName: 'postgres',
  durationMs: 41,
  statements: [
    {
      index: 0,
      kind: 'WRITE',
      leadingKeyword: 'UPDATE',
      text: 'UPDATE person SET active = false',
      affectedRows: 1204,
    },
  ],
  dryRunSupported: true,
  dryRunNote: null,
  totalAffectedRows: 1204,
  rowGuardExceeded: true,
  rowGuardLimit: 1000,
  confirmToken: 'token-1',
  expiresAt: '2026-10-11T00:05:00Z',
}

export const sqlWriteCommit: SqlExecuteResponse = {
  executionUuid: 'exec-3',
  status: 'SUCCEEDED',
  mode: 'WRITE_COMMIT',
  backendName: 'postgres',
  durationMs: 50,
  statements: [
    {
      index: 0,
      kind: 'WRITE',
      leadingKeyword: 'UPDATE',
      text: 'UPDATE person SET active = false',
      affectedRows: 1204,
    },
  ],
  columns: [],
  rows: [],
  rowCount: 0,
  hasMore: false,
  truncated: false,
  rowsAffected: 1204,
}

export const sqlExplain: SqlExplainResponse = {
  executionUuid: 'exec-4',
  status: 'SUCCEEDED',
  dialect: 'postgresql',
  analyze: false,
  raw: '[{"Plan": {}}]',
  plan: {
    label: 'Sort',
    detail: null,
    startupCost: 10,
    totalCost: 12.5,
    planRows: 100,
    actualTimeMs: null,
    actualRows: null,
    loops: null,
    extra: { 'Sort Key': '["id"]' },
    children: [
      {
        label: 'Seq Scan',
        detail: 'on person',
        startupCost: 0,
        totalCost: 7.1,
        planRows: 100,
        actualTimeMs: null,
        actualRows: null,
        loops: null,
        extra: {},
        children: [],
      },
    ],
  },
}

export const sqlHistory: SqlHistoryEntry[] = [
  {
    executionUuid: 'exec-1',
    backendName: 'postgres',
    mode: 'READ_ONLY',
    status: 'SUCCEEDED',
    sqlText: 'SELECT * FROM person',
    notebookId: 1,
    cellKey: 'c1',
    startTime: '2026-10-11T14:02:00Z',
    durationMs: 12,
    rowsReturned: 3,
    rowsAffected: null,
    errorMessage: null,
  },
]

export const sqlNotebookSummary: SqlNotebookSummary = {
  id: 1,
  title: 'Monthly signups',
  description: null,
  visibility: 'PERSONAL',
  ownerUserId: 'user-1',
  ownerName: 'User One',
  defaultBackendName: 'postgres',
  currentVersion: 2,
  canEdit: true,
  createDate: '2026-10-01T00:00:00Z',
  modifyDate: '2026-10-11T00:00:00Z',
}

export const sqlSharedNotebookSummary: SqlNotebookSummary = {
  ...sqlNotebookSummary,
  id: 2,
  title: 'Orphan media',
  visibility: 'SHARED',
  ownerUserId: 'user-2',
  ownerName: 'User Two',
  canEdit: false,
}

export const sqlNotebook: SqlNotebook = {
  ...sqlNotebookSummary,
  parameters: [{ name: 'since', type: 'DATE', defaultValue: '2026-01-01' }],
  cells: [
    {
      cellKey: 'c0',
      cellType: 'MARKDOWN',
      title: null,
      content: '## Signups by **month**',
      backendName: null,
      sortOrder: 0,
    },
    {
      cellKey: 'c1',
      cellType: 'SQL',
      title: 'Signups',
      content: 'SELECT * FROM person WHERE create_date >= :since',
      backendName: null,
      sortOrder: 1,
    },
  ],
}
