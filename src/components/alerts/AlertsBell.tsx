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

/**
 * @file AlertsBell — the header bell for the Alerts qbit. It polls the inbox summary every 60
 * seconds while the tab is visible (TanStack Query pauses interval refetches in a hidden tab)
 * and renders nothing when Alerts is not available to the user. The popover's code loads on
 * first open, so the shell stays small.
 */

'use client'

import React, { Suspense, lazy, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { getAlertsInboxSummary } from '@/lib/api/alerts'
import { queryKeys } from '@/lib/query-client'
import type { AlertsInboxSummary } from '@/types/alerts'

const AlertsBellPopover = lazy(() => import('./AlertsBellPopover'))

/**
 * The bell's inbox summary (null when Alerts is not available). Shared with the record panel
 * slot, which shows its panel only when this probe succeeds.
 *
 * @param enabled - Whether to load it (e.g. only when authenticated).
 * @returns The TanStack Query result.
 */
export function useAlertsInbox(enabled = true) {
  return useQuery<AlertsInboxSummary | null>({
    queryKey: queryKeys.alertsInbox(),
    queryFn: getAlertsInboxSummary,
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data ? (query.state.data.pollSeconds ?? 60) * 1000 : false),
    refetchIntervalInBackground: false,
  })
}

/**
 * The header bell with its unread badge (red when a CRITICAL alert is unread).
 *
 * @returns The bell, or null when Alerts is not available.
 */
export function AlertsBell() {
  const { data } = useAlertsInbox()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  if (!data) return null

  const unread = data.unreadCount
  const label = unread > 0 ? `Alerts, ${unread} unread` : 'Alerts, none unread'
  const critical = data.highestUnreadSeverity === 'CRITICAL'
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex items-center justify-center rounded-lg p-2 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-qqq-id="button-notifications"
      >
        <Bell className="h-5 w-5 text-foreground/60" aria-hidden="true" />
        {unread > 0 && (
          <span
            className={`absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none ${critical ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'}`}
            aria-hidden="true"
            data-qqq-id="alerts-unread-badge"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <span className="sr-only" aria-live="polite" data-qqq-id="alerts-unread-announcer">{label}</span>
      {open && (
        <Suspense fallback={null}>
          <AlertsBellPopover
            summary={data}
            onClose={() => {
              setOpen(false)
              buttonRef.current?.focus({ preventScroll: true })
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
