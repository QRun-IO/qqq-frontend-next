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
 * @file Container-style QQQ widgets: parent widgets (grid/tabs), process widgets
 * and dynamically loaded custom components.
 */
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import type { QWidgetMetaData } from '@/types'
import { loadMetaData } from '@/lib/api/metadata'
import { useProcessMetaData } from '@/lib/hooks/use-metadata'
import { queryKeys } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'
import type { WidgetComponentProps } from './widget-types'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import { ConnectedWidget } from './ConnectedWidget'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { WIDGET_SELECTED_TAB_STORAGE_ROOT, widgetColumnClasses } from './widget-utils'
import { ProcessRun } from '@/components/process/ProcessRun'

/** `ParentWidgetData` payload. */
export interface QqqParentPayload {
  type?: string
  childWidgetNameList?: unknown
  layoutType?: string
}

/** Extra props for parent widgets. */
interface ParentWidgetProps extends WidgetComponentProps<QqqParentPayload> {
  /** All widget metadata; falls back to the cached instance metadata. */
  widgetRegistry?: Record<string, QWidgetMetaData>
  /** The parent's request parameters (record context and dropdown selections) for its children. */
  childParams?: Record<string, string | number | boolean>
}

/**
 * Reads the stored tab index for a tabbed parent.
 *
 * @param parentName - Parent widget name.
 * @returns The stored index, or 0.
 */
function storedTab(parentName: string): number {
  try {
    const value = Number(window.localStorage.getItem(`${WIDGET_SELECTED_TAB_STORAGE_ROOT}.${parentName}`))
    return Number.isInteger(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

/**
 * Renders a QQQ `parentWidget`: the children named by the payload's
 * `childWidgetNameList`, in a 12-column grid or as tabs (`layoutType: TABS`, with
 * the selected tab remembered per parent). Each child fetches its own data with
 * the parent's selections. Children missing from the user's metadata (denied or
 * unknown) are skipped without a request.
 *
 * @param props - See {@link ParentWidgetProps}.
 * @returns The children.
 */
export function QqqParentWidget({ widgetMetaData, data, widgetRegistry, childParams, recordContext, actionCallback }: ParentWidgetProps) {
  const { data: instance } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
    enabled: !widgetRegistry,
  })
  const registry = widgetRegistry ?? instance?.widgets
  const names = asList<string>(data.childWidgetNameList)
  const [tab, setTab] = useState(0)
  useEffect(() => { setTab(storedTab(widgetMetaData.name)) }, [widgetMetaData.name])

  const children = useMemo(() => (names ?? []).flatMap((childName) => {
    const meta = typeof childName === 'string' ? registry?.[childName] : undefined
    return meta && meta.hasPermission !== false ? [meta] : []
  }), [names, registry])

  if (!names || names.some((childName) => typeof childName !== 'string')) {
    return <WidgetPayloadNotice widgetName={widgetMetaData.name} message={payloadProblem('parent', 'childWidgetNameList')} />
  }
  if (!registry) return null
  if (children.length === 0) {
    return <WidgetEmpty widgetName={widgetMetaData.name}>No child widgets to show</WidgetEmpty>
  }

  if (String(data.layoutType ?? '').toUpperCase() === 'TABS') {
    const active = Math.min(tab, children.length - 1)
    const select = (index: number) => {
      setTab(index)
      try { window.localStorage.setItem(`${WIDGET_SELECTED_TAB_STORAGE_ROOT}.${widgetMetaData.name}`, String(index)) } catch { /* convenience only */ }
    }
    return (
      <div data-qqq-id={`parent-widget-${widgetMetaData.name}`} data-layout="TABS">
        <div role="tablist" aria-label={widgetMetaData.label} className="mb-3 flex gap-1 border-b border-border">
          {children.map((child, index) => (
            <button
              key={child.name}
              type="button"
              role="tab"
              id={`tab-${widgetMetaData.name}-${child.name}`}
              aria-selected={index === active}
              aria-controls={`tabpanel-${widgetMetaData.name}-${child.name}`}
              tabIndex={index === active ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') select((active + 1) % children.length)
                if (event.key === 'ArrowLeft') select((active - 1 + children.length) % children.length)
              }}
              className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring',
                index === active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
              data-qqq-id={`tab-${widgetMetaData.name}-${child.name}`}
            >
              {child.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`tabpanel-${widgetMetaData.name}-${children[active].name}`} aria-labelledby={`tab-${widgetMetaData.name}-${children[active].name}`}>
          <ConnectedWidget
            key={children[active].name}
            widgetMetaData={children[active]}
            params={childParams}
            parentMetaData={widgetMetaData}
            widgetRegistry={registry}
            recordContext={recordContext}
            actionCallback={actionCallback}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-12 gap-4" data-qqq-id={`parent-widget-${widgetMetaData.name}`} data-layout="GRID">
      {children.map((child) => (
        <div key={child.name} className={widgetColumnClasses(child.gridColumns)}>
          <ConnectedWidget
            widgetMetaData={child}
            params={childParams}
            parentMetaData={widgetMetaData}
            widgetRegistry={registry}
            recordContext={recordContext}
            actionCallback={actionCallback}
          />
        </div>
      ))}
    </div>
  )
}

/** `ProcessWidgetData` payload. */
export interface QqqProcessPayload {
  type?: string
  processMetaData?: unknown
  defaultValues?: Record<string, unknown>
}

/**
 * Renders a QQQ `process` widget: the named process runs inline, seeded with the
 * payload's default values and any `recordIds` in the page URL.
 *
 * @param props - Widget props.
 * @returns The embedded process, or an empty message when no process is available.
 */
export function QqqProcessWidget({ widgetMetaData, data }: WidgetComponentProps<QqqProcessPayload>) {
  const searchParams = useSearchParams()
  const processName = isPlainObject(data.processMetaData) && typeof data.processMetaData.name === 'string' ? data.processMetaData.name : undefined
  const { data: process, isError } = useProcessMetaData(processName)
  if (data.processMetaData !== undefined && !processName) {
    return <WidgetPayloadNotice widgetName={widgetMetaData.name} message={payloadProblem('process', 'processMetaData')} />
  }
  if (!processName) return <WidgetEmpty widgetName={widgetMetaData.name}>No process is available.</WidgetEmpty>
  if (isError) return <WidgetEmpty widgetName={widgetMetaData.name}>This process is not available.</WidgetEmpty>
  if (!process) return <div className="h-24 animate-pulse rounded bg-muted" role="status" aria-label="Loading process" />
  const recordIds = searchParams.get('recordIds')
  return (
    <div data-qqq-id={`process-widget-${widgetMetaData.name}`}>
      <ProcessRun
        processName={processName}
        processMetaData={process}
        initialValues={data.defaultValues}
        initialRequest={recordIds ? { recordsParam: 'recordIds', recordIds, values: data.defaultValues } : { values: data.defaultValues }}
      />
    </div>
  )
}

/** Loaded custom component bundles, keyed by source URL. */
const bundles = new Map<string, Promise<void>>()

/**
 * Loads a component bundle once per URL by adding a script tag.
 *
 * @param url - Bundle URL.
 * @returns Resolves when loaded, rejects when the script fails.
 */
function loadBundle(url: string): Promise<void> {
  let pending = bundles.get(url)
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => { bundles.delete(url); reject(new Error(`Could not load ${url}`)) }
      document.head.appendChild(script)
    })
    bundles.set(url, pending)
  }
  return pending
}

/** Props passed to a dynamically loaded component (same contract as Material). */
interface DynamicComponentProps {
  props: Record<string, unknown>
  qContext: Record<string, unknown>
  qfmdBridge: Record<string, unknown>
}

/**
 * Renders a QQQ `customComponent`: loads the bundle at the widget's
 * `componentSourceUrl` default value and renders `window[componentName][componentName]`
 * with `{ props: { widgetMetaData, widgetData, record } }`.
 *
 * @param props - Widget props.
 * @returns The custom component, a loading placeholder, or a contained error.
 */
export function QqqCustomComponentWidget({ widgetMetaData, data, recordContext }: WidgetComponentProps<Record<string, unknown>>) {
  const componentName = String(widgetMetaData.defaultValues?.componentName ?? '')
  const sourceUrl = String(widgetMetaData.defaultValues?.componentSourceUrl ?? '')
  const [state, setState] = useState<{ component?: React.ComponentType<DynamicComponentProps>; failed?: boolean }>({})

  useEffect(() => {
    let active = true
    if (!componentName || !sourceUrl) {
      setState({ failed: true })
      return
    }
    loadBundle(sourceUrl).then(() => {
      const holder = (window as unknown as Record<string, Record<string, unknown> | undefined>)[componentName]
      const component = holder?.[componentName]
      if (active) setState(typeof component === 'function' ? { component: component as React.ComponentType<DynamicComponentProps> } : { failed: true })
    }).catch(() => { if (active) setState({ failed: true }) })
    return () => { active = false }
  }, [componentName, sourceUrl])

  if (state.failed) {
    return <p role="alert" className="text-sm text-destructive" data-qqq-id={`custom-component-error-${widgetMetaData.name}`}>Error loading {componentName || 'component'}</p>
  }
  if (!state.component) {
    return <div className="h-16 animate-pulse rounded bg-muted" role="status" aria-label={`Loading ${componentName}`} />
  }
  const Component = state.component
  const sx = widgetMetaData.defaultValues?.sx
  return (
    <div data-qqq-id={`custom-component-${widgetMetaData.name}`} style={isPlainObject(sx) ? (sx as React.CSSProperties) : undefined}>
      <Component props={{ widgetMetaData, widgetData: data, record: recordContext?.record }} qContext={{}} qfmdBridge={{}} />
    </div>
  )
}
