'use client'

// ConnectedWidget -- Fetches widget data via useWidget and renders WidgetBlock + WidgetRenderer
// This is the primary entrypoint for rendering a single widget on the dashboard

import React, { useState, useMemo, useCallback, useEffect } from 'react'

import type { QWidgetMetaData } from '@/types'
import { fetchPossibleValues } from '@/lib/api/possible-values'
import { useWidget } from '@/lib/hooks/use-widget'
import { WidgetBlock } from './WidgetBlock'
import { WidgetRenderer } from './WidgetRenderer'

interface ConnectedWidgetProps {
  widgetMetaData: QWidgetMetaData
  params?: Record<string, string | number | boolean>
  className?: string
}

export function ConnectedWidget({ widgetMetaData, params, className }: ConnectedWidgetProps) {
  // Initialize dropdown values from metadata defaults
  const [dropdownValues, setDropdownValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    if (widgetMetaData.dropdowns) {
      for (const dropdown of widgetMetaData.dropdowns) {
        if (dropdown.defaultValue !== undefined) {
          defaults[dropdown.name] = dropdown.defaultValue
        }
      }
    }
    return defaults
  })

  // Fetch possible values for dropdowns that have a possibleValueSourceName
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({})

  useEffect(() => {
    if (!widgetMetaData.dropdowns?.length) return

    widgetMetaData.dropdowns.forEach(async (dropdown) => {
      if (!dropdown.possibleValueSourceName) return
      try {
        const response = await fetchPossibleValues(dropdown.possibleValueSourceName)
        setDropdownOptions((prev) => ({
          ...prev,
          [dropdown.name]: response.map((pv) => ({ label: pv.label, value: String(pv.id) })),
        }))
      } catch {
        // Silently fail — dropdown will just have no options
      }
    })
  }, [widgetMetaData.dropdowns])

  // Merge dropdown values into widget params
  const mergedParams = useMemo(() => {
    const base: Record<string, string | number | boolean> = { ...params }
    for (const [key, value] of Object.entries(dropdownValues)) {
      base[key] = value
    }
    return base
  }, [params, dropdownValues])

  const { data, isLoading, isError, error, refetch } = useWidget(widgetMetaData.name, mergedParams)

  const handleDropdownChange = useCallback((name: string, value: string) => {
    setDropdownValues((prev) => ({ ...prev, [name]: value }))
  }, [])

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
      dropdowns={widgetMetaData.dropdowns}
      dropdownOptions={dropdownOptions}
      dropdownValues={dropdownValues}
      onDropdownChange={handleDropdownChange}
      className={className}
    >
      {data && (
        <WidgetRenderer widgetMetaData={widgetMetaData} data={data} />
      )}
    </WidgetBlock>
  )
}
