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
 * @file MSW handlers for the SQL Workbench endpoints (`/qqq/v1/sql-workbench/*`).
 */

import { http, HttpResponse } from 'msw'
import type { SqlExecuteRequest } from '@/types'
import {
  sqlCapabilities,
  sqlExplain,
  sqlHistory,
  sqlNotebook,
  sqlNotebookSummary,
  sqlRowsPage,
  sqlSchema,
  sqlSelectResult,
  sqlSharedNotebookSummary,
  sqlWriteCommit,
  sqlWritePreview,
} from '../fixtures/sql-workbench'

const BASE = '/qqq/v1/sql-workbench'

export const sqlWorkbenchHandlers = [
  http.get(`${BASE}/capabilities`, () => HttpResponse.json(sqlCapabilities)),
  http.get(`${BASE}/schema/:backend`, ({ params }) =>
    params.backend === 'postgres'
      ? HttpResponse.json(sqlSchema)
      : HttpResponse.json(
          { error: `Unknown SQL Workbench backend: ${String(params.backend)}` },
          { status: 404 }
        )
  ),
  http.post(`${BASE}/execute`, async ({ request }) => {
    const body = (await request.json()) as SqlExecuteRequest
    if (body.mode === 'WRITE') {
      return HttpResponse.json(body.confirmToken ? sqlWriteCommit : sqlWritePreview)
    }
    if (/^\s*select\s+broken/i.test(body.sql)) {
      return HttpResponse.json({
        ...sqlSelectResult,
        status: 'FAILED',
        error: 'column "broken" does not exist',
        columns: undefined,
        rows: undefined,
      })
    }
    return HttpResponse.json(sqlSelectResult)
  }),
  http.post(`${BASE}/explain`, () => HttpResponse.json(sqlExplain)),
  http.get(`${BASE}/executions/:uuid/rows`, () => HttpResponse.json(sqlRowsPage)),
  http.post(`${BASE}/executions/:uuid/cancel`, () => HttpResponse.json({ cancelled: true })),
  http.get(`${BASE}/history`, () => HttpResponse.json({ executions: sqlHistory })),
  http.get(`${BASE}/notebooks`, ({ request }) => {
    const scope = new URL(request.url).searchParams.get('scope')
    return HttpResponse.json({
      notebooks: scope === 'shared' ? [sqlSharedNotebookSummary] : [sqlNotebookSummary],
    })
  }),
  http.post(`${BASE}/notebooks`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      ...sqlNotebook,
      id: 9,
      title: body.title,
      cells: body.cells ?? [],
      currentVersion: 1,
    })
  }),
  http.get(`${BASE}/notebooks/:id`, ({ params }) =>
    params.id === '1'
      ? HttpResponse.json(sqlNotebook)
      : HttpResponse.json({ error: 'Notebook not found.' }, { status: 404 })
  ),
  http.put(`${BASE}/notebooks/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      ...sqlNotebook,
      ...body,
      currentVersion: sqlNotebook.currentVersion + 1,
    })
  }),
  http.delete(`${BASE}/notebooks/:id`, () => HttpResponse.json({ deleted: true })),
  http.post(`${BASE}/notebooks/:id/publish`, async ({ request }) => {
    const body = (await request.json()) as { shared: boolean }
    return HttpResponse.json({ ...sqlNotebook, visibility: body.shared ? 'SHARED' : 'PERSONAL' })
  }),
  http.post(`${BASE}/notebooks/:id/duplicate`, () =>
    HttpResponse.json({ ...sqlNotebook, id: 10, title: 'Copy of Monthly signups' })
  ),
  http.get(`${BASE}/notebooks/:id/versions`, () =>
    HttpResponse.json({
      versions: [
        {
          versionNumber: 2,
          savedByName: 'User One',
          comment: null,
          createDate: '2026-10-11T00:00:00Z',
        },
        {
          versionNumber: 1,
          savedByName: 'User One',
          comment: null,
          createDate: '2026-10-01T00:00:00Z',
        },
      ],
    })
  ),
  http.post(`${BASE}/notebooks/:id/versions/:n/restore`, () =>
    HttpResponse.json({ ...sqlNotebook, currentVersion: 3 })
  ),
  http.get(`${BASE}/notebooks/:id/snapshots`, () => HttpResponse.json({ snapshots: [] })),
  http.post(`${BASE}/notebooks/:id/snapshots`, async ({ request }) => {
    const body = (await request.json()) as { cellKey: string; executionUuid: string }
    return HttpResponse.json({
      id: 5,
      cellKey: body.cellKey,
      executionUuid: body.executionUuid,
      label: null,
      backendName: 'postgres',
      rowCount: 2,
      truncated: false,
      createDate: null,
      result: { columns: sqlSelectResult.columns, rows: sqlSelectResult.rows },
    })
  }),
  http.delete(`${BASE}/notebooks/:id/snapshots/:snapshotId`, () =>
    HttpResponse.json({ deleted: true })
  ),
]
