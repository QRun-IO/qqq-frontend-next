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
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{data.label}</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>
    )
  }

  return (
    <hr
      className="border-t border-gray-200 dark:border-gray-700"
      data-qqq-id={`divider-${widgetName}`}
    />
  )
}
