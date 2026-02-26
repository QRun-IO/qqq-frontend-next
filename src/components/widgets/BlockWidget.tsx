'use client'

// BlockWidget — Renders arbitrary HTML content from the backend
// Uses dangerouslySetInnerHTML with the html payload

import React from 'react'

export interface BlockWidgetPayload {
  type: 'html'
  html: string
}

interface BlockWidgetProps {
  data: BlockWidgetPayload
  widgetName: string
}

export function BlockWidget({ data, widgetName }: BlockWidgetProps) {
  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: data.html }}
      data-qqq-id={`block-widget-${widgetName}`}
    />
  )
}
