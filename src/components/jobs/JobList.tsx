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

/** @file Full-width job rows shared by the tray and jobs page. */
'use client'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import type { JobSummaryV1 } from '@/types/jobs'
import { JobProgressBar } from './JobProgressBar'
import { JobStatusChip } from './JobProgressView'
import { isJobTerminal, jobDuration } from './job-display'

/** Renders readable rows without a horizontally scrolling table.
 * @param props - Jobs, list label and optional close callback.
 * @returns Job list or empty state.
 */
export function JobList({
  jobs,
  label,
  onOpen,
}: {
  jobs: JobSummaryV1[]
  label: string
  onOpen?: () => void
}) {
  if (!jobs.length)
    return (
      <p className="p-4 text-sm text-muted-foreground" data-qqq-id="jobs-empty">
        No {label.toLowerCase()} jobs.
      </p>
    )
  return (
    <ul aria-label={label} className="divide-y divide-border">
      {jobs.map((job) => {
        const terminal = isJobTerminal(job.status)
        const finish = job.finishedAt ? Date.parse(job.finishedAt) : NaN
        const start = job.startedAt ? Date.parse(job.startedAt) : NaN
        return (
          <li key={job.jobId}>
            <Link
              href={`/app/jobs/${job.jobId}`}
              onClick={onOpen}
              data-qqq-id={`link-job-${job.jobId}`}
              className="block min-w-0 space-y-2 p-4 hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-medium">
                  {job.label ?? 'Background job'}
                </span>
                <JobStatusChip status={job.status} />
              </div>
              {!terminal ? (
                <>
                  <p className="break-words text-xs text-muted-foreground">
                    {job.message ?? job.currentPhase ?? 'Preparing…'}
                  </p>
                  <JobProgressBar
                    key={job.startedAt}
                    percent={job.percent}
                    label={`${job.label ?? 'Job'} progress`}
                  />
                  <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {job.percent == null ? 'In progress' : `${Math.round(job.percent)}%`}
                    </span>
                    <span>
                      {job.etaSeconds == null
                        ? 'ETA unknown'
                        : `ETA ${jobDuration(job.etaSeconds)}`}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {Number.isFinite(finish - start)
                    ? `Duration ${jobDuration((finish - start) / 1000)} · `
                    : ''}
                  {Number.isFinite(finish)
                    ? formatDistanceToNow(finish, { addSuffix: true })
                    : 'Finished'}
                </p>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
