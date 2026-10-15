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
import { expect, it } from 'vitest'
import { getErrorMessage, getErrorTraceId } from './error-utils'
import { weekdayCriteriaSettings } from './filter-utils'
import { normalizeProcessResponse } from '@/lib/api/processes'

it('keeps the legacy message precedence and retains the trace identifier', () => {
  const body = { error: 'Technical', userFacingError: 'Legacy', message: 'Please try another value', traceId: 'trace-123', code: 'VALIDATION' }
  const error = new AxiosError('Transport', undefined, undefined, undefined, { data: body, status: 400, statusText: '', headers: {}, config: {} as never })
  expect(getErrorMessage(error)).toBe('Legacy')
  expect(getErrorMessage({ message: 'Please try another value', traceId: 'trace-123' })).toBe('Please try another value')
  expect(getErrorTraceId(error)).toBe('trace-123')
  expect(normalizeProcessResponse(body)).toMatchObject({ type: 'ERROR', message: body.message, traceId: 'trace-123', code: 'VALIDATION' })
})
it('keeps older-server message precedence when message is absent or blank', () => {
  expect(getErrorMessage({ message: '', userFacingError: 'Friendly', error: 'Technical' })).toBe('Friendly')
  expect(getErrorMessage({ error: 'Technical' })).toBe('Technical')
  expect(getErrorTraceId({ traceId: 123 })).toBeUndefined()
})

it('prefers client-neutral weekday criteria settings with legacy fallback', () => {
  expect(weekdayCriteriaSettings({ supplementalInstanceMetaData: { uiSettings: { weekdayCriteriaSettings: { enabled: false } }, materialDashboard: { weekdayCriteriaSettings: { enabled: true } } } }).enabled).toBe(false)
  expect(weekdayCriteriaSettings({ supplementalInstanceMetaData: { materialDashboard: { weekdayCriteriaSettings: { enabled: false } } } }).enabled).toBe(false)
})
