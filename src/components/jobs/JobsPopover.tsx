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

/** @file Lazy header jobs dialog with focus trapping and focus restoration by its trigger. */
'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { JobSummaryV1 } from '@/types/jobs'
import { JobList } from './JobList'
import { isJobTerminal } from './job-display'

/** Header tray with active jobs first and recent outcomes second.
 * @param props - Current lists and close callback.
 * @returns Accessible popover.
 */
export default function JobsPopover({
  jobs,
  recent,
  onClose,
}: {
  jobs: JobSummaryV1[]
  recent: JobSummaryV1[]
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('button,a')?.focus({ preventScroll: true })
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const nodes = panel.current?.querySelectorAll<HTMLElement>('button,a')
      if (!nodes?.length) return
      const first = nodes[0],
        last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const pointer = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest?.('[data-qqq-id="button-jobs"]')
      )
        onClose()
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('pointerdown', pointer)
    return () => {
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('pointerdown', pointer)
    }
  }, [onClose])
  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Jobs"
      className="fixed left-2 right-2 top-[calc(var(--qqq-header-height)+0.25rem)] z-50 max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg sm:absolute sm:left-auto sm:top-full sm:mt-2 sm:w-96"
      data-qqq-id="jobs-popover"
    >
      <div className="flex items-center justify-between border-b border-border px-4">
        <h2 className="font-semibold">Jobs</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded px-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          data-qqq-id="button-jobs-close"
        >
          Close
        </button>
      </div>
      <h3 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Running
      </h3>
      <JobList
        jobs={jobs.filter((job) => !isJobTerminal(job.status))}
        label="Active"
        onOpen={onClose}
      />
      <h3 className="border-t border-border px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recently finished
      </h3>
      <JobList jobs={recent} label="Recent" onOpen={onClose} />
      <Link
        href="/app/jobs"
        onClick={onClose}
        data-qqq-id="link-all-jobs"
        className="block min-h-11 border-t border-border p-4 text-sm font-medium text-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        All jobs
      </Link>
    </div>
  )
}
