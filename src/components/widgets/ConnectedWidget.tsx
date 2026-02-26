'use client'

// ConnectedWidget — Fetches widget data via useWidget and renders WidgetBlock + WidgetRenderer
// This is the primary entrypoint for rendering a single widget on the dashboard

import React from 'react'

import type { QWidgetMetaData } from '@/types'
import { useWidget } from '@/lib/hooks/use-widget'
import { WidgetBlock } from './WidgetBlock'
import { WidgetRenderer } from './WidgetRenderer'

interface ConnectedWidgetProps {
  widgetMetaData: QWidgetMetaData
  params?: Record<string, string | number | boolean>
  className?: string
}

export function ConnectedWidget({ widgetMetaData, params, className }: ConnectedWidgetProps) {
  const { data, isLoading, isError, error, refetch } = useWidget(widgetMetaData.name, params)

  // Widgets with no permission should not render
  if (!widgetMetaData.hasPermission) {
    return null
  }

  return (
    <WidgetBlock
      widgetMetaData={widgetMetaData}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onReload={refetch}
      className={className}
    >
      {data && (
        <WidgetRenderer widgetMetaData={widgetMetaData} data={data} />
      )}
    </WidgetBlock>
  )
}
