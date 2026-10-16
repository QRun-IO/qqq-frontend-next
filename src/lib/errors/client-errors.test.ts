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

import { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildClientErrorReport,
  clientErrorDetails,
  MAX_REPORTS_PER_SESSION,
  redactClientErrorText,
  reportClientError,
  requestIdOf,
  resetClientErrorsForTesting,
  setClientErrorSink,
} from './client-errors'

describe('client error reports', () => {
  beforeEach(() => {
    resetClientErrorsForTesting()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('redacts emails, long numbers, tokens and query values', () => {
    const text = redactClientErrorText('jane@example.com phoned +1 (555) 123-4567 ssn 123-45-6789 at /app/x?mrn=99 eyJa.eyJb.sig')
    expect(text).not.toMatch(/jane|555|6789|mrn=99|eyJ/)
    expect(text).toContain('[email]')
    expect(text).toContain('?mrn=[value]')
  })

  it('keeps ids, bounds text and drops content-free fields', () => {
    const error = new TypeError(`Cannot read properties of undefined (reading 'length') ${'x'.repeat(900)}`)
    const report = buildClientErrorReport(error, { scope: 'assistant-render', conversationId: 4, messageId: -2, renderType: 'records' }, new Date('2026-10-15T00:00:00Z'))
    expect(report).toMatchObject({ scope: 'assistant-render', errorName: 'TypeError', conversationId: 4, renderType: 'records', occurredAt: '2026-10-15T00:00:00.000Z' })
    expect(report.message.length).toBeLessThanOrEqual(500)
    expect(report).not.toHaveProperty('messageId')
    expect(clientErrorDetails(report)).toContain('Result type: records')
  })

  it('reads the request id from the error, then the X-Request-Id header', () => {
    expect(requestIdOf(Object.assign(new Error('x'), { requestId: 'req-1' }))).toBe('req-1')
    const headers = new AxiosHeaders({ 'x-request-id': 'req-2' })
    const axiosError = new AxiosError('boom', '500', undefined, undefined, { status: 500, statusText: '', headers, config: { headers }, data: {} })
    expect(requestIdOf(axiosError)).toBe('req-2')
  })

  it('sends once per duplicate window and stops at the per-session cap, never throwing', async () => {
    const sink = vi.fn().mockRejectedValue(new Error('offline'))
    setClientErrorSink(sink)
    reportClientError(new Error('same'), { scope: 'widget' })
    reportClientError(new Error('same'), { scope: 'widget' })
    expect(sink).toHaveBeenCalledTimes(1)
    for (let index = 0; index < MAX_REPORTS_PER_SESSION + 5; index++) reportClientError(new Error(`e${index}`), { scope: 'widget' })
    expect(sink).toHaveBeenCalledTimes(MAX_REPORTS_PER_SESSION)
    expect(console.error).toHaveBeenCalled()
  })
})
