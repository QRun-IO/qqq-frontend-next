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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  esbOverview,
  fulfillOrderDeadLetters,
  fulfillOrderEsb,
  orderEsb,
  orderFulfillmentMessages,
} from '@/mocks/fixtures/esb'
import { server } from '@/mocks/node'
import { processInit } from './processes'
import {
  getEsbDeadLetters,
  getEsbForProcess,
  getEsbForTable,
  getEsbMessages,
  getEsbOverview,
  runEsbAction,
} from './esb'

vi.mock('./processes', () => ({ processInit: vi.fn() }))

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

describe('getEsbForProcess', () => {
  it('returns the process ESB section from GET /qqq/v1/esb/process/{process}', async () => {
    let path = ''
    server.use(
      http.get('/qqq/v1/esb/process/:process', ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json(fulfillOrderEsb)
      })
    )
    await expect(getEsbForProcess('fulfill order')).resolves.toEqual(fulfillOrderEsb)
    expect(path).toBe('/qqq/v1/esb/process/fulfill%20order')
  })

  it.each([403, 404])('returns null on %i', async (status) => {
    server.use(
      http.get('/qqq/v1/esb/process/fulfillOrder', () =>
        HttpResponse.json({ error: 'Permission denied.' }, { status })
      )
    )
    await expect(getEsbForProcess('fulfillOrder')).resolves.toBeNull()
  })

  it('returns null for a body without publications and triggers', async () => {
    server.use(
      http.get('/qqq/v1/esb/process/fulfillOrder', () =>
        HttpResponse.html('<!doctype html><html><body>SPA</body></html>')
      )
    )
    await expect(getEsbForProcess('fulfillOrder')).resolves.toBeNull()
  })
})

describe('getEsbOverview', () => {
  it('returns the overview from GET /qqq/v1/esb/overview', async () => {
    await expect(getEsbOverview()).resolves.toEqual(esbOverview)
  })

  it.each([403, 404])('returns null on %i', async (status) => {
    server.use(
      http.get('/qqq/v1/esb/overview', () =>
        HttpResponse.json({ error: 'Permission denied.' }, { status })
      )
    )
    await expect(getEsbOverview()).resolves.toBeNull()
  })

  it('returns null for a body without providers and destinations', async () => {
    server.use(http.get('/qqq/v1/esb/overview', () => HttpResponse.json({ error: 'unexpected' })))
    await expect(getEsbOverview()).resolves.toBeNull()
  })
})

describe('getEsbMessages and getEsbDeadLetters', () => {
  it('browse a destination with offset and limit', async () => {
    let url = new URL('http://localhost')
    server.use(
      http.get('/qqq/v1/esb/messages/:destination', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(orderFulfillmentMessages)
      })
    )
    await expect(getEsbMessages('orderFulfillment', 50, 25)).resolves.toEqual(orderFulfillmentMessages)
    expect(url.pathname).toBe('/qqq/v1/esb/messages/orderFulfillment')
    expect(url.searchParams.get('offset')).toBe('50')
    expect(url.searchParams.get('limit')).toBe('25')
  })

  it('browse a trigger\'s dead letters, 50 at a time from the start by default', async () => {
    let url = new URL('http://localhost')
    server.use(
      http.get('/qqq/v1/esb/deadLetters/:trigger', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(fulfillOrderDeadLetters)
      })
    )
    await expect(getEsbDeadLetters('fulfillOrder.orderFulfillment')).resolves.toEqual(
      fulfillOrderDeadLetters
    )
    expect(url.pathname).toBe('/qqq/v1/esb/deadLetters/fulfillOrder.orderFulfillment')
    expect(url.searchParams.get('offset')).toBe('0')
    expect(url.searchParams.get('limit')).toBe('50')
  })

  it('rejects a body that is not a message page', async () => {
    server.use(http.get('/qqq/v1/esb/messages/orderFulfillment', () => HttpResponse.json({})))
    await expect(getEsbMessages('orderFulfillment')).rejects.toThrow('Invalid ESB message page')
  })

  it('rethrows request failures', async () => {
    server.use(
      http.get('/qqq/v1/esb/deadLetters/fulfillOrder.orderFulfillment', () =>
        HttpResponse.json({ error: 'Permission denied.' }, { status: 403 })
      )
    )
    await expect(getEsbDeadLetters('fulfillOrder.orderFulfillment')).rejects.toThrow()
  })
})

describe('runEsbAction', () => {
  beforeEach(() => {
    vi.mocked(processInit).mockReset()
  })

  it('runs the operate process with the values and returns its count and message', async () => {
    vi.mocked(processInit).mockResolvedValue({
      type: 'COMPLETE',
      processUUID: 'uuid',
      values: { count: 7, message: 'Purged 7 messages.' },
    })
    await expect(
      runEsbAction('esbPurgeQueue', { providerName: 'artemis', brokerQueueName: 'orderFulfillment' })
    ).resolves.toEqual({ count: 7, message: 'Purged 7 messages.' })
    expect(processInit).toHaveBeenCalledWith('esbPurgeQueue', {
      values: { providerName: 'artemis', brokerQueueName: 'orderFulfillment' },
    })
  })

  it('reads a count sent as text', async () => {
    vi.mocked(processInit).mockResolvedValue({
      type: 'COMPLETE',
      processUUID: 'uuid',
      values: { count: '2', message: 'Deleted 2 messages.' },
    })
    await expect(runEsbAction('esbDeleteMessages', {})).resolves.toEqual({
      count: 2,
      message: 'Deleted 2 messages.',
    })
  })

  it('rejects with the user-facing error when the process fails', async () => {
    vi.mocked(processInit).mockResolvedValue({
      type: 'ERROR',
      error: 'Error message: boom',
      userFacingError: 'The broker refused the purge.',
    })
    await expect(runEsbAction('esbPurgeQueue', {})).rejects.toThrow('The broker refused the purge.')
  })

  it('says the action is still running when it continues as a job', async () => {
    vi.mocked(processInit).mockResolvedValue({ type: 'JOB_STARTED', processUUID: 'uuid', jobUUID: 'job' })
    await expect(runEsbAction('esbRestartTrigger', {})).resolves.toEqual({
      count: null,
      message: 'The action is still running.',
    })
  })
})
