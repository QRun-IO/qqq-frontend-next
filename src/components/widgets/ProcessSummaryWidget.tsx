'use client'

// ProcessSummaryWidget — Shows recent process run summaries with status badges

import React from 'react'
import { CheckCircle, XCircle, Clock, Loader } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export type ProcessRunStatus = 'success' | 'error' | 'running' | 'pending'

export interface ProcessRun {
  id: string | number
  processLabel: string
  status: ProcessRunStatus
  startedAt?: string
  completedAt?: string
  message?: string
  recordCount?: number
}

export interface ProcessSummaryWidgetPayload {
  type: 'processSummary'
  runs: ProcessRun[]
}

interface ProcessSummaryWidgetProps {
  data: ProcessSummaryWidgetPayload
  widgetName: string
}

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
