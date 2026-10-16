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

/** @file Capability-gated Jobs header button, always shown where jobs are available; the popover loads only when opened. */
'use client'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BriefcaseBusiness } from 'lucide-react'
import { HEADER_BUTTON_CLASS } from '@/components/layout/HeaderMenu'
import { useJobsInstalled, useMyJobs } from '@/lib/hooks/use-my-jobs'
import './jobs.css'

const JobsPopover = lazy(() => import('./JobsPopover'))

/**
 * The header's Jobs button. Always visible while jobs are available to the user (owner decision
 * 2026-10-15): idle with no badge when nothing runs, a ring and a count badge while jobs of
 * theirs are active. Hidden only when jobs are not installed or the endpoint refuses the user.
 * The count is announced when it changes, never on page load.
 *
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
  const count = active.data?.activeCount ?? 0
  const label = count > 0 ? `Jobs, ${count} active` : 'Jobs, none active'

  // announce changes only: the first known count is not news
  const previous = useRef<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => {
    if (!active.data) return
    if (previous.current !== null && previous.current !== count) setAnnouncement(label)
    previous.current = count
  }, [active.data, count, label])

  // not installed, or refused for this user (the query resolves to null)
  if (!installed || active.data === null) return null
  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={label}
        title="Jobs"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={HEADER_BUTTON_CLASS}
        data-qqq-id="button-jobs"
        data-qqq-state={count > 0 ? 'active' : 'idle'}
      >
        {count > 0 && (
          <span
            aria-hidden="true"
            className="qqq-job-ring absolute inset-1 rounded-full border border-primary"
          />
        )}
        <BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            data-qqq-id="jobs-active-badge"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      <span aria-live="polite" className="sr-only" data-qqq-id="jobs-announcer">
        {announcement}
      </span>
      {open && (
        <Suspense fallback={<p role="status">Loading jobs…</p>}>
          <JobsPopover jobs={active.data?.jobs ?? []} recent={recent.data?.jobs ?? []} onClose={close} />
        </Suspense>
      )}
    </div>
  )
}
