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

vi.mock('@/lib/api/qa-capture', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/qa-capture')>()),
  createQaCaptureReport: vi.fn(),
}))
vi.mock('./jam-loader', () => ({ openJamRecorder: vi.fn() }))

import { createQaCaptureReport, normalizeQaCaptureCapability } from '@/lib/api/qa-capture'
import { openJamRecorder } from './jam-loader'
import { currentReportReference, defaultReportTitle, resetBugReportForTesting, startBugReport } from './report'
import { recordRequestId, resetRequestIds, setRequestIdCollection } from './request-ids'

const CAPABILITY = normalizeQaCaptureCapability({
  enabled: true,
  provider: 'jam',
  providerConfig: { teamId: 'team-1', recordingLinkId: 'abc123' },
  canReport: true,
  sanitizer: { queryParamNames: ['token'] },
})

const META = { tables: { blog_post: {} }, processes: {}, apps: {} }

afterEach(() => {
  vi.clearAllMocks()
  resetRequestIds()
  resetBugReportForTesting()
})

describe('Report a bug', () => {
  it('posts the page context, then opens the recorder with the report title and reference', async () => {
    setRequestIdCollection('x-request-id')
    recordRequestId({ url: '/qqq/v1/table/blog_post/42', status: 200, headers: { 'x-request-id': 'req-00000001' } })
    const recordingParams = { 'jam-recording': 'abc123', 'jam-title': 'Bug on blog_post 42', 'jam-reference': 'qa-3f2a' }
    vi.mocked(createQaCaptureReport).mockResolvedValueOnce({ id: 7, reference: 'qa-3f2a', title: 'Bug on blog_post 42', recordingParams })

    const outcome = await startBugReport({
      capability: CAPABILITY,
      metaData: META,
      location: { href: 'https://admin.example.com/app/blog_post/42?token=secret&tab=1', pathname: '/app/blog_post/42' },
      pageTitle: 'Blog Post 42 | QQQ Admin',
    })

    expect(createQaCaptureReport).toHaveBeenCalledWith(expect.objectContaining({
      pageUrl: 'https://admin.example.com/app/blog_post/42?tab=1',
      title: 'Bug: Blog Post 42 | QQQ Admin',
      appName: null,
      tableName: 'blog_post',
      recordId: '42',
      processName: null,
      requestIds: ['req-00000001'],
      viewport: expect.stringMatching(/^\d+x\d+$/),
    }))
    expect(openJamRecorder).toHaveBeenCalledWith(CAPABILITY, recordingParams)
    expect(outcome.kind).toBe('opened')
    expect(currentReportReference()).toBe('qa-3f2a')
  })

  it('does not open the recorder when no Recording Link is configured', async () => {
    vi.mocked(createQaCaptureReport).mockResolvedValueOnce({ id: 8, reference: 'qa-1', title: null, recordingParams: null })
    const outcome = await startBugReport({ capability: CAPABILITY, location: { href: 'https://a.example.com/', pathname: '/' }, pageTitle: '' })
    expect(outcome.kind).toBe('no-recording-link')
    expect(openJamRecorder).not.toHaveBeenCalled()
    expect(vi.mocked(createQaCaptureReport).mock.calls[0][0].title).toBe('Bug report')
  })

  it('propagates report and recorder failures', async () => {
    vi.mocked(createQaCaptureReport).mockRejectedValueOnce(new Error('Permission denied.'))
    await expect(startBugReport({ capability: CAPABILITY })).rejects.toThrow('Permission denied.')
    vi.mocked(createQaCaptureReport).mockResolvedValueOnce({ id: 1, reference: '', title: null, recordingParams: { 'jam-recording': 'r' } })
    vi.mocked(openJamRecorder).mockRejectedValueOnce(new Error('script blocked'))
    await expect(startBugReport({ capability: CAPABILITY })).rejects.toThrow('script blocked')
    expect(currentReportReference()).toBeNull()
  })

  it('caps the default title', () => {
    expect(defaultReportTitle('x'.repeat(500))).toHaveLength(200)
  })
})
