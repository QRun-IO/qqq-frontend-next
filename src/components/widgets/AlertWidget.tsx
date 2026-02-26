'use client'

// AlertWidget — Displays an alert/banner message with severity styling

import React from 'react'
import { Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export type AlertSeverity = 'info' | 'warning' | 'error' | 'success'

export interface AlertWidgetPayload {
  type: 'alert'
  severity?: AlertSeverity
  title?: string
  message: string
}

interface AlertWidgetProps {
  data: AlertWidgetPayload
  widgetName: string
}

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { icon: React.ElementType; containerClass: string; iconClass: string; titleClass: string; textClass: string }
> = {
  info: {
    icon: Info,
    containerClass: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
    iconClass: 'text-blue-500',
    titleClass: 'text-blue-800 dark:text-blue-300',
    textClass: 'text-blue-700 dark:text-blue-400',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    iconClass: 'text-amber-500',
    titleClass: 'text-amber-800 dark:text-amber-300',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  error: {
    icon: XCircle,
    containerClass: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
    iconClass: 'text-red-500',
    titleClass: 'text-red-800 dark:text-red-300',
    textClass: 'text-red-700 dark:text-red-400',
  },
  success: {
    icon: CheckCircle,
    containerClass: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
    iconClass: 'text-emerald-500',
    titleClass: 'text-emerald-800 dark:text-emerald-300',
    textClass: 'text-emerald-700 dark:text-emerald-400',
  },
}

export function AlertWidget({ data, widgetName }: AlertWidgetProps) {
  const severity: AlertSeverity = data.severity ?? 'info'
  const config = SEVERITY_CONFIG[severity]
  const Icon = config.icon

  return (
    <div
      className={cn('flex items-start gap-3 rounded-lg border p-4', config.containerClass)}
      role="alert"
      data-qqq-id={`alert-widget-${widgetName}`}
    >
      <Icon
        className={cn('mt-0.5 h-5 w-5 shrink-0', config.iconClass)}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        {data.title && (
          <p className={cn('mb-1 text-sm font-semibold', config.titleClass)}>
            {data.title}
          </p>
        )}
        <p className={cn('text-sm', config.textClass)}>{data.message}</p>
      </div>
    </div>
  )
}
