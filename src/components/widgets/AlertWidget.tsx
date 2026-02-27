/** AlertWidget — Displays an alert/banner message with severity-based color and icon styling. */
'use client'

import React from 'react'
import { Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/** Severity level that controls color theme and icon for an alert widget. */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'success'

/** Wire-format payload returned by the backend for an alert-type widget. */
export interface AlertWidgetPayload {
  /** Discriminator field identifying this as an alert widget payload. */
  type: 'alert'
  /** Severity level controlling color and icon; defaults to 'info'. */
  severity?: AlertSeverity
  /** Optional bold title rendered above the message body. */
  title?: string
  /** Primary alert message text. */
  message: string
}

/** Props accepted by the AlertWidget component. */
interface AlertWidgetProps {
  /** Typed payload from the widget API response. */
  data: AlertWidgetPayload
  /** Unique widget name used to scope data-qqq-id attributes. */
  widgetName: string
}

/**
 * Static lookup table that maps each AlertSeverity to its visual configuration.
 *
 * Each entry provides a Lucide icon component and Tailwind class strings for
 * the container, icon, title, and body text.
 */
const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { icon: React.ElementType; containerClass: string; iconClass: string; titleClass: string; textClass: string }
> = {
  info: {
    icon: Info,
    containerClass: 'border-blue-200 bg-blue-50',
    iconClass: 'text-blue-500',
    titleClass: 'text-blue-800',
    textClass: 'text-blue-700',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'border-amber-200 bg-amber-50',
    iconClass: 'text-amber-500',
    titleClass: 'text-amber-800',
    textClass: 'text-amber-700',
  },
  error: {
    icon: XCircle,
    containerClass: 'border-red-200 bg-red-50',
    iconClass: 'text-destructive',
    titleClass: 'text-red-800',
    textClass: 'text-red-700',
  },
  success: {
    icon: CheckCircle,
    containerClass: 'border-emerald-200 bg-emerald-50',
    iconClass: 'text-emerald-500',
    titleClass: 'text-emerald-800',
    textClass: 'text-emerald-700',
  },
}

/**
 * Renders a styled alert banner with an icon, optional title, and message body.
 *
 * Severity controls the color scheme: info (blue), warning (amber), error (red),
 * success (emerald). The component emits a `role="alert"` element for
 * screen-reader accessibility.
 *
 * @param data - Alert widget payload from the backend API.
 * @param widgetName - Widget name scoped to data-qqq-id attributes.
 */
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
