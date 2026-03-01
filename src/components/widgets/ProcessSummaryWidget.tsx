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
 * @file ProcessSummaryWidget — Displays a chronological list of recent process-run summaries with status badges.
 */
'use client'

import React from 'react'
import { CheckCircle, XCircle, Clock, Loader } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/** Lifecycle status of a single process run. */
export type ProcessRunStatus = 'success' | 'error' | 'running' | 'pending'

/** Represents a single process run entry displayed in the summary widget. */
export interface ProcessRun {
  /** Unique identifier for this process run. */
  id: string | number
  /** Human-readable label of the process that was executed. */
  processLabel: string
  /** Current lifecycle status of the run. */
  status: ProcessRunStatus
  /** ISO 8601 timestamp of when the run was initiated. */
  startedAt?: string
  /** ISO 8601 timestamp of when the run finished. */
  completedAt?: string
  /** Optional status message or error description. */
  message?: string
  /** Number of records processed during the run. */
  recordCount?: number
}

/** Wire-format payload for a process-summary widget returned by the backend API. */
export interface ProcessSummaryWidgetPayload {
  /** Discriminator field identifying this as a process-summary widget payload. */
  type: 'processSummary'
  /** Ordered list of recent process run summaries to display. */
  runs: ProcessRun[]
}

/** Props accepted by the ProcessSummaryWidget component. */
interface ProcessSummaryWidgetProps {
  /** Typed payload from the widget API response. */
  data: ProcessSummaryWidgetPayload
  /** Unique widget name used to scope data-qqq-id attributes. */
  widgetName: string
}

/**
 * Static lookup table mapping each ProcessRunStatus to its visual configuration.
 *
 * Each entry provides a Lucide icon component and Tailwind class strings for
 * the status badge and icon.
 */
const STATUS_CONFIG: Record<
  ProcessRunStatus,
  { icon: React.ElementType; label: string; badgeClass: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle,
    label: 'Success',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    iconClass: 'text-emerald-500',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    badgeClass: 'bg-red-100 text-red-700',
    iconClass: 'text-destructive',
  },
  running: {
    icon: Loader,
    label: 'Running',
    badgeClass: 'bg-blue-100 text-blue-700',
    iconClass: 'text-primary animate-spin',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    badgeClass: 'bg-muted text-muted-foreground',
    iconClass: 'text-muted-foreground',
  },
}

/**
 * Converts an ISO 8601 timestamp into a human-readable relative time string.
 *
 * Returns 'just now' for differences under 1 minute, '5m ago' or '3h ago'
 * for intra-day differences, and a locale date string for older timestamps.
 * Falls back to returning the original string when parsing fails.
 *
 * @param isoString - ISO 8601 date-time string to format.
 * @returns Relative time label suitable for display in the UI.
 */
function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60_000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  } catch {
    return isoString
  }
}

/**
 * Renders a divided list of recent process runs with status icons, badges, and timestamps.
 *
 * Each run row shows the process label, a colored status badge, an optional
 * message, the record count, and a relative completion or start time.
 * Shows an empty-state message when the runs array is empty.
 *
 * @param props - Component properties.
 * @returns The rendered process summary list.
 */
export function ProcessSummaryWidget({ data, widgetName }: ProcessSummaryWidgetProps) {
  const { runs } = data

  if (!runs || runs.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-qqq-id={`process-summary-empty-${widgetName}`}
      >
        No recent process runs
      </p>
    )
  }

  return (
    <ul
      className="divide-y divide-border"
      data-qqq-id={`process-summary-${widgetName}`}
      aria-label="Recent process runs"
    >
      {runs.map((run, idx) => {
        const config = STATUS_CONFIG[run.status]
        const Icon = config.icon
        return (
          <li
            key={run.id}
            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
            data-qqq-id={`process-run-${widgetName}-${idx}`}
          >
            <Icon
              className={cn('mt-0.5 h-4 w-4 shrink-0', config.iconClass)}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground truncate">
                  {run.processLabel}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    config.badgeClass
                  )}
                  aria-label={`Status: ${config.label}`}
                >
                  {config.label}
                </span>
              </div>
              {run.message && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {run.message}
                </p>
              )}
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {run.recordCount !== undefined && (
                  <span>{run.recordCount.toLocaleString()} records</span>
                )}
                {run.completedAt && (
                  <span>{formatRelativeTime(run.completedAt)}</span>
                )}
                {!run.completedAt && run.startedAt && (
                  <span>Started {formatRelativeTime(run.startedAt)}</span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
