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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from './client'
import { cancelJob, getJob, getJobProgress, listJobs, retryJob, trackJob } from './jobs'

vi.mock('./client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

describe('jobs API', () => {
  beforeEach(() => vi.clearAllMocks())
  it('lists mine by default and forwards all supported filters', async () => {
    const response = { jobs: [], activeCount: 0, generatedAt: 'now' }
    vi.mocked(apiClient.get).mockResolvedValue(response)
    expect(await listJobs()).toBe(response)
    expect(apiClient.get).toHaveBeenLastCalledWith('/jobs', { params: {} })
    const filter = { scope: 'all', state: 'recent', limit: 20, processName: 'backup' } as const
    await listJobs(filter)
    expect(apiClient.get).toHaveBeenLastCalledWith('/jobs', { params: filter })
  })
  it('reads detail and progress using a cursor and a bounded log page', async () => {
    await getJob(42)
    expect(apiClient.get).toHaveBeenLastCalledWith('/jobs/42')
    await getJobProgress(42)
    expect(apiClient.get).toHaveBeenLastCalledWith('/jobs/42/progress', {
      params: { afterLogId: 0, logLimit: 200 },
    })
    await getJobProgress(42, 17, 50)
    expect(apiClient.get).toHaveBeenLastCalledWith('/jobs/42/progress', {
      params: { afterLogId: 17, logLimit: 50 },
    })
  })
  it('cancels, retries and tracks through documented operations', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ jobId: 55 })
    expect(await cancelJob(42)).toEqual({ jobId: 55 })
    expect(apiClient.post).toHaveBeenLastCalledWith('/jobs/42/cancel')
    expect(await retryJob(42)).toEqual({ jobId: 55 })
    expect(apiClient.post).toHaveBeenLastCalledWith('/jobs/42/retry')
    const request = { processName: 'backup', processUUID: 'process', jobUUID: 'async' }
    expect(await trackJob(request)).toEqual({ jobId: 55 })
    expect(apiClient.post).toHaveBeenLastCalledWith('/jobs/track', request)
  })
  it.each([403, 404, 409])(
    'preserves HTTP %s for permission and transition handling',
    async (status) => {
      const error = { response: { status } }
      vi.mocked(apiClient.post).mockRejectedValueOnce(error)
      await expect(cancelJob(42)).rejects.toBe(error)
    }
  )
})
