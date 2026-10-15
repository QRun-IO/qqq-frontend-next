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

import { afterEach, describe, expect, it } from 'vitest'
import axios, { AxiosHeaders, type AxiosAdapter } from 'axios'
import {
  installRequestIdInterceptor,
  isCollectingRequestIds,
  recentRequestIds,
  recordRequestId,
  REQUEST_ID_CAPACITY,
  resetRequestIds,
  setRequestIdCollection,
} from './request-ids'

const at = () => new Date('2026-10-15T12:00:00Z')

afterEach(() => resetRequestIds())

describe('request id ring buffer', () => {
  it('collects nothing while disabled', () => {
    recordRequestId({ method: 'get', url: '/qqq/v1/metaData', status: 200, headers: { 'x-request-id': 'abcdefgh-1' } }, at)
    expect(recentRequestIds()).toEqual([])
    expect(isCollectingRequestIds()).toBe(false)
  })

  it('records id, method, path without query, status and time', () => {
    setRequestIdCollection('X-Request-Id')
    recordRequestId({ method: 'post', url: 'http://localhost:3000/qqq/v1/table/person/query?secret=1', status: 200, headers: { 'X-Request-Id': 'abcdefgh-1' } }, at)
    expect(recentRequestIds()).toEqual([{ id: 'abcdefgh-1', method: 'POST', path: '/qqq/v1/table/person/query', status: 200, at: '2026-10-15T12:00:00.000Z' }])
  })

  it('keeps only the last 50, oldest first', () => {
    setRequestIdCollection('x-request-id')
    for (let i = 0; i < REQUEST_ID_CAPACITY + 7; i++) recordRequestId({ url: `/a/${i}`, status: 200, headers: { 'x-request-id': `request-${i}` } }, at)
    const ids = recentRequestIds()
    expect(ids).toHaveLength(REQUEST_ID_CAPACITY)
    expect(ids[0].id).toBe('request-7')
    expect(ids.at(-1)!.id).toBe(`request-${REQUEST_ID_CAPACITY + 6}`)
    expect(ids[0].method).toBe('GET')
  })

  it('ignores missing and malformed ids and clears the buffer when disabled', () => {
    setRequestIdCollection('x-request-id')
    recordRequestId({ url: '/a', status: 200, headers: {} }, at)
    recordRequestId({ url: '/a', status: 200, headers: { 'x-request-id': 'bad id with spaces' } }, at)
    recordRequestId({ url: '/a', status: 200, headers: null }, at)
    recordRequestId({ url: '/a', status: 200, headers: { 'x-request-id': 'x'.repeat(129) } }, at)
    expect(recentRequestIds()).toEqual([])
    recordRequestId({ url: '/a', headers: { 'x-request-id': 'good-id-1' } }, at)
    expect(recentRequestIds()).toHaveLength(1)
    setRequestIdCollection(null)
    expect(recentRequestIds()).toEqual([])
  })

  it('reads AxiosHeaders and records success and error responses through the interceptor', async () => {
    let status = 200
    const adapter: AxiosAdapter = async (config) => {
      const response = { data: {}, status, statusText: '', headers: new AxiosHeaders({ 'X-Request-Id': `id-${status}-abc` }), config }
      if (status >= 400) {
        const error = new axios.AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, response)
        throw error
      }
      return response
    }
    const client = axios.create({ baseURL: '/qqq/v1', adapter })
    installRequestIdInterceptor(client)
    installRequestIdInterceptor(client)
    setRequestIdCollection('X-Request-Id')
    await client.get('/metaData', { params: { q: 'secret' } })
    status = 500
    await expect(client.post('/table/x/query')).rejects.toThrow('failed')
    await expect(client.get('/never', { adapter: () => Promise.reject(new Error('network')) })).rejects.toThrow('network')
    expect(recentRequestIds().map(({ id, method, path, status: code }) => ({ id, method, path, code }))).toEqual([
      { id: 'id-200-abc', method: 'GET', path: '/qqq/v1/metaData', code: 200 },
      { id: 'id-500-abc', method: 'POST', path: '/qqq/v1/table/x/query', code: 500 },
    ])
  })
})
