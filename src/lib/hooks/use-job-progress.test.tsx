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

import React, { type ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { getJobProgress, listJobs } from '@/lib/api/jobs'
import { useJobProgress, mergeJobLog } from './use-job-progress'
import { useMyJobs } from './use-my-jobs'
import type { RealtimeEvent } from '@/lib/realtime/client'
import type { JobProgressPollV1 } from '@/types/jobs'

const subscriptions = vi.hoisted(() => new Map<string, (event: RealtimeEvent) => void>())
vi.mock('@/lib/api/jobs', () => ({ getJobProgress: vi.fn(), listJobs: vi.fn() }))
vi.mock('./use-realtime-channel', async () => {
  const { useEffect } = await import('react')
  return {
    useRealtimeChannel: (
      channel: string,
      receive: (event: RealtimeEvent) => void,
      enabled: boolean
    ) => {
      useEffect(() => {
        if (enabled) subscriptions.set(channel, receive)
        return () => {
          subscriptions.delete(channel)
        }
      }, [channel, receive, enabled])
    },
  }
})

const line = (id: number) => ({ id, level: 'INFO', message: `Line ${id}` })
const poll = (overrides: Partial<JobProgressPollV1> = {}): JobProgressPollV1 => ({
  job: { jobId: 42, status: 'RUNNING', logSeq: 1 },
  progress: { percent: 25 },
  log: [line(1)],
  nextAfterLogId: 1,
  logDropped: 0,
  terminal: false,
  ...overrides,
})
const tick = async (ms = 1) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}
const hidden = (value: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value })
  document.dispatchEvent(new Event('visibilitychange'))
}
const wrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('job progress lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    hidden(false)
    vi.mocked(getJobProgress).mockResolvedValue(poll())
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    hidden(false)
  })
  it('subscribes to the job and uses the last cursor on realtime hints, deduping overlap', async () => {
    const { result } = renderHook(() => useJobProgress(42), { wrapper: wrapper() })
    await tick()
    expect(subscriptions.has('record:jobs_job:42')).toBe(true)
    vi.mocked(getJobProgress).mockResolvedValue(
      poll({
        job: { jobId: 42, status: 'RUNNING', logSeq: 2 },
        log: [line(2), line(1)],
        nextAfterLogId: 2,
      })
    )
    act(() =>
      subscriptions.get('record:jobs_job:42')?.({
        event: 'job.progress',
        data: { jobId: 42, logSeq: 2 },
      })
    )
    await tick()
    expect(getJobProgress).toHaveBeenLastCalledWith(42, 1)
    expect(result.current.data?.log.map((item) => item.id)).toEqual([1, 2])
  })
  it('polls once per second without realtime and stops after terminal including final logs', async () => {
    const { result } = renderHook(() => useJobProgress(42), { wrapper: wrapper() })
    await tick()
    const initial = vi.mocked(getJobProgress).mock.calls.length
    await tick(1000)
    expect(getJobProgress).toHaveBeenCalledTimes(initial + 1)
    vi.mocked(getJobProgress)
      .mockResolvedValue(
        poll({
          job: { jobId: 42, status: 'COMPLETED', logSeq: 3 },
          log: [line(2)],
          nextAfterLogId: 2,
          terminal: true,
        })
      )
      .mockResolvedValueOnce(
        poll({
          job: { jobId: 42, status: 'COMPLETED', logSeq: 3 },
          log: [line(2)],
          nextAfterLogId: 2,
          terminal: true,
        })
      )
      .mockResolvedValueOnce(
        poll({
          job: { jobId: 42, status: 'COMPLETED', logSeq: 3 },
          log: [line(3)],
          nextAfterLogId: 3,
          terminal: true,
        })
      )
    await tick(1000)
    expect(result.current.data?.log).toHaveLength(3)
    const finished = vi.mocked(getJobProgress).mock.calls.length
    await tick(5000)
    expect(getJobProgress).toHaveBeenCalledTimes(finished)
    expect(subscriptions.has('record:jobs_job:42')).toBe(false)
  })
  it('pauses in hidden tabs, including realtime hints, and catches up on visibility', async () => {
    renderHook(() => useJobProgress(42), { wrapper: wrapper() })
    await tick()
    act(() => hidden(true))
    const count = vi.mocked(getJobProgress).mock.calls.length
    await tick(5000)
    expect(getJobProgress).toHaveBeenCalledTimes(count)
    expect(subscriptions.has('record:jobs_job:42')).toBe(false)
    act(() => hidden(false))
    await tick()
    expect(vi.mocked(getJobProgress).mock.calls.length).toBeGreaterThan(count)
  })
  it('does not fetch before enabled or when first mounted hidden', async () => {
    hidden(true)
    renderHook(() => useJobProgress(42), { wrapper: wrapper() })
    renderHook(() => useJobProgress(undefined), { wrapper: wrapper() })
    await tick(5000)
    expect(getJobProgress).not.toHaveBeenCalled()
  })
  it('ignores unrelated jobs and unrelated events', async () => {
    renderHook(() => useJobProgress(42), { wrapper: wrapper() })
    await tick()
    const count = vi.mocked(getJobProgress).mock.calls.length
    act(() => {
      subscriptions.get('record:jobs_job:42')?.({ event: 'job.progress', data: { jobId: 99 } })
      subscriptions.get('record:jobs_job:42')?.({ event: 'record.changed', data: { jobId: 42 } })
    })
    await tick()
    expect(getJobProgress).toHaveBeenCalledTimes(count)
  })
  it('refreshes status changes without logSeq and isolates cursors between jobs', async () => {
    const { rerender } = renderHook(({ id }) => useJobProgress(id), {
      initialProps: { id: 42 },
      wrapper: wrapper(),
    })
    await tick()
    act(() =>
      subscriptions.get('record:jobs_job:42')?.({ event: 'job.status', data: { jobId: 42 } })
    )
    await tick()
    expect(getJobProgress).toHaveBeenLastCalledWith(42, 1)
    rerender({ id: 55 })
    await tick()
    expect(getJobProgress).toHaveBeenLastCalledWith(55, 0)
  })
  it('stops polling on permission denial', async () => {
    vi.mocked(getJobProgress).mockRejectedValue(
      new AxiosError('Forbidden', undefined, undefined, undefined, { status: 403 } as never)
    )
    renderHook(() => useJobProgress(42), { wrapper: wrapper() })
    await tick()
    const count = vi.mocked(getJobProgress).mock.calls.length
    await tick(3000)
    expect(getJobProgress).toHaveBeenCalledTimes(count)
  })
  it('sorts late committed log lines and replaces overlapping ids', () => {
    expect(mergeJobLog([line(3), line(1)], [{ ...line(1), message: 'updated' }, line(2)])).toEqual([
      { ...line(1), message: 'updated' },
      line(2),
      line(3),
    ])
  })
})

describe('my jobs', () => {
  it('quietly stops polling after access is refused', async () => {
    vi.mocked(listJobs).mockRejectedValue(
      new AxiosError('Forbidden', undefined, undefined, undefined, { status: 403 } as never)
    )
    const { result } = renderHook(() => useMyJobs(true), { wrapper: wrapper() })
    await tick()
    expect(result.current.data).toBeNull()
    expect(result.current.isError).toBe(false)
    const calls = vi.mocked(listJobs).mock.calls.length
    await tick(20_000)
    expect(listJobs).toHaveBeenCalledTimes(calls)
  })
  it('treats a legacy SPA response as unavailable', async () => {
    vi.mocked(listJobs).mockResolvedValue('<html>not a jobs endpoint</html>' as never)
    const { result } = renderHook(() => useMyJobs(true), { wrapper: wrapper() })
    await tick()
    expect(result.current.data).toBeNull()
  })
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    hidden(false)
    vi.mocked(listJobs).mockResolvedValue({ jobs: [], activeCount: 0, generatedAt: 'now' })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    hidden(false)
  })
  it('subscribes to user:me, refreshes on job events and polls at ten seconds', async () => {
    renderHook(() => useMyJobs(true), { wrapper: wrapper() })
    await tick()
    expect(subscriptions.has('user:me')).toBe(true)
    const initial = vi.mocked(listJobs).mock.calls.length
    await tick(9990)
    expect(listJobs).toHaveBeenCalledTimes(initial)
    await tick(20)
    expect(listJobs).toHaveBeenCalledTimes(initial + 1)
    act(() => subscriptions.get('user:me')?.({ event: 'job.status', data: { jobId: 42 } }))
    await tick()
    expect(listJobs).toHaveBeenCalledTimes(initial + 2)
  })
  it('does not poll while hidden and does not request when disabled', async () => {
    renderHook(() => useMyJobs(false), { wrapper: wrapper() })
    await tick()
    expect(listJobs).not.toHaveBeenCalled()
    renderHook(() => useMyJobs(true), { wrapper: wrapper() })
    await tick()
    act(() => hidden(true))
    const count = vi.mocked(listJobs).mock.calls.length
    await tick(20_000)
    expect(listJobs).toHaveBeenCalledTimes(count)
  })
})
