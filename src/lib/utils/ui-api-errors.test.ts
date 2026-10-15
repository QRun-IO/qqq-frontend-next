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

/** @file BasicErrorResponseV1 message and trace precedence. */
import { AxiosError } from 'axios'
import { expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { queryClient } from '@/lib/query-client'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
import { getErrorMessage, getErrorTraceId } from './error-utils'
import { weekdayCriteriaSettings } from './filter-utils'
import { normalizeProcessResponse } from '@/lib/api/processes'

it('prefers message to both legacy error fields and retains the trace identifier', () => {
  const body = { error: 'Technical', userFacingError: 'Legacy', message: 'Please try another value', traceId: 'trace-123', code: 'VALIDATION' }
  const error = new AxiosError('Transport', undefined, undefined, undefined, { data: body, status: 400, statusText: '', headers: {}, config: {} as never })
  expect(getErrorMessage(error)).toBe(body.message)
  expect(getErrorMessage(body)).toBe(body.message)
  expect(getErrorTraceId(error)).toBe('trace-123')
  expect(normalizeProcessResponse(body)).toMatchObject({ type: 'ERROR', message: body.message, traceId: 'trace-123', code: 'VALIDATION' })
})
it('keeps older-server message precedence when message is absent or blank', () => {
  expect(getErrorMessage({ message: '', userFacingError: 'Friendly', error: 'Technical' })).toBe('Friendly')
  expect(getErrorMessage({ error: 'Technical' })).toBe('Technical')
  expect(getErrorTraceId({ traceId: 123 })).toBeUndefined()
})

it('puts the server message and trace into a global toast while keeping 401 silent', async () => {
  vi.mocked(toast.error).mockClear()
  const failure = (status: number) => new AxiosError('Transport', undefined, undefined, undefined, { data: { message: 'Try another value', error: 'Legacy', traceId: 'trace-toast' }, status, statusText: '', headers: {}, config: {} as never })
  await expect(queryClient.fetchQuery({ queryKey: ['ui-api-16-error'], retry: false, queryFn: async () => { throw failure(400) } })).rejects.toThrow()
  expect(toast.error).toHaveBeenCalledWith('Try another value', { description: 'Trace ID: trace-toast' })
  vi.mocked(toast.error).mockClear()
  await expect(queryClient.fetchQuery({ queryKey: ['ui-api-16-401'], retry: false, queryFn: async () => { throw failure(401) } })).rejects.toThrow()
  expect(toast.error).not.toHaveBeenCalled()
  queryClient.clear()
})

it('prefers client-neutral weekday criteria settings with legacy fallback', () => {
  expect(weekdayCriteriaSettings({ supplementalInstanceMetaData: { uiSettings: { weekdayCriteriaSettings: { enabled: false } }, materialDashboard: { weekdayCriteriaSettings: { enabled: true } } } }).enabled).toBe(false)
  expect(weekdayCriteriaSettings({ supplementalInstanceMetaData: { materialDashboard: { weekdayCriteriaSettings: { enabled: false } } } }).enabled).toBe(false)
})
