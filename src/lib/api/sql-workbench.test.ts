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

// Tests for the SQL Workbench API client

import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import {
  sqlCapabilities,
  sqlExplain,
  sqlNotebook,
  sqlSchema,
  sqlSelectResult,
  sqlWritePreview,
} from '@/mocks/fixtures/sql-workbench'
import {
  cancelSqlExecution,
  createSqlNotebook,
  createSqlSnapshot,
  deleteSqlNotebook,
  deleteSqlSnapshot,
  duplicateSqlNotebook,
  executeSql,
  explainSql,
  getSqlHistory,
  getSqlNotebook,
  getSqlRows,
  getSqlSchema,
  getSqlWorkbenchCapabilities,
  listSqlNotebooks,
  listSqlNotebookVersions,
  listSqlSnapshots,
  publishSqlNotebook,
  restoreSqlNotebookVersion,
  saveSqlNotebook,
  sqlExportUrl,
} from './sql-workbench'

const BASE = '/qqq/v1/sql-workbench'

describe('getSqlWorkbenchCapabilities', () => {
  it('returns the capabilities', async () => {
    expect(await getSqlWorkbenchCapabilities()).toEqual(sqlCapabilities)
  })

  it.each([403, 404])('treats %i as unavailable', async (status) => {
    server.use(
      http.get(`${BASE}/capabilities`, () => HttpResponse.json({ error: 'x' }, { status }))
    )
    expect(await getSqlWorkbenchCapabilities()).toBeNull()
  })

  it('treats a non-workbench body (the SPA fallback) as unavailable', async () => {
    server.use(http.get(`${BASE}/capabilities`, () => HttpResponse.text('<html></html>')))
    expect(await getSqlWorkbenchCapabilities()).toBeNull()
  })

  it('throws other errors', async () => {
    server.use(
      http.get(`${BASE}/capabilities`, () => HttpResponse.json({ error: 'boom' }, { status: 500 }))
    )
    await expect(getSqlWorkbenchCapabilities()).rejects.toThrow()
  })
})

describe('running SQL', () => {
  it('loads a schema, with and without refresh', async () => {
    let refresh: string | null = null
    server.use(
      http.get(`${BASE}/schema/:backend`, ({ request }) => {
        refresh = new URL(request.url).searchParams.get('refresh')
        return HttpResponse.json(sqlSchema)
      })
    )
    expect(await getSqlSchema('postgres')).toEqual(sqlSchema)
    expect(refresh).toBeNull()
    await getSqlSchema('postgres', true)
    expect(refresh).toBe('true')
  })

  it('executes read-only and write requests', async () => {
    expect(await executeSql({ backendName: 'postgres', sql: 'SELECT 1' })).toEqual(sqlSelectResult)
    expect(await executeSql({ backendName: 'postgres', sql: 'UPDATE x', mode: 'WRITE' })).toEqual(
      sqlWritePreview
    )
  })

  it('explains', async () => {
    expect(await explainSql({ backendName: 'postgres', sql: 'SELECT 1' })).toEqual(sqlExplain)
  })

  it('pages with and without sorting', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${BASE}/executions/:uuid/rows`, ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json({ rows: [] })
      })
    )
    await getSqlRows('exec-1', 0, 10)
    await getSqlRows('exec-1', 10, 10, 2, 'desc')
    await getSqlRows('exec-1', 10, 10, 1)
    expect(seen).toEqual([
      '?offset=0&limit=10',
      '?offset=10&limit=10&sort=2&dir=desc',
      '?offset=10&limit=10&sort=1&dir=asc',
    ])
  })

  it('cancels, exports and lists history', async () => {
    expect(await cancelSqlExecution('exec-1')).toBe(true)
    expect(sqlExportUrl('exec 1', 'xlsx')).toBe(
      '/qqq/v1/sql-workbench/executions/exec%201/export?format=xlsx'
    )
    expect(await getSqlHistory()).toHaveLength(1)
    let params = ''
    server.use(
      http.get(`${BASE}/history`, ({ request }) => {
        params = new URL(request.url).search
        return HttpResponse.json({})
      })
    )
    expect(await getSqlHistory(5, 'postgres')).toEqual([])
    expect(params).toBe('?limit=5&backendName=postgres')
  })
})

describe('notebooks', () => {
  it('lists, loads, creates, saves and deletes', async () => {
    expect((await listSqlNotebooks('mine'))[0].title).toBe('Monthly signups')
    expect((await listSqlNotebooks('shared'))[0].visibility).toBe('SHARED')
    expect(await getSqlNotebook(1)).toEqual(sqlNotebook)
    expect((await createSqlNotebook({ title: 'New' })).title).toBe('New')
    expect((await saveSqlNotebook(1, { title: 'Renamed' })).title).toBe('Renamed')
    await expect(deleteSqlNotebook(1)).resolves.toBeUndefined()
    server.use(http.get(`${BASE}/notebooks`, () => HttpResponse.json({})))
    expect(await listSqlNotebooks('mine')).toEqual([])
  })

  it('publishes, duplicates, versions and snapshots', async () => {
    expect((await publishSqlNotebook(1, true)).visibility).toBe('SHARED')
    expect((await duplicateSqlNotebook(1)).id).toBe(10)
    expect(await listSqlNotebookVersions(1)).toHaveLength(2)
    expect((await restoreSqlNotebookVersion(1, 1)).currentVersion).toBe(3)
    expect(await listSqlSnapshots(1)).toEqual([])
    expect((await createSqlSnapshot(1, { executionUuid: 'exec-1', cellKey: 'c1' })).id).toBe(5)
    await expect(deleteSqlSnapshot(1, 5)).resolves.toBeUndefined()

    server.use(
      http.get(`${BASE}/notebooks/:id/versions`, () => HttpResponse.json({})),
      http.get(`${BASE}/notebooks/:id/snapshots`, () => HttpResponse.json({}))
    )
    expect(await listSqlNotebookVersions(1)).toEqual([])
    expect(await listSqlSnapshots(1)).toEqual([])
  })
})
