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
 * @file AlertsBell — the header bell of the notification center (qbit-alerts). Like the QQQ
 * Assistant, it is gated on instance metadata: unless the metadata lists the qbit's `alerts`
 * app (which QQQ includes only when qbit-alerts is installed and the user holds `alerts.view`,
 * the same permission its `/alerts/*` routes require), it renders nothing and sends no request
 * at all. When enabled it polls the inbox summary every `pollSeconds` (60) while the tab is
 * visible (TanStack Query pauses interval refetches in a hidden tab and refetches when it shows
 * again), backing off exponentially to 5 minutes after errors. The popover's code loads on
 * first open, so the shell stays small.
 */

'use client'

import React, { Suspense, lazy, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { getAlertsInboxSummary } from '@/lib/api/alerts'
import { queryKeys } from '@/lib/query-client'
import type { AlertsInboxSummary } from '@/types/alerts'
import type { QInstance } from '@/types/metadata'

const AlertsBellPopover = lazy(() => import('./AlertsBellPopover'))

/** The app qbit-alerts publishes (`AlertsQBitConfig.APP_NAME`), gated on `alerts.view`. */
export const ALERTS_APP_NAME = 'alerts'

/**
 * Whether the instance metadata announces qbit-alerts to this user: its `alerts` app is
 * present. QQQ leaves an app out of the metadata when the qbit is not installed or the user
 * lacks its permission (`alerts.view`, which the `/alerts/*` routes also require), so this is
 * the precondition for any Alerts request.
 *
 * @param metaData - Instance metadata.
 * @returns True when the Alerts app is present.
 */
export function isAlertsInstalled(metaData: QInstance | undefined): boolean {
  const app = metaData?.apps?.[ALERTS_APP_NAME]
  return Boolean(app) && typeof app === 'object'
}

/** The longest wait between polls after errors (5 minutes). */
export const MAX_POLL_MS = 300_000

/** Consecutive failed summary loads (one shared query, so one counter). */
let failures = 0

/**
 * The summary loader, counting consecutive failures for the backoff.
 *
 * @returns The summary.
 */
async function loadSummary(): Promise<AlertsInboxSummary | null> {
  try {
    const summary = await getAlertsInboxSummary()
    failures = 0
    return summary
  } catch (error) {
    failures++
    throw error
  }
}

/**
 * The wait before the next poll: `pollSeconds` normally, doubling per consecutive failure up to
 * {@link MAX_POLL_MS}; no polling once the backend has said Alerts is not for this user.
 *
 * @param data - The last summary (null: not available; undefined: none yet).
 * @param failed - Consecutive failures.
 * @returns Milliseconds, or false.
 */
export function pollDelay(data: AlertsInboxSummary | null | undefined, failed: number): number | false {
  if (data === null && failed === 0) return false
  const base = (data?.pollSeconds ?? 60) * 1000
  return failed > 0 ? Math.min(base * 2 ** failed, MAX_POLL_MS) : base
}

/**
 * The bell's inbox summary (null when the backend still answers that Alerts is unavailable).
 * Shared with the record panel slot and the banner slot. It never fetches (nor polls) unless
 * `enabled`.
 *
 * @param enabled - Whether to load it: authenticated and {@link isAlertsInstalled}.
 * @returns The TanStack Query result.
 */
export function useAlertsInbox(enabled: boolean) {
  return useQuery<AlertsInboxSummary | null>({
    queryKey: queryKeys.alertsInbox(),
    queryFn: loadSummary,
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchInterval: (query) => pollDelay(query.state.data, failures),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (query) => (query.state.data === null ? false : 'always'),
  })
}

/**
 * The header bell with its unread badge (red when a CRITICAL alert is unread).
 *
 * @param props - `metaData`: instance metadata, which must announce Alerts ({@link isAlertsInstalled}).
 * @returns The bell, or null when Alerts is not available.
 */
export function AlertsBell({ metaData }: { metaData: QInstance | undefined }) {
  const { data } = useAlertsInbox(isAlertsInstalled(metaData))
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  if (!data) return null

  const unread = data.unreadCount
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications, none unread'
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
            {unread > 99 ? '99+' : unread}
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
