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

/** @file Shared live view for durable jobs and inline async process progress. */
'use client'
import { useEffect, useRef, useState } from 'react'
import type { JobLogLineV1, JobProgressV1, JobSummaryV1 } from '@/types/jobs'
import { ProcessCancelDialog } from '@/components/process/ProcessCancelDialog'
import { JobProgressBar } from './JobProgressBar'
import { JobPhaseStepper } from './JobPhaseStepper'
import { JobLogPanel } from './JobLogPanel'
import { isJobTerminal, jobBytes, jobDuration } from './job-display'

export interface JobProgressViewProps {
  job: JobSummaryV1
  progress?: JobProgressV1 | null
  log?: JobLogLineV1[]
  logDropped?: number
  onBackground?: () => void
  onCancel?: () => void
  onRetry?: () => void
  onDone?: () => void
  recordHref?: string
  autoBackground?: boolean
  busy?: boolean
}

/** Text status chip uses words as well as color.
 * @param props - Server status.
 * @returns Status chip.
 */
export function JobStatusChip({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${['FAILED', 'COMPLETED_WITH_ERRORS', 'NEEDS_REVIEW'].includes(status) ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}
      data-qqq-id="job-status"
    >
      {status.toLowerCase().replace(/_/g, ' ')}
    </span>
  )
}

/** Renders progress and actions; it does not fetch or infer permission.
 * @param props - Server snapshot and permitted action callbacks.
 * @returns Live job view.
 */
export function JobProgressView({
  job,
  progress,
  log = [],
  logDropped = 0,
  onBackground,
  onCancel,
  onRetry,
  onDone,
  recordHref,
  autoBackground = false,
  busy = false,
}: JobProgressViewProps) {
  const [now, setNow] = useState(Date.now)
  const [stay, setStay] = useState(false)
  const [remaining, setRemaining] = useState(5)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const started = useRef(Date.now())
  const background = useRef(onBackground)
  const backgroundSent = useRef(false)
  useEffect(() => {
    background.current = onBackground
  }, [onBackground])
  const terminal = isJobTerminal(job.status)
  const canBackground = !!onBackground
  useEffect(() => {
    if (terminal) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [terminal])
  useEffect(() => {
    if (!autoBackground || stay || terminal || !canBackground) return
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [autoBackground, stay, terminal, canBackground])
  useEffect(() => {
    if (remaining === 0 && !stay && !terminal && !backgroundSent.current) {
      backgroundSent.current = true
      background.current?.()
    }
  }, [remaining, stay, terminal])
  const snapshot = progress ?? job
  const start = job.startedAt ?? job.queuedAt
  const elapsed =
    ((job.finishedAt ? Date.parse(job.finishedAt) : now) -
      (start ? Date.parse(start) : started.current)) /
    1000
  const button =
    'min-h-11 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
  return (
    <section className="min-w-0 space-y-6 p-4 sm:p-6" data-qqq-id="job-progress-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 break-words text-lg font-semibold">{job.label ?? 'Job progress'}</h2>
        <JobStatusChip status={job.status} />
      </div>
      {!!progress?.phases?.length && <JobPhaseStepper phases={progress.phases} />}
      <div className="space-y-3">
        <JobProgressBar percent={snapshot.percent} />
        <div
          aria-live="polite"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
          data-qqq-id="job-progress-stats"
        >
          <span className="font-medium text-foreground">
            {snapshot.percent == null ? 'In progress' : `${Math.round(snapshot.percent)}%`}
          </span>
          {progress?.done != null && (
            <span>
              {progress.done.toLocaleString()} / {progress.total?.toLocaleString() ?? '—'}{' '}
              {progress.unitLabel ?? 'rows'}
            </span>
          )}
          {snapshot.bytesDone != null && (
            <span>
              {jobBytes(snapshot.bytesDone)}
              {snapshot.bytesTotal != null ? ` / ${jobBytes(snapshot.bytesTotal)}` : ''}
            </span>
          )}
          <span>
            {snapshot.etaSeconds != null && !terminal
              ? `ETA ${jobDuration(snapshot.etaSeconds)}`
              : terminal
                ? 'Finished'
                : 'ETA unknown'}
          </span>
          <span>Elapsed {jobDuration(Number.isFinite(elapsed) ? elapsed : 0)}</span>
        </div>
        <p
          aria-live="polite"
          className="break-words text-sm text-foreground"
          data-qqq-id="job-progress-message"
        >
          {snapshot.message ?? (terminal ? 'Job finished.' : 'Waiting for progress…')}
        </p>
      </div>
      <JobLogPanel lines={log} logDropped={logDropped} />
      {autoBackground && !stay && !terminal && onBackground && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-1 text-sm"
          data-qqq-id="job-background-countdown"
        >
          <span aria-live="polite">Moving to Jobs in {remaining}s</span>
          <button
            type="button"
            className={button}
            onClick={() => setStay(true)}
            data-qqq-id="button-job-stay"
          >
            Stay
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {!terminal && onBackground && (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => {
              setStay(true)
              onBackground()
            }}
            data-qqq-id="button-job-background"
          >
            Run in background
          </button>
        )}
        {!terminal && onCancel && (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => {
              setStay(true)
              setConfirmCancel(true)
            }}
            data-qqq-id="button-job-cancel"
          >
            Cancel
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={onRetry}
            data-qqq-id="button-job-retry"
          >
            Retry
          </button>
        )}
        {terminal && recordHref && (
          <a className={button} href={recordHref} data-qqq-id="link-job-record">
            Open job record
          </a>
        )}
        {terminal && onDone && (
          <button type="button" className={button} onClick={onDone} data-qqq-id="button-job-done">
            Done
          </button>
        )}
      </div>
      <ProcessCancelDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        onConfirm={() => onCancel?.()}
      />
    </section>
  )
}
