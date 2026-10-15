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

import { afterEach, describe, expect, it, vi } from 'vitest'
import spec from './openapi/extensions/qa-capture.json'

vi.mock('./client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import apiClient from './client'
import { createQaCaptureReport, getQaCaptureCapability, normalizeQaCaptureCapability } from './qa-capture'

const ENABLED = {
  enabled: true,
  reason: 'AUDIENCE',
  provider: 'jam',
  providerConfig: { teamId: 'team-1', recordingLinkId: 'abc123', scriptUrls: ['https://js.jam.dev/recorder.js'] },
  qaMode: { available: true, active: false, preferenceSection: 'qa-capture' },
  canReport: true,
  reportsHref: '/app/qa_capture_report',
  sanitizer: { redaction: '[x]', headerNames: ['Authorization'], bodyFieldNames: ['password'], queryParamNames: ['code'], valuePatterns: ['eyJ'], dropPathPrefixes: [] },
  blurSelectors: ['[data-qqq-secure]'],
  cspOrigins: { scriptSrc: ['https://js.jam.dev'], frameSrc: ['https://*.jam.dev'], connectSrc: ['https://*.jam.dev'] },
  context: { environment: 'prod', backendVersion: '0.1.110', node: 'n1' },
  requestIdHeader: 'X-Request-Id',
}

afterEach(() => vi.clearAllMocks())

describe('qa-capture API', () => {
  it('vendors the extension document with both operations', () => {
    expect(spec.info.version).toBe('1.0.0')
    expect(spec.paths['/qqq/v1/qbit/qa-capture/capability'].get.operationId).toBe('qaCaptureCapability')
    expect(spec.paths['/qqq/v1/qbit/qa-capture/report'].post.operationId).toBe('qaCaptureReportCreate')
  })

  it('loads and normalizes the capability', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(ENABLED)
    const capability = await getQaCaptureCapability()
    expect(apiClient.get).toHaveBeenCalledWith('/qbit/qa-capture/capability')
    expect(capability).toMatchObject({
      enabled: true,
      provider: 'jam',
      providerConfig: { teamId: 'team-1', recordingLinkId: 'abc123' },
      canReport: true,
      reportsHref: '/app/qa_capture_report',
      sanitizer: { redaction: '[x]', headerNames: ['authorization'] },
      requestIdHeader: 'X-Request-Id',
      context: { environment: 'prod' },
    })
  })

  it('reads anything incomplete or unknown as disabled', () => {
    for (const body of [null, [], 'x', { enabled: false }, { ...ENABLED, provider: 'other' }, { ...ENABLED, providerConfig: null }, { ...ENABLED, providerConfig: { teamId: '' } }, { ...ENABLED, sanitizer: null }]) {
      const capability = normalizeQaCaptureCapability(body)
      expect(capability.enabled).toBe(false)
      expect(capability.canReport).toBe(false)
      expect(capability.providerConfig).toBeNull()
      expect(capability.sanitizer).toBeNull()
      expect(capability.blurSelectors).toEqual([])
    }
    const bare = normalizeQaCaptureCapability({})
    expect(bare).toMatchObject({ reason: 'OFF', requestIdHeader: 'X-Request-Id', qaMode: { available: false, active: false, preferenceSection: null } })
  })

  it('follows only in-app report links and fills sanitizer defaults', () => {
    expect(normalizeQaCaptureCapability({ ...ENABLED, reportsHref: '//evil.example.com' }).reportsHref).toBeNull()
    expect(normalizeQaCaptureCapability({ ...ENABLED, reportsHref: 'https://evil.example.com' }).reportsHref).toBeNull()
    const capability = normalizeQaCaptureCapability({ ...ENABLED, sanitizer: { headerNames: 'x' } })
    expect(capability.sanitizer).toEqual({ redaction: '[redacted]', headerNames: [], bodyFieldNames: [], queryParamNames: [], valuePatterns: [], dropPathPrefixes: [] })
  })

  it('creates a report and keeps only jam-* recording parameters', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      id: 7,
      reference: 'qa-3f2a',
      title: 'Bug on blog_post 42',
      recordingParams: { 'jam-recording': 'abc123', 'jam-title': 'Bug on blog_post 42', 'jam-reference': 'qa-3f2a', other: 'x', 'jam-n': 1 },
    })
    const report = await createQaCaptureReport({ pageUrl: 'https://a.example.com/app/blog_post/42' })
    expect(apiClient.post).toHaveBeenCalledWith('/qbit/qa-capture/report', { pageUrl: 'https://a.example.com/app/blog_post/42' })
    expect(report).toEqual({
      id: 7,
      reference: 'qa-3f2a',
      title: 'Bug on blog_post 42',
      recordingParams: { 'jam-recording': 'abc123', 'jam-title': 'Bug on blog_post 42', 'jam-reference': 'qa-3f2a' },
    })
  })

  it('treats a report without a recording id as having no Recording Link', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ id: 8, reference: 'qa-1', recordingParams: null })
    expect((await createQaCaptureReport({ pageUrl: 'x' })).recordingParams).toBeNull()
    vi.mocked(apiClient.post).mockResolvedValueOnce({ recordingParams: { 'jam-title': 't' } })
    expect(await createQaCaptureReport({ pageUrl: 'x' })).toEqual({ id: 0, reference: '', title: null, recordingParams: null })
    vi.mocked(apiClient.post).mockResolvedValueOnce(null)
    expect((await createQaCaptureReport({ pageUrl: 'x' })).recordingParams).toBeNull()
  })
})
