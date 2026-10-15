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

import { describe, expect, it, vi } from 'vitest'
import type { JsonValue } from '@jam.dev/recording-links/sdk'
import type { QaCaptureSanitizerV1 } from '@/types/qa-capture'
import {
  buildJamSanitizers,
  compileRules,
  isDroppedPath,
  redactBody,
  redactHeaders,
  redactJson,
  redactText,
  redactUrl,
} from './sanitizers'
import { filterPageUrl } from './page-url'

const ORIGIN = 'https://admin.example.com'
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJl'

const RULES: QaCaptureSanitizerV1 = {
  redaction: '[redacted]',
  headerNames: ['x-api-key'],
  bodyFieldNames: ['ssn', 'apiKey'],
  queryParamNames: ['token'],
  valuePatterns: ['\\b\\d{3}-\\d{2}-\\d{4}\\b'],
  dropPathPrefixes: ['/qqq/v1/secret'],
}

const rules = compileRules(RULES, ORIGIN)
const sanitizers = buildJamSanitizers(RULES, ORIGIN)

describe('QA capture sanitizers', () => {
  it('redacts a secure field in a record body and keeps it valid JSON', () => {
    const body = JSON.stringify({ record: { values: { ssn: '123-45-6789', name: 'x' } } })
    const out = sanitizers.network.requestSanitizer!({ type: 'fetch', url: '/qqq/v1/table/person', method: 'POST', headers: {}, body })
    expect(JSON.parse(out!.body!)).toEqual({ record: { values: { ssn: '[redacted]', name: 'x' } } })
  })

  it('redacts the same secure field in a response body', () => {
    const body = JSON.stringify({ records: [{ values: { ssn: '123-45-6789', name: 'x' } }] })
    const out = sanitizers.network.responseSanitizer!({ url: '/qqq/v1/table/person/query', method: 'POST', status: 200, headers: {}, body })
    expect(JSON.parse(out!.body!)).toEqual({ records: [{ values: { ssn: '[redacted]', name: 'x' } }] })
  })

  it('matches body keys at any depth, case-insensitively, whatever the value type', () => {
    const value: JsonValue = { a: [{ SSN: { nested: 1 } }, { Password: 'p' }], apikey: 42, keep: 'ok', n: null, b: true }
    expect(redactJson(value, rules)).toEqual({ a: [{ SSN: '[redacted]' }, { Password: '[redacted]' }], apikey: '[redacted]', keep: 'ok', n: null, b: true })
  })

  it('removes credential headers from requests and responses (baseline and configured)', () => {
    const request = sanitizers.network.requestSanitizer!({
      type: 'xhr',
      url: '/qqq/v1/metaData',
      method: 'GET',
      body: undefined,
      headers: { authorization: 'Bearer x', cookie: 'sessionUUID=1', 'x-api-key': 'k', accept: 'application/json' },
    })
    expect(request!.headers).toEqual({ accept: 'application/json' })
    expect(request!.body).toBeUndefined()
    const response = sanitizers.network.responseSanitizer!({
      url: '/qqq/v1/metaData',
      method: 'GET',
      status: 200,
      body: undefined,
      headers: { 'set-cookie': 'sessionUUID=1', 'content-type': 'application/json' },
    })
    expect(response!.headers).toEqual({ 'content-type': 'application/json' })
    expect(redactHeaders({ Authorization: 'x' }, rules)).toEqual({})
  })

  it('redacts JWTs and configured patterns in text and console arguments', () => {
    expect(redactText(`token ${JWT} ssn 123-45-6789`, rules)).toBe('token [redacted] ssn [redacted]')
    const log = sanitizers.console.logSanitizer!({
      level: 'log',
      args: [`jwt=${JWT}`, { accessToken: 'abc', user: { ssn: 'x', note: '111-22-3333' } }, 5, null],
    })
    expect(log!.args).toEqual(['jwt=[redacted]', { accessToken: '[redacted]', user: { ssn: '[redacted]', note: '[redacted]' } }, 5, null])
    expect(redactBody(`plain ${JWT}`, rules)).toBe('plain [redacted]')
    expect(redactBody(JSON.stringify([JWT]), rules)).toBe('["[redacted]"]')
  })

  it('redacts form-encoded bodies field by field', () => {
    expect(redactBody('username=bob&password=hunter2&note=123-45-6789', rules)).toBe('username=bob&password=%5Bredacted%5D&note=%5Bredacted%5D')
  })

  it('keeps invalid JSON as text with patterns applied', () => {
    expect(redactBody('{"ssn": "123-45-6789"', rules)).toBe('{"ssn": "[redacted]"')
  })

  it('redacts query parameters, keeping relative URLs relative', () => {
    expect(redactUrl('/qqq/v1/x?token=abc&keep=1', rules)).toBe('/qqq/v1/x?token=%5Bredacted%5D&keep=1')
    expect(redactUrl('https://idp.example.com/cb?code=abc&STATE=s', rules)).toBe('https://idp.example.com/cb?code=%5Bredacted%5D&STATE=%5Bredacted%5D')
    expect(redactUrl(`/x/${JWT}`, rules)).toBe('/x/[redacted]')
    expect(redactUrl('http://[bad', rules)).toBe('http://[bad')
    const request = sanitizers.network.requestSanitizer!({ type: 'resource', url: 'https://admin.example.com/a?token=t', method: undefined, headers: {}, body: undefined })
    expect(request!.url).toBe('https://admin.example.com/a?token=%5Bredacted%5D')
  })

  it('drops bodies for same-origin paths under a drop prefix only', () => {
    expect(isDroppedPath('/qqq/v1/secret/1', rules)).toBe(true)
    expect(isDroppedPath('https://other.example.com/qqq/v1/secret/1', rules)).toBe(false)
    expect(isDroppedPath('/qqq/v1/public', rules)).toBe(false)
    expect(isDroppedPath('http://[bad', rules)).toBe(false)
    const request = sanitizers.network.requestSanitizer!({ type: 'fetch', url: '/qqq/v1/secret/1', method: 'POST', headers: {}, body: '{"a":1}' })
    expect(request!.body).toBeUndefined()
    const response = sanitizers.network.responseSanitizer!({ url: '/qqq/v1/secret/1', method: 'POST', status: 200, headers: {}, body: '{"a":1}' })
    expect(response!.body).toBeUndefined()
    expect(isDroppedPath('/x', compileRules({ ...RULES, dropPathPrefixes: [] }, ORIGIN))).toBe(false)
  })

  it('is deterministic (Jam runs the request sanitizer twice) and does not mutate its input', () => {
    const input = { type: 'fetch' as const, url: '/a?token=1', method: 'POST', headers: { cookie: 'c' }, body: '{"ssn":"1"}' }
    const first = sanitizers.network.requestSanitizer!({ ...input, headers: { ...input.headers } })
    const second = sanitizers.network.requestSanitizer!({ ...input, headers: { ...input.headers } })
    expect(first).toEqual(second)
    sanitizers.network.requestSanitizer!(input)
    expect(input.headers).toEqual({ cookie: 'c' })
  })

  it('sanitizes WebSocket frames', () => {
    const frame = sanitizers.network.webSocketSanitizer!({ action: 'receive', url: 'wss://admin.example.com/ws', data: JSON.stringify({ ssn: '1', jwt: JWT }) })
    expect(JSON.parse(frame!.data)).toEqual({ ssn: '[redacted]', jwt: '[redacted]' })
  })

  it('never logs or fetches', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const logSpy = vi.spyOn(console, 'log')
    const warnSpy = vi.spyOn(console, 'warn')
    const errorSpy = vi.spyOn(console, 'error')
    sanitizers.network.requestSanitizer!({ type: 'fetch', url: '/a', method: 'POST', headers: {}, body: '{"ssn":"1"}' })
    sanitizers.console.logSanitizer!({ level: 'error', args: ['x'] })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('fails closed (throws, so Jam redacts) when a pattern is invalid', () => {
    const broken = buildJamSanitizers({ ...RULES, valuePatterns: ['(unclosed'] }, ORIGIN)
    expect(() => broken.network.requestSanitizer!({ type: 'fetch', url: '/a', method: 'POST', headers: {}, body: 'x' })).toThrow()
    expect(() => broken.network.responseSanitizer!({ url: '/a', method: 'POST', status: 200, headers: {}, body: 'x' })).toThrow()
    expect(() => broken.console.logSanitizer!({ level: 'log', args: ['x'] })).toThrow()
    expect(() => broken.network.webSocketSanitizer!({ action: 'send', url: 'wss://x', data: 'x' })).toThrow()
  })

  it('uses a default redaction and ignores empty patterns and relative drop prefixes', () => {
    const compiled = compileRules({ ...RULES, redaction: '', valuePatterns: [''], dropPathPrefixes: ['nope'] }, ORIGIN)
    expect(compiled.redaction).toBe('[redacted]')
    expect(compiled.dropPathPrefixes).toEqual([])
    expect(compiled.invalidPattern).toBeNull()
  })

  it('filters the page URL: configured, baseline and jam-* parameters removed', () => {
    expect(filterPageUrl('https://a.example.com/app/x?token=1&code=2&jam-recording=r&keep=y#h', ['token'])).toBe('https://a.example.com/app/x?keep=y#h')
    expect(filterPageUrl('not a url?token=1', [])).toBe('not a url')
  })
})
