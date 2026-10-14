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

import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import {
  capabilities,
  column,
  distinctPage,
  table,
  duplicatesResult,
} from '../../../tests/fixtures/data-analysis'
import {
  columnProfile,
  distinctValues,
  duplicates,
  getCapabilities,
  getRun,
  isDataAnalysisInstalled,
  resetDataAnalysisInstalled,
  startRun,
  tableProfile,
} from './data-analysis'

const ROOT = '/qqq/v1/qbit/data-analysis'
const version = (extensions: { name: string }[]) =>
  http.get('/qqq/v1/version', () => HttpResponse.json({ apiVersion: '1.1.0', basePath: '/qqq/v1', features: [], extensions }))

beforeEach(() => {
  resetDataAnalysisInstalled()
  server.use(version([{ name: 'data-analysis' }]))
})

describe('data-analysis installation', () => {
  it('asks capabilities only when the server registers the extension', async () => {
    server.use(version([{ name: 'alerts' }]))
    let asked = false
    server.use(http.get(`${ROOT}/tables/:table/capabilities`, () => { asked = true; return HttpResponse.json(capabilities) }))
    expect(await isDataAnalysisInstalled()).toBe(false)
    expect(await getCapabilities('person')).toBeNull()
    expect(asked).toBe(false)
  })
  it('treats a failed version check as not installed and retries later', async () => {
    server.use(http.get('/qqq/v1/version', () => new HttpResponse(null, { status: 500 })))
    expect(await isDataAnalysisInstalled()).toBe(false)
    server.use(version([{ name: 'data-analysis' }]))
    expect(await isDataAnalysisInstalled()).toBe(true)
  })
})

describe('data-analysis capabilities', () => {
  it('returns the declared capability, including an explicit denial', async () => {
    server.use(
      http.get(`${ROOT}/tables/:table/capabilities`, () => HttpResponse.json(capabilities))
    )
    expect(await getCapabilities('person')).toEqual(capabilities)
    server.use(
      http.get(`${ROOT}/tables/:table/capabilities`, () =>
        HttpResponse.json({ canAnalyze: false, fields: [] })
      )
    )
    expect(await getCapabilities('person')).toEqual({ canAnalyze: false, fields: [] })
  })
  it.each([403, 404])('treats %s as unavailable', async (status) => {
    server.use(
      http.get(`${ROOT}/tables/:table/capabilities`, () => new HttpResponse(null, { status }))
    )
    expect(await getCapabilities('person')).toBeNull()
  })
  it('ignores a SPA fallback but propagates server errors', async () => {
    server.use(
      http.get(`${ROOT}/tables/:table/capabilities`, () =>
        HttpResponse.text('<html>Not found</html>')
      )
    )
    expect(await getCapabilities('person')).toBeNull()
    server.use(
      http.get(`${ROOT}/tables/:table/capabilities`, () => new HttpResponse(null, { status: 500 }))
    )
    await expect(getCapabilities('person')).rejects.toThrow()
  })
})

it('posts typed requests only to the extension and encodes path segments', async () => {
  const received: { url: string; body: unknown }[] = []
  const responses = {
    'column-profile': column,
    'distinct-values': distinctPage,
    'table-profile': table,
    duplicates: duplicatesResult,
  }
  server.use(
    http.post(`${ROOT}/tables/:table/:operation`, async ({ request, params }) => {
      received.push({ url: request.url, body: await request.json() })
      return HttpResponse.json(responses[params.operation as keyof typeof responses])
    })
  )
  const request = { fieldName: 'status', filter: { criteria: [], booleanOperator: 'AND' as const } }
  expect(await columnProfile('sales/people', request)).toEqual(column)
  expect(
    await distinctValues('person', { ...request, page: 1, pageSize: 50, search: 'active' })
  ).toEqual(distinctPage)
  expect(await tableProfile('person', { filter: request.filter })).toEqual(table)
  expect(await duplicates('person', { fields: ['status'], filter: request.filter })).toEqual(
    duplicatesResult
  )
  expect(received[0].url).toContain('sales%2Fpeople/column-profile')
  expect(received.map((r) => r.body)).toEqual([
    request,
    { ...request, page: 1, pageSize: 50, search: 'active' },
    { filter: request.filter },
    { fields: ['status'], filter: request.filter },
  ])
})

it('starts and polls typed exact runs and propagates permission failures', async () => {
  const body = {
    operation: 'COLUMN_PROFILE' as const,
    tableName: 'person',
    request: { fieldName: 'status', exact: true },
  }
  server.use(
    http.post(`${ROOT}/runs`, async ({ request }) => {
      expect(await request.json()).toEqual(body)
      return HttpResponse.json({ runId: 'run/1', status: 'RUNNING' })
    }),
    http.get(`${ROOT}/runs/:id`, ({ request }) => {
      expect(request.url).toContain('run%2F1')
      return HttpResponse.json({ status: 'COMPLETE', columnProfile: column })
    })
  )
  expect(await startRun(body)).toEqual({ runId: 'run/1', status: 'RUNNING' })
  expect(await getRun('run/1')).toEqual({ status: 'COMPLETE', columnProfile: column })
  server.use(
    http.post(`${ROOT}/tables/:table/column-profile`, () => new HttpResponse(null, { status: 403 }))
  )
  await expect(columnProfile('person', { fieldName: 'status' })).rejects.toThrow()
})

it('posts a pivot with the complete filter and encoded table name', async () => {
  const { pivot } = await import('./data-analysis')
  const { pivotRequest, pivotResult } = await import('../../../tests/fixtures/data-analysis')
  const request = {
    ...pivotRequest,
    filter: {
      booleanOperator: 'AND' as const,
      criteria: [{ fieldName: 'status', operator: 'EQUALS' as const, values: ['active'] }],
    },
  }
  server.use(
    http.post(`${ROOT}/tables/:table/pivot`, async ({ request: wire }) => {
      expect(wire.url).toContain('/sales%2Fpeople/pivot')
      expect(await wire.json()).toEqual(request)
      return HttpResponse.json(pivotResult)
    })
  )
  expect(await pivot('sales/people', request)).toEqual(pivotResult)
  server.use(
    http.post(`${ROOT}/tables/:table/pivot`, () => new HttpResponse(null, { status: 403 }))
  )
  await expect(pivot('sales/people', request)).rejects.toThrow()
})
