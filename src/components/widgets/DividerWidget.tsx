/** DividerWidget — Renders a simple horizontal rule separator, optionally with a centered text label. */
'use client'

import React from 'react'

/** Wire-format payload for a divider widget returned by the backend API. */
export interface DividerWidgetPayload {
  /** Discriminator field identifying this as a divider widget. */
  type: 'divider'
  /** Optional text label centered within the divider line. */
  label?: string
}

/** Props accepted by the DividerWidget component. */
interface DividerWidgetProps {
  /** Typed payload from the widget API response. */
  data: DividerWidgetPayload
  /** Unique widget name used to scope data-qqq-id attributes. */
  widgetName: string
}

/**
 * Renders a horizontal rule separator.
 *
 * When `data.label` is provided the divider displays the label centered between
 * two rule lines. Without a label a plain `<hr>` element is rendered.
 *
 * @param data - Divider widget payload from the backend API.
 * @param widgetName - Widget name scoped to data-qqq-id attributes.
 */
export function DividerWidget({ data, widgetName }: DividerWidgetProps) {
  if (data.label) {
    return (
      <div
        className="flex items-center gap-3"
        data-qqq-id={`divider-${widgetName}`}
        role="separator"
        aria-label={data.label}
      >
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">{data.label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    )
  }

  return (
    <hr
      className="border-t border-border"
      data-qqq-id={`divider-${widgetName}`}
    />
  )
}
