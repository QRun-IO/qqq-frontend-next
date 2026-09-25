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
 * Fetches the widget's data (via useWidget) with the widget's request parameters:
 * record context, the parent widget's selections (for children), persisted
 * dropdown selections, and the current dropdown choices. Dropdown options come
 * from the payload (`dropdownNameList` / `dropdownLabelList` / `dropdownDataList`
 * / `dropdownDefaultValueList`), exactly as the backend's renderer declared them.
 * Delegates chrome to WidgetBlock and type-based rendering to WidgetRenderer.
 * Returns null for widgets that lack permission.
 */
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import type { QWidgetMetaData, WidgetData } from '@/types'
import { useWidget } from '@/lib/hooks/use-widget'
import type { BlockActionCallback, WidgetRecordContext } from './widget-types'
import { WidgetBlock } from './WidgetBlock'
import type { WidgetChromeData, WidgetDropdownControl } from './WidgetBlock'
import { WidgetRenderer } from './WidgetRenderer'
import {
  downloadText, dropdownStorageKey, plainText, storedDropdownParams, widgetCsvToString, widgetExportFileName,
  writeStoredSelection,
} from './widget-utils'

/** Props accepted by the ConnectedWidget component. */
interface ConnectedWidgetProps {
  /** Full widget metadata from the server, including type, dropdowns, and permission flag. */
  widgetMetaData: QWidgetMetaData
  /** Static request parameters (record context `id`/`tableName`, a parent's selections). */
  params?: Record<string, string | number | boolean>
  /** Optional Tailwind class string forwarded to the WidgetBlock container. */
  className?: string
  /** Record context when rendered inside a record view section. */
  recordContext?: WidgetRecordContext
  /** Interactive block callback (process steps hosting composite widgets). */
  actionCallback?: BlockActionCallback
  /** All widget metadata, for parent widgets resolving their children. */
  widgetRegistry?: Record<string, QWidgetMetaData>
  /** The parent widget, for children whose selections the parent stores. */
  parentMetaData?: QWidgetMetaData
  /** Renders only the body (tab panels of a parent widget). */
  bare?: boolean
}

/** Dropdown fields every payload may carry. */
interface DropdownPayload {
  dropdownNameList?: unknown
  dropdownLabelList?: unknown
  dropdownDataList?: unknown
  dropdownDefaultValueList?: unknown
  csvData?: unknown
  columns?: unknown
  rows?: unknown
}

/**
 * Resolves the dropdown controls declared by a payload, pairing each with its
 * metadata entry (by position, as the backend emits them) for type and labels.
 *
 * @param data - Widget payload.
 * @param widgetMetaData - Widget metadata.
 * @param selections - Current selections keyed by parameter name.
 * @returns The controls, or an empty list.
 */
function resolveDropdowns(data: DropdownPayload | undefined, widgetMetaData: QWidgetMetaData, selections: Record<string, string | null>): WidgetDropdownControl[] {
  const names = Array.isArray(data?.dropdownNameList) ? data.dropdownNameList : []
  const labels = Array.isArray(data?.dropdownLabelList) ? data.dropdownLabelList : []
  const lists = Array.isArray(data?.dropdownDataList) ? data.dropdownDataList : []
  return names.flatMap((name, index) => {
    if (typeof name !== 'string') return []
    const meta = widgetMetaData.dropdowns?.[index]
    const rawOptions: unknown[] = Array.isArray(lists[index]) ? lists[index] : []
    const options = rawOptions.flatMap((option) => {
      if (!option || typeof option !== 'object') return []
      const { id, label } = option as { id?: unknown; label?: unknown }
      return id === undefined || id === null ? [] : [{ id: String(id), label: String(label ?? id) }]
    })
    return [{
      paramName: name,
      label: typeof labels[index] === 'string' ? labels[index] : (meta?.label ?? name),
      type: meta?.type === 'DATE_PICKER' ? 'DATE_PICKER' as const : 'POSSIBLE_VALUE_SOURCE' as const,
      options,
      value: selections[name] ?? null,
      labelForNullValue: meta?.labelForNullValue,
    }]
  })
}

/**
 * CSV rows for export: the payload's `csvData`, else a table payload's columns and rows.
 *
 * @param data - Widget payload.
 * @returns Rows of cells, or null when there is nothing to export.
 */
function exportRows(data: DropdownPayload | undefined): unknown[][] | null {
  if (Array.isArray(data?.csvData) && data.csvData.every((row) => Array.isArray(row))) return data.csvData as unknown[][]
  if (Array.isArray(data?.columns) && Array.isArray(data?.rows) && data.rows.length > 0) {
    const columns = data.columns.filter((column): column is { header?: string; accessor?: string } => Boolean(column) && typeof column === 'object')
    return [
      columns.map((column) => column.header ?? column.accessor ?? ''),
      ...data.rows.map((row) => columns.map((column) => plainText((row as Record<string, unknown>)?.[column.accessor ?? '']))),
    ]
  }
  return null
}

/**
 * Renders a fully connected dashboard widget with data fetching and dropdown support.
 *
 * @param props - Component properties; `widgetMetaData.hasPermission === false` renders nothing
 *   and makes no request.
 * @returns The rendered `WidgetBlock` + `WidgetRenderer` tree, or null when not permitted.
 */
export function ConnectedWidget({
  widgetMetaData, params, className, recordContext, actionCallback, widgetRegistry, parentMetaData, bare,
}: ConnectedWidgetProps) {
  const permitted = widgetMetaData.hasPermission !== false

  // Selections: persisted choices first (stores are keyed by the storing widget), then user changes.
  const [selections, setSelections] = useState<Record<string, string | null>>(() => storedDropdownParams(widgetMetaData, parentMetaData))
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const requestParams = useMemo(() => {
    const merged: Record<string, string | number | boolean> = { ...params }
    for (const [key, value] of Object.entries(selections)) {
      if (value !== null && value !== '') merged[key] = value
    }
    return merged
  }, [params, selections])

  const { data, isLoading, isFetching, isError, error, refetch } = useWidget(widgetMetaData.name, requestParams, { enabled: permitted })
  const payload = data as (WidgetData & DropdownPayload) | undefined

  // Apply backend default selections, and drop persisted choices that are no longer offered.
  useEffect(() => {
    if (!payload) return
    const names = Array.isArray(payload.dropdownNameList) ? payload.dropdownNameList : []
    const defaults = Array.isArray(payload.dropdownDefaultValueList) ? payload.dropdownDefaultValueList : []
    const lists = Array.isArray(payload.dropdownDataList) ? payload.dropdownDataList : []
    setSelections((current) => {
      let next = current
      names.forEach((name, index) => {
        if (typeof name !== 'string') return
        const meta = widgetMetaData.dropdowns?.[index]
        if (meta?.type === 'DATE_PICKER') return
        const ids = (Array.isArray(lists[index]) ? lists[index] : []).map((option: { id?: unknown }) => String(option?.id))
        const selected = current[name]
        if (selected && !ids.includes(selected)) {
          next = { ...next, [name]: null }
          if (widgetMetaData.storeDropdownSelections) writeStoredSelection(dropdownStorageKey(widgetMetaData.name, name), null)
        } else if ((selected === undefined) && defaults[index] !== undefined && defaults[index] !== null && ids.includes(String(defaults[index]))) {
          next = { ...next, [name]: String(defaults[index]) }
        }
      })
      return next
    })
  }, [payload, widgetMetaData.dropdowns, widgetMetaData.name, widgetMetaData.storeDropdownSelections])

  const handleDropdownChange = useCallback((paramName: string, selection: { id: string; label: string } | null) => {
    if (widgetMetaData.storeDropdownSelections) {
      writeStoredSelection(dropdownStorageKey(widgetMetaData.name, paramName), selection)
    }
    setSelections((current) => ({ ...current, [paramName]: selection?.id ?? null }))
  }, [widgetMetaData.name, widgetMetaData.storeDropdownSelections])

  const handleExport = useCallback(() => {
    const rows = exportRows(payload)
    if (!rows) {
      setExportMessage('There is no data available to export.')
      return
    }
    setExportMessage(null)
    downloadText(widgetExportFileName(typeof payload?.label === 'string' ? payload.label : widgetMetaData.label), widgetCsvToString(rows))
  }, [payload, widgetMetaData.label])

  const handleReload = useCallback(() => { void refetch() }, [refetch])

  if (!permitted) {
    return null
  }

  // Alerts that ask to be hidden, or have no message, render nothing at all (as in Material).
  if (payload?.type === 'alert' && ((payload as { hideWidget?: unknown }).hideWidget === true
    || !((payload as { html?: unknown }).html || (payload as { message?: unknown }).message))) {
    return null
  }

  // A divider is only a rule: no card, label or controls.
  if ((widgetMetaData.type ?? payload?.type) === 'divider' && payload) {
    return (
      <div className={className} data-qqq-id={`widget-${widgetMetaData.name}`} data-widget-type="divider">
        <WidgetRenderer widgetMetaData={widgetMetaData} data={payload} />
      </div>
    )
  }

  const dropdowns = resolveDropdowns(payload, widgetMetaData, selections)
  const childParams: Record<string, string | number | boolean> = { ...params }
  for (const control of dropdowns) {
    if (control.value) childParams[control.paramName] = control.value
  }

  return (
    <WidgetBlock
      widgetMetaData={widgetMetaData}
      data={payload as WidgetChromeData | undefined}
      isLoading={isLoading && !payload}
      isFetching={isFetching}
      isError={isError}
      error={error}
      onReload={handleReload}
      onExport={handleExport}
      exportMessage={exportMessage}
      dropdowns={dropdowns}
      onDropdownChange={handleDropdownChange}
      className={className}
      bare={bare}
    >
      {payload && (
        <WidgetRenderer
          widgetMetaData={widgetMetaData}
          data={payload}
          recordContext={recordContext}
          actionCallback={actionCallback}
          widgetRegistry={widgetRegistry}
          childParams={childParams}
          onReload={handleReload}
        />
      )}
    </WidgetBlock>
  )
}
