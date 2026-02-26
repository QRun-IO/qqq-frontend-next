'use client'

// DividerWidget — Simple horizontal divider/separator

import React from 'react'

export interface DividerWidgetPayload {
  type: 'divider'
  label?: string
}

interface DividerWidgetProps {
  data: DividerWidgetPayload
  widgetName: string
}

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
