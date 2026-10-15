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

/** @file Connected job detail, server-authorized controls and actionable loading failures. */
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cancelJob, getJob, retryJob } from '@/lib/api/jobs'
import { useJobProgress, useJobVisibility } from '@/lib/hooks/use-job-progress'
import { queryKeys } from '@/lib/query-client'
import { pickerRecordPath } from '@/lib/utils/record-picker'
import { JobProgressView } from './JobProgressView'

/** Loads a job for its page or the process that launched it.
 * @param props - Identifier and optional process leave/countdown behavior.
 * @returns Connected live view.
 */
export function JobDetailView({
  jobId,
  onLeave,
  autoBackground = false,
}: {
  jobId: number
  onLeave?: () => void
  autoBackground?: boolean
}) {
  const router = useRouter()
  const cache = useQueryClient()
  const visible = useJobVisibility()
  const detail = useQuery({
    queryKey: queryKeys.jobDetail(jobId),
    queryFn: () => getJob(jobId),
    enabled: visible,
    retry: false,
  })
  const live = useJobProgress(jobId)
  const status = live.data?.job.status
  const detailStatus = detail.data?.status
  const refreshDetail = detail.refetch
  useEffect(() => {
    if (status && detailStatus && status !== detailStatus) void refreshDetail()
  }, [status, detailStatus, refreshDetail])
  const action = useMutation({
    mutationFn: (kind: 'cancel' | 'retry') =>
      kind === 'cancel' ? cancelJob(jobId) : retryJob(jobId),
    onSuccess: async (result, kind) => {
      if (kind === 'retry') {
        await cache.resetQueries({ queryKey: queryKeys.jobProgress(result.jobId) })
        router.push(`/app/jobs/${result.jobId}`)
      }
      await cache.invalidateQueries({ queryKey: queryKeys.jobs() })
    },
  })
  const leave = () => (onLeave ? onLeave() : router.push('/app/jobs'))
  if (!detail.data && detail.isPending)
    return (
      <p role="status" className="p-6">
        Loading job…
      </p>
    )
  if (!detail.data)
    return (
      <div role="alert" className="space-y-3 p-6">
        <p>Could not load this job. It may be unavailable or you may not have access.</p>
        <button
          type="button"
          onClick={() => void detail.refetch()}
          data-qqq-id="button-job-reload"
          className="min-h-11 rounded border border-border px-4"
        >
          Try again
        </button>
      </div>
    )
  const job = live.data?.job ?? detail.data
  // Never use stale permissions across a status transition.
  const actions = detail.data.status === job.status ? (detail.data.actions ?? []) : []
  return (
    <>
      {live.isError && (
        <p role="status" className="px-6 pt-4 text-sm text-destructive">
          Live updates are unavailable. Showing the last received progress.
        </p>
      )}
      {action.isError && (
        <p role="alert" className="px-6 pt-4 text-sm text-destructive">
          The action could not be completed. Refresh the job and try again.
        </p>
      )}
      <JobProgressView
        key={`${jobId}-${job.startedAt ?? ''}`}
        job={job}
        progress={live.data?.progress ?? detail.data.progress}
        log={live.data?.log}
        logDropped={live.data?.logDropped}
        onBackground={() => {
          toast.success('Running in the background - find it under Jobs')
          leave()
        }}
        onCancel={actions.includes('cancel') ? () => action.mutate('cancel') : undefined}
        onRetry={
          actions.includes('retry') &&
          ['FAILED', 'COMPLETED_WITH_ERRORS', 'NEEDS_REVIEW'].includes(job.status)
            ? () => action.mutate('retry')
            : undefined
        }
        onDone={leave}
        recordHref={pickerRecordPath('jobs_job', jobId)}
        autoBackground={autoBackground}
        busy={action.isPending}
      />
    </>
  )
}
