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
 * dashboard: a named widget in its full dashboard chrome (label, icons, help,
 * dropdowns, export, reload), seeded from the process value of the same name or
 * fetched with the process UUID and process values as parameters; or an ad hoc
 * composite widget whose blocks are declared on the component.
 *
 * Widgets that produce values for the process write them into the step, as
 * Material's action callbacks do: an in-process `childRecordList` posts its edited
 * rows as `frontendRecords`, an editable `rowBuilder` posts its rows under its
 * `outputFieldName`, and an editable `dynamicForm`'s fields join the step's form.
 */

'use client'

import React, { useCallback, useMemo, useRef } from 'react'

import type { QFrontendComponent, QWidgetMetaData, WidgetData } from '@/types'
import { isPlainObject } from '@/components/widgets/widget-types'

import { ConnectedWidget } from '@/components/widgets/ConnectedWidget'
import { useProcessStep, useSubmitContributor } from './ProcessStepContext'
import { ProcessBlocks, readBlocks, useProcessBlockAction } from './ProcessBlocks'

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
 * The rows an in-process child record list posts as `frontendRecords` (Material
 * `childRecordData.queryOutput.records`).
 * @param data - The list's payload.
 * @returns The rows as JSON.
 */
export function frontendRecordsJson(data: Record<string, unknown>): string {
  const output = isPlainObject(data.queryOutput) ? data.queryOutput : {}
  return JSON.stringify(Array.isArray(output.records) ? output.records : [])
}

/**
 * A named widget in its dashboard chrome, with the process as its host.
 * @param props - Widget metadata, seeded data and position.
 * @returns The rendered widget.
 */
function NamedWidget({ widget, seeded, index }: { widget: QWidgetMetaData; seeded: unknown; index: number }) {
  const { processUUID, values } = useProcessStep()
  const blockAction = useProcessBlockAction()
  const params = useMemo(() => widgetParams(processUUID, values), [processUUID, values])
  const initialData = useMemo(() => (isPlainObject(seeded) ? { ...seeded, hasPermission: true } as unknown as WidgetData : undefined), [seeded])
  const produced = useRef<Record<string, unknown> | null>(null)
  const type = widget.type ?? (isPlainObject(seeded) && typeof seeded.type === 'string' ? seeded.type : undefined)

  const onWidgetData = useCallback((data: Record<string, unknown>) => {
    produced.current = type === 'childRecordList' ? { frontendRecords: frontendRecordsJson(data) } : { ...(produced.current ?? {}), ...data }
  }, [type])

  useSubmitContributor(`widget-${index}-${widget.name}`, () => ({ maySubmit: true, values: produced.current ?? undefined }))

  return (
    <div data-qqq-id={`process-widget-${widget.name}`}>
      <ConnectedWidget
        widgetMetaData={widget}
        params={params}
        initialData={initialData}
        actionCallback={blockAction}
        onWidgetData={onWidgetData}
      />
    </div>
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
        <ProcessBlocks blocks={readBlocks(component.values)} name={`adhoc-${index}`} composite={component.values} />
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
