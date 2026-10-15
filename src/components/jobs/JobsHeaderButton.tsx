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

/** @file Capability-gated Jobs header button; the popover loads only when opened. */
'use client'
import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { BriefcaseBusiness } from 'lucide-react'
import { useJobsInstalled, useMyJobs } from '@/lib/hooks/use-my-jobs'
import './jobs.css'

const JobsPopover = lazy(() => import('./JobsPopover'))

/** Shows the current user's active count, hiding on unavailable or refused jobs endpoints.
 * @returns Header trigger and optional tray.
 */
export function JobsHeaderButton() {
  const installed = useJobsInstalled()
  const active = useMyJobs(installed, { scope: 'mine', state: 'active', limit: 20 })
  const [open, setOpen] = useState(false)
  const recent = useMyJobs(installed && open, { scope: 'mine', state: 'recent', limit: 5 })
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }, [])
  if (!installed || !active.data || active.isError) return null
  const count = active.data.activeCount
  const label = `Jobs, ${count} active`
  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        data-qqq-id="button-jobs"
      >
        {count > 0 && (
          <span
            aria-hidden="true"
            className="qqq-job-ring absolute inset-1 rounded-full border border-primary"
          />
        )}
        <BriefcaseBusiness aria-hidden="true" className="h-5 w-5 text-foreground/60" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0 top-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground"
            data-qqq-id="jobs-active-badge"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {label}
      </span>
      {open && (
        <Suspense fallback={<p role="status">Loading jobs…</p>}>
          <JobsPopover jobs={active.data.jobs} recent={recent.data?.jobs ?? []} onClose={close} />
        </Suspense>
      )}
    </div>
  )
}
