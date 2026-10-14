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

/** @file Jobs discovery and lists shared by the header and Jobs page. */
'use client'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listJobs } from '@/lib/api/jobs'
import { useUiApiFeatureSupported } from '@/lib/api/ui-api-extensions'
import { queryKeys } from '@/lib/query-client'
import { useRealtimeChannel } from './use-realtime-channel'
import { jobAccessDenied, useJobVisibility } from './use-job-progress'
import type { JobListFilter } from '@/types/jobs'

/** Whether the server advertises its durable jobs feature.
 * @returns Capability gate, false while discovering.
 */
export function useJobsInstalled() {
  return useUiApiFeatureSupported('durableJobs')
}

/** Observes a job list with realtime refresh and a ten-second visible-tab fallback.
 * @param enabled - Capability/access gate.
 * @param filter - Mine by default; admin scope is explicitly requested by the Jobs page.
 * @returns Query state.
 */
export function useMyJobs(
  enabled: boolean,
  filter: JobListFilter = { scope: 'mine', state: 'all', limit: 20 }
) {
  const visible = useJobVisibility()
  const query = useQuery({
    queryKey: queryKeys.jobList(filter),
    queryFn: async () => {
      try {
        const data = await listJobs(filter)
        return Array.isArray(data?.jobs) && typeof data.activeCount === 'number' ? data : null
      } catch (error) {
        // Like Alerts, capability/access refusal quietly hides the header feature.
        if (jobAccessDenied(error)) return null
        throw error
      }
    },
    enabled: enabled && visible,
    retry: false,
    staleTime: 10_000,
    refetchInterval: (q) =>
      visible && q.state.data !== null && !jobAccessDenied(q.state.error) ? 10_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })
  const { refetch } = query
  const denied = query.data === null || jobAccessDenied(query.error)
  useEffect(() => {
    if (enabled && visible && !denied) void refetch({ cancelRefetch: false })
  }, [enabled, visible, denied, refetch])
  useRealtimeChannel(
    'user:me',
    ({ event }) => {
      if (!document.hidden && (event === 'job.progress' || event === 'job.status'))
        void refetch({ cancelRefetch: false })
    },
    enabled && visible && !denied
  )
  return query
}
