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

// Tests for the API-versioned table routes

import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { server } from '@/mocks/node'
import { apiVersionPrefix, countApiRecords, loadApiTableMetaData, queryApiRecords } from './api-versioned'

const api = { name: 'person-api', path: 'person-api', version: '2023.Q1' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiVersionPrefix', () => {
  it('joins the path and version', () => {
    expect(apiVersionPrefix(api)).toBe('/person-api/2023.Q1')
  })

  it('trims slashes around the path and version, as the backend registers them', () => {
    expect(apiVersionPrefix({ name: 'x', path: '/api/', version: '/v1/' })).toBe('/api/v1')
  })

  it('URL-encodes each segment', () => {
    expect(apiVersionPrefix({ name: 'x', path: 'my api', version: '1 0' })).toBe('/my%20api/1%200')
  })
})

describe('loadApiTableMetaData', () => {
  it('GETs /qqq/v1/{apiPath}/{apiVersion}/metaData/table/{table}', async () => {
    let path = ''
    server.use(
      http.get('/qqq/v1/person-api/2023.Q1/metaData/table/:table', ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json({ name: 'person', label: 'Person', fields: {} })
      })
    )
    await expect(loadApiTableMetaData(api, 'person')).resolves.toMatchObject({ name: 'person', label: 'Person' })
    expect(path).toBe('/qqq/v1/person-api/2023.Q1/metaData/table/person')
  })

  it('rejects with the backend message when the API does not exist', async () => {
    server.use(
      http.get('/qqq/v1/nope/1/metaData/table/person', () => HttpResponse.json({ error: 'No API exists at the requested path.' }, { status: 404 }))
    )
    await expect(loadApiTableMetaData({ name: 'nope', path: 'nope', version: '1' }, 'person')).rejects.toThrow('No API exists at the requested path.')
  })
})

describe('queryApiRecords', () => {
  it('POSTs the filter and joins to /qqq/v1/{apiPath}/{apiVersion}/table/{table}/query', async () => {
    let path = ''
    let body: unknown
    server.use(
      http.post('/qqq/v1/person-api/2023.Q1/table/:table/query', async ({ request }) => {
        path = new URL(request.url).pathname
        body = await request.json()
        return HttpResponse.json({ records: [{ tableName: 'person', values: { id: 1 } }] })
      })
    )
    const request = { filter: { criteria: [], orderBys: [{ fieldName: 'id', isAscending: false }], skip: 0, limit: 25 }, joins: [{ joinTable: 'order', select: true, type: 'LEFT' as const }] }
    const result = await queryApiRecords(api, 'person', request)
    expect(path).toBe('/qqq/v1/person-api/2023.Q1/table/person/query')
    expect(body).toEqual(request)
    expect(result.records).toHaveLength(1)
  })

  it('returns an off-contract response as is, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    server.use(http.post('/qqq/v1/person-api/2023.Q1/table/person/query', () => HttpResponse.json({ records: 'nope' })))
    await expect(queryApiRecords(api, 'person', { filter: {} })).resolves.toEqual({ records: 'nope' })
    expect(warn).toHaveBeenCalled()
  })
})

describe('countApiRecords', () => {
  it('POSTs to /qqq/v1/{apiPath}/{apiVersion}/table/{table}/count with includeDistinct', async () => {
    let url: URL | undefined
    server.use(
      http.post('/qqq/v1/person-api/2023.Q1/table/:table/count', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ count: 7, distinctCount: 5 })
      })
    )
    await expect(countApiRecords(api, 'person', { filter: {} }, true)).resolves.toEqual({ count: 7, distinctCount: 5 })
    expect(url?.pathname).toBe('/qqq/v1/person-api/2023.Q1/table/person/count')
    expect(url?.searchParams.get('includeDistinct')).toBe('true')
  })

  it('sends includeDistinct=false by default', async () => {
    let url: URL | undefined
    server.use(
      http.post('/qqq/v1/person-api/2023.Q1/table/person/count', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ count: 2 })
      })
    )
    await expect(countApiRecords(api, 'person', { filter: {} })).resolves.toEqual({ count: 2 })
    expect(url?.searchParams.get('includeDistinct')).toBe('false')
  })

  it('returns an off-contract response as is, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    server.use(http.post('/qqq/v1/person-api/2023.Q1/table/person/count', () => HttpResponse.json({ count: 'many' })))
    await expect(countApiRecords(api, 'person', { filter: {} })).resolves.toEqual({ count: 'many' })
    expect(warn).toHaveBeenCalled()
  })
})
