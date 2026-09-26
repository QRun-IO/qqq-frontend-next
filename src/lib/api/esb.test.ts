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

// Tests for the ESB API client

import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { orderEsb } from '@/mocks/fixtures/esb'
import { server } from '@/mocks/node'
import { getEsbForTable } from './esb'

describe('getEsbForTable', () => {
  it('returns the table ESB section from GET /qqq/v1/esb/table/{table}', async () => {
    let path = ''
    server.use(
      http.get('/qqq/v1/esb/table/:table', ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json(orderEsb)
      })
    )
    await expect(getEsbForTable('order')).resolves.toEqual(orderEsb)
    expect(path).toBe('/qqq/v1/esb/table/order')
  })

  it('URL-encodes the table name', async () => {
    let path = ''
    server.use(
      http.get('/qqq/v1/esb/table/:table', ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json({ ...orderEsb, table: 'my table' })
      })
    )
    await getEsbForTable('my table')
    expect(path).toBe('/qqq/v1/esb/table/my%20table')
  })

  it.each([403, 404])('returns null on %i', async (status) => {
    server.use(
      http.get('/qqq/v1/esb/table/order', () =>
        HttpResponse.json({ error: 'Permission denied.' }, { status })
      )
    )
    await expect(getEsbForTable('order')).resolves.toBeNull()
  })

  it('rethrows other failures with the backend message', async () => {
    server.use(
      http.get('/qqq/v1/esb/table/order', () =>
        HttpResponse.json({ error: 'Broker management API unavailable' }, { status: 500 })
      )
    )
    await expect(getEsbForTable('order')).rejects.toThrow('Broker management API unavailable')
  })

  it('returns null for the SPA index page a backend without the ESB module answers', async () => {
    server.use(
      http.get('/qqq/v1/esb/table/order', () =>
        HttpResponse.html('<!doctype html><html><body>SPA</body></html>')
      )
    )
    await expect(getEsbForTable('order')).resolves.toBeNull()
  })

  it.each([
    ['an empty body', ''],
    ['a JSON object without publications and subscribers', { error: 'unexpected' }],
    ['a JSON array', []],
  ])('returns null for %s', async (_label, body) => {
    server.use(
      http.get('/qqq/v1/esb/table/order', () =>
        typeof body === 'string' ? HttpResponse.text(body) : HttpResponse.json(body)
      )
    )
    await expect(getEsbForTable('order')).resolves.toBeNull()
  })
})
