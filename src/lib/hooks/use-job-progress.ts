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

/** @file Shared cursor-based job progress, with realtime hints and visible-tab polling. */
'use client'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getJobProgress } from '@/lib/api/jobs'
import { queryKeys } from '@/lib/query-client'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { useRealtimeChannel } from './use-realtime-channel'
import type { JobLogLineV1, JobProgressPollV1 } from '@/types/jobs'

/** Observes visibility so disabled queries also pause while the document is hidden.
 * @returns Whether the document is visible.
 */
export function useJobVisibility() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const change = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])
  return visible
}

/** Merges the server's overlapping cursor window in chronological id order.
 * @param previous - Already received lines.
 * @param incoming - New window, possibly overlapping or out of order.
 * @returns Unique lines.
 */
export function mergeJobLog(previous: JobLogLineV1[], incoming: JobLogLineV1[]) {
  return [...new Map([...previous, ...incoming].map((line) => [line.id, line])).values()].sort(
    (a, b) => a.id - b.id
  )
}

/** A refused or invisible resource must not be polled indefinitely.
 * @param error - Request failure.
 * @returns Whether polling should stop.
 */
export function jobAccessDenied(error: unknown) {
  const status = getErrorStatusCode(error)
  return status === 401 || status === 403 || status === 404
}

/** Observes one job; the cursor lives with its cached log, never in a different job's ref.
 * @param jobId - Job identifier, or undefined before launch.
 * @param enabled - Server capability gate.
 * @returns The progress query with accumulated log lines.
 */
export function useJobProgress(jobId: number | undefined, enabled = true) {
  const cache = useQueryClient()
  const visible = useJobVisibility()
  const lastHint = useRef(0)
  const id = jobId ?? 0
  const query = useQuery({
    queryKey: queryKeys.jobProgress(id),
    queryFn: async () => {
      const previous = cache.getQueryData<JobProgressPollV1>(queryKeys.jobProgress(id))
      let cursor = previous?.nextAfterLogId ?? 0
      let log = previous?.log ?? []
      let response: JobProgressPollV1
      // Drain a terminal snapshot too: the final event can arrive before the last log page.
      do {
        response = await getJobProgress(id, cursor)
        log = mergeJobLog(log, response.log ?? [])
        const advanced = response.nextAfterLogId > cursor
        cursor = Math.max(cursor, response.nextAfterLogId)
        if (!advanced) break
      } while (cursor < (response.job.logSeq ?? 0))
      return { ...response, log, nextAfterLogId: cursor }
    },
    enabled: enabled && jobId !== undefined && visible,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
  const stopped = query.data?.terminal === true || jobAccessDenied(query.error)
  const { refetch } = query
  useRealtimeChannel(
    `record:jobs_job:${id}`,
    ({ event, data }) => {
      if (document.hidden || String(data.jobId) !== String(id)) return
      if (event !== 'job.progress' && event !== 'job.status') return
      lastHint.current = Date.now()
      // Even without new log lines a phase or measurement may have changed.
      void refetch({ cancelRefetch: false })
    },
    enabled && jobId !== undefined && visible && !stopped
  )
  useEffect(() => {
    if (!enabled || jobId === undefined || !visible || stopped) return
    void refetch({ cancelRefetch: false })
    const timer = setInterval(() => {
      if (!document.hidden && Date.now() - lastHint.current >= 1000)
        void refetch({ cancelRefetch: false })
    }, 1000)
    return () => clearInterval(timer)
  }, [enabled, jobId, visible, stopped, refetch])
  return query
}
