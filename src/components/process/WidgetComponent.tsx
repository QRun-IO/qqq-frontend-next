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
 * @file WidgetComponent — renders a WIDGET process component, like the Material
 * dashboard: a named widget (seeded from the process value of the same name, or
 * fetched with the process UUID and process values as parameters) or an ad hoc
 * composite widget whose blocks are declared on the component.
 */

'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'

import type { QFrontendComponent, QWidgetMetaData } from '@/types'
import { fetchWidgetData } from '@/lib/api/widgets'

import { WidgetRenderer } from '@/components/widgets/WidgetRenderer'
import { useProcessStep } from './ProcessStepContext'
import { ProcessBlocks, readBlocks } from './ProcessBlocks'

/** Props for {@link WidgetComponent}. */
export interface WidgetComponentProps {
  component: QFrontendComponent
  index: number
}

/**
 * Widget request parameters: the process UUID plus every simple process value.
 * @param processUUID - Run UUID.
 * @param values - Process values.
 * @returns Query parameters.
 */
export function widgetParams(processUUID: string | null, values: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') params[name] = String(value)
  }
  if (processUUID) params.processUUID = processUUID
  return params
}

/**
 * A named widget: composite data renders as interactive blocks, anything else
 * through the dashboard widget renderer.
 * @param props - Widget metadata and optional seeded data.
 * @returns The rendered widget.
 */
function NamedWidget({ widget, seeded, index }: { widget: QWidgetMetaData; seeded: unknown; index: number }) {
  const { processUUID, values } = useProcessStep()
  const query = useQuery({
    queryKey: ['qqq', 'processWidget', widget.name, processUUID],
    queryFn: () => fetchWidgetData(widget.name, widgetParams(processUUID, values)),
    enabled: seeded === undefined || seeded === null,
    staleTime: Infinity,
    retry: false,
  })
  const data = seeded ?? query.data
  if (!data) {
    if (query.isError) return <p role="alert" className="text-sm text-destructive">{`Could not load ${widget.label}.`}</p>
    return <p role="status" className="text-sm text-muted-foreground">{`Loading ${widget.label}...`}</p>
  }
  const blocks = readBlocks(data)
  return (
    <section aria-label={widget.label} className="space-y-2" data-qqq-id={`process-widget-${widget.name}`}>
      {widget.label && <h4 className="text-sm font-semibold text-foreground">{widget.label}</h4>}
      {blocks.length > 0 || widget.type === 'composite'
        ? <ProcessBlocks blocks={blocks} name={`${widget.name}-${index}`} />
        : <WidgetRenderer widgetMetaData={widget} data={data} />}
    </section>
  )
}

/**
 * Render a WIDGET component.
 * @param props - {@link WidgetComponentProps}
 * @returns The widget, or an error when the component names none.
 */
export function WidgetComponent({ component, index }: WidgetComponentProps) {
  const { instance, values } = useProcessStep()
  const widgetName = typeof component.values?.widgetName === 'string' ? component.values.widgetName : ''
  const isAdHoc = component.values?.isAdHocWidget === true

  if (isAdHoc) {
    return (
      <div data-qqq-id={`process-adhoc-widget-${index}`}>
        <ProcessBlocks blocks={readBlocks(component.values)} name={`adhoc-${index}`} />
      </div>
    )
  }
  if (!widgetName) {
    return <p role="alert" className="text-sm text-destructive">This component is a WIDGET but names no widget and is not an ad hoc widget.</p>
  }
  const widget = instance?.widgets?.[widgetName]
  if (!widget) {
    if (!instance) return <p role="status" className="text-sm text-muted-foreground">Loading widget...</p>
    return <p role="alert" className="text-sm text-destructive">{`Unrecognized widget name: ${widgetName}`}</p>
  }
  return <NamedWidget widget={widget} seeded={values[widgetName]} index={index} />
}
