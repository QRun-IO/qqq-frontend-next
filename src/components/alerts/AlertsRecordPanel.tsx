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
 * @file AlertsRecordPanel — the "Open alerts" panel on a record's view (loaded only when the
 * Alerts qbit is available): each open alert that references the record (severity dot, title,
 * age, status, Acknowledge / Snooze for managers), "N resolved in the last 30 days", and "Watch
 * alerts for this record". Hidden when there is nothing open and nothing resolved in 30 days.
 * One column, no inner scroll, at most five rows plus "View all".
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { getAlertsRecordPanel, watchAlertsRecord } from '@/lib/api/alerts'
import { queryKeys } from '@/lib/query-client'
import { SeverityDot } from './SeverityDot'

/** Props for the panel. */
export interface AlertsRecordPanelProps {
  /** The record's table. */
  tableName: string
  /** The record's primary key. */
  recordId: string
}

/**
 * The record view's "Open alerts" panel.
 *
 * @param props - Component properties.
 * @returns The panel, or null when there is nothing to show.
 */
export default function AlertsRecordPanel({ tableName, recordId }: AlertsRecordPanelProps) {
  const queryClient = useQueryClient()
  const [watchError, setWatchError] = useState<string | null>(null)
  const { data } = useQuery({
    queryKey: queryKeys.alertsRecordPanel(tableName, recordId),
    queryFn: () => getAlertsRecordPanel(tableName, recordId),
    retry: false,
    staleTime: 30_000,
  })
  if (!data || !data.visible) return null

  const actionHref = (processName: string, alertId: number) =>
    `/app/${processName}?recordsParam=recordIds&recordIds=${alertId}&tableName=alerts_alert`

  return (
    <section
      aria-labelledby="alerts-record-panel-title"
      className="mb-4 rounded-xl border border-border bg-card p-4"
      data-qqq-id="alerts-record-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="alerts-record-panel-title" className="text-sm font-semibold text-foreground">
          {data.openCount > 0 ? `Open alerts (${data.openCount})` : 'Alerts'}
        </h2>
        {data.watching ? (
          <span className="text-xs text-muted-foreground" data-qqq-id="alerts-record-watching">You watch this record&apos;s alerts</span>
        ) : (
          <button
            type="button"
            onClick={async () => {
              setWatchError(null)
              try {
                await watchAlertsRecord(tableName, recordId)
                await queryClient.invalidateQueries({ queryKey: queryKeys.alertsRecordPanel(tableName, recordId) })
              } catch {
                setWatchError('Could not subscribe. Try again.')
              }
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-qqq-id="alerts-record-watch"
          >
            Watch alerts for this record
          </button>
        )}
      </div>
      {watchError && <p role="alert" className="mt-2 text-xs text-destructive">{watchError}</p>}

      {data.open.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {data.open.map((alert) => (
            <li key={alert.alertId} className="flex items-start gap-3 py-2 text-sm" data-qqq-id={`alerts-record-alert-${alert.alertId}`}>
              <SeverityDot severity={alert.severity} />
              <span className="min-w-0 flex-1">
                <Link href={alert.href} className="block break-words font-medium text-foreground underline-offset-2 hover:underline">{alert.title}</Link>
                <span className="block text-xs text-muted-foreground">
                  {alert.status.charAt(0) + alert.status.slice(1).toLowerCase()} · {alert.age === 'just now' ? 'just now' : `${alert.age} old`}
                </span>
                {data.canManage && alert.status !== 'RESOLVED' && (
                  <span className="mt-1 flex flex-wrap gap-3 text-xs">
                    {alert.status === 'OPEN' && (
                      <Link href={actionHref('alertsAcknowledge', alert.alertId)} className="text-primary hover:underline">Acknowledge</Link>
                    )}
                    <Link href={actionHref('alertsSnooze', alert.alertId)} className="text-primary hover:underline">Snooze</Link>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {data.resolvedLast30Days > 0 && (
          <span data-qqq-id="alerts-record-resolved">
            {data.resolvedLast30Days === 1 ? '1 resolved' : `${data.resolvedLast30Days} resolved`} in the last 30 days
          </span>
        )}
        {data.viewAllHref && (
          <Link href={data.viewAllHref} className="text-primary hover:underline" data-qqq-id="alerts-record-view-all">View all</Link>
        )}
      </p>
    </section>
  )
}
