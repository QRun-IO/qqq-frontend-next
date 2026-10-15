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

/** @file Full-width Jobs page; all-user scope is visible only after the server authorizes it. */
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listJobs } from '@/lib/api/jobs'
import { useJobsInstalled, useMyJobs } from '@/lib/hooks/use-my-jobs'
import { jobAccessDenied } from '@/lib/hooks/use-job-progress'
import { queryKeys } from '@/lib/query-client'
import { JobList } from './JobList'

/** Jobs list with Active / Recent / server-authorized All filters.
 * @returns Jobs page.
 */
export function JobsPage() {
  const installed = useJobsInstalled()
  const [tab, setTab] = useState<'active' | 'recent' | 'all'>('active')
  const adminFilter = { scope: 'all', state: 'all', limit: 1 } as const
  const admin = useQuery({
    queryKey: queryKeys.jobList(adminFilter),
    queryFn: async () => {
      try {
        const data = await listJobs(adminFilter)
        return Array.isArray(data?.jobs) ? data : null
      } catch (error) {
        if (jobAccessDenied(error)) return null
        throw error
      }
    },
    enabled: installed,
    retry: false,
    staleTime: Infinity,
  })
  const canSeeAll = !!admin.data
  const selected = tab === 'all' && !canSeeAll ? 'active' : tab
  const jobs = useMyJobs(installed, {
    scope: selected === 'all' ? 'all' : 'mine',
    state: selected,
    limit: 200,
  })
  const tabs = canSeeAll ? (['active', 'recent', 'all'] as const) : (['active', 'recent'] as const)
  return (
    <section className="w-full min-w-0 space-y-5" data-qqq-id="jobs-page">
      <div>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow running work and revisit recent results.
        </p>
      </div>
      {!installed ? (
        <p role="status">Jobs are not available on this server.</p>
      ) : (
        <>
          <div role="tablist" aria-label="Job state" className="flex flex-wrap gap-2">
            {tabs.map((value, index) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`jobs-tab-${value}`}
                aria-controls="jobs-tabpanel"
                aria-selected={selected === value}
                tabIndex={selected === value ? 0 : -1}
                onClick={() => setTab(value)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % tabs.length
                      : event.key === 'ArrowLeft'
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : -1
                  if (next >= 0) {
                    event.preventDefault()
                    setTab(tabs[next])
                    document.getElementById(`jobs-tab-${tabs[next]}`)?.focus()
                  }
                }}
                data-qqq-id={`tab-jobs-${value}`}
                className={`min-h-11 rounded-md px-4 text-sm capitalize focus-visible:ring-2 focus-visible:ring-ring ${selected === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent'}`}
              >
                {value}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="jobs-tabpanel"
            aria-labelledby={`jobs-tab-${selected}`}
            className="min-w-0 rounded-xl border border-border bg-card"
          >
            {jobs.isPending ? (
              <p role="status" className="p-6">
                Loading jobs…
              </p>
            ) : jobs.isError || !jobs.data ? (
              <p role="alert" className="p-6">
                Could not load jobs. They may be unavailable or you may not have access.
              </p>
            ) : (
              <JobList
                jobs={jobs.data.jobs}
                label={selected === 'active' ? 'Active' : selected === 'recent' ? 'Recent' : 'All'}
              />
            )}
          </div>
          {jobs.data && jobs.data.jobs.length === 200 && (
            <p className="text-sm text-muted-foreground">Showing the latest 200 jobs.</p>
          )}
        </>
      )}
    </section>
  )
}
