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
 * @file ConnectedWidget — Primary entrypoint for rendering a single dashboard widget.
 *
 * Orchestrates widget data fetching (via useWidget), dropdown option loading
 * (via fetchPossibleValues), and state management for dropdown selections.
 * Delegates layout to WidgetBlock and type-based rendering to WidgetRenderer.
 * Returns null for widgets that lack permission.
 */
'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'

import type { QWidgetMetaData } from '@/types'
import { fetchPossibleValues } from '@/lib/api/possible-values'
import { useWidget } from '@/lib/hooks/use-widget'
import { WidgetBlock } from './WidgetBlock'
import { WidgetRenderer } from './WidgetRenderer'

/** Props accepted by the ConnectedWidget component. */
interface ConnectedWidgetProps {
  /** Full widget metadata from the server, including type, dropdowns, and permission flag. */
  widgetMetaData: QWidgetMetaData
  /** Optional static query parameters merged into the widget data-fetch request. */
  params?: Record<string, string | number | boolean>
  /** Optional Tailwind class string forwarded to the WidgetBlock container. */
  className?: string
}

/**
 * Renders a fully connected dashboard widget with data fetching and dropdown support.
 *
 * The primary entrypoint for any single widget on a dashboard page.  Used directly
 * by dashboard page components and by `CompositeWidget` for each child.
 * Initializes dropdown selections from `widgetMetaData.dropdowns[].defaultValue`,
 * asynchronously loads possible-value options for dropdowns that declare a
 * `possibleValueSourceName`, merges current dropdown selections into the data-fetch
 * params via `useMemo`, and delegates to `WidgetBlock` (for title/loading/error
 * chrome) and `WidgetRenderer` (for type-specific output).
 *
 * @param props - Component properties; `widgetMetaData.hasPermission === false`
 *   causes an early `return null` before any rendering; `params` are static query
 *   parameters merged with dropdown selections for the `useWidget` call.
 * @returns The rendered `WidgetBlock` + `WidgetRenderer` tree, or null when
 *   `widgetMetaData.hasPermission` is false.
 */
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

  /**
   * Updates the stored dropdown selection for a single named dropdown.
   *
   * @param name - The dropdown's metadata name property.
   * @param value - The newly selected option value string.
   */
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
