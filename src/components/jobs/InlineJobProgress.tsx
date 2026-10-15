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

/** @file Adapts inline process status to the shared job view and tracks it before leaving. */
'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { trackJob } from '@/lib/api/jobs'
import { useJobsInstalled } from '@/lib/hooks/use-my-jobs'
import type { ProcessJobProgress } from '@/lib/hooks/use-process'
import { queryKeys } from '@/lib/query-client'
import { JobProgressView } from './JobProgressView'

/** Adapts old counts and new progress/logTail without losing background tracking identifiers.
 * @param props - Inline status and process actions.
 * @returns Shared live view.
 */
export function InlineJobProgress({
  label,
  processName,
  processUUID,
  jobUUID,
  progress,
  onLeave,
  onCancel,
  embedded = false,
}: {
  label: string
  processName: string
  processUUID: string | null
  jobUUID: string | null
  progress: ProcessJobProgress | null
  onLeave: () => void
  onCancel: () => void
  embedded?: boolean
}) {
  const installed = useJobsInstalled()
  const cache = useQueryClient()
  const track = useMutation({
    mutationFn: () => trackJob({ processName, processUUID: processUUID!, jobUUID: jobUUID! }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: queryKeys.jobs() })
      toast.success('Running in the background - find it under Jobs')
      onLeave()
    },
  })
  const snapshot = progress?.progress ?? {
    done: progress?.current,
    total: progress?.total,
    unitLabel: 'rows',
    message: progress?.message,
    percent:
      progress?.total && progress.current != null
        ? (100 * progress.current) / progress.total
        : null,
  }
  return (
    <div data-qqq-id="process-working">
      {track.isError && (
        <p role="alert" className="p-4 text-sm text-destructive">
          Could not move this process to Jobs. It is still running here; try again.
        </p>
      )}
      <JobProgressView
        job={{ jobId: 0, status: 'RUNNING', label }}
        progress={snapshot}
        log={progress?.logTail}
        onBackground={
          installed && processUUID && jobUUID && !embedded ? () => track.mutate() : undefined
        }
        onCancel={processUUID && jobUUID && !embedded ? onCancel : undefined}
        busy={track.isPending}
      />
    </div>
  )
}
