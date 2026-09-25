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
 * @file DynamicFormWidget — read-only view of a `dynamicForm` widget: a
 * backend-declared field list with values.
 */
'use client'

import React from 'react'

import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { formatPlainValue, parseJsonValue, recordValue } from './record-widget-utils'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import type { WidgetComponentProps } from './widget-types'

/** A field in the dynamic form's field list. */
export interface DynamicFormField {
  name: string
  label?: string
  type?: string
}

/** Payload of the `dynamicForm` widget (`DynamicFormWidgetData`). */
export interface DynamicFormPayload {
  type?: string
  fieldList?: DynamicFormField[]
  recordOfFieldValues?: { values?: Record<string, unknown>; displayValues?: Record<string, string> }
  noFieldsMessage?: string
  /** Record field whose (JSON) value holds the form values instead of recordOfFieldValues. */
  mergedDynamicFormValuesIntoFieldName?: string
}

/**
 * Resolves the values map: from the hosting record's merged field when the
 * payload names one, else from `recordOfFieldValues`.
 *
 * @param data - Widget payload.
 * @param recordContext - Hosting record context.
 * @returns The values map, or undefined when the payload values are malformed.
 */
function valuesFor(data: DynamicFormPayload, recordContext: WidgetComponentProps<DynamicFormPayload>['recordContext']): Record<string, unknown> | undefined {
  const merged = data.mergedDynamicFormValuesIntoFieldName
  if (merged) {
    const parsed = parseJsonValue(recordValue(recordContext, merged))
    if (parsed.ok && isPlainObject(parsed.value)) return parsed.value
  }
  const values = data.recordOfFieldValues?.values
  if (values === undefined || values === null) return {}
  return isPlainObject(values) ? values : undefined
}

/**
 * Renders the dynamic form's fields as labeled read-only values. `0` and
 * `false` are shown; absent values show an em dash.
 *
 * @param props - Widget metadata, payload and the hosting record context.
 * @returns The rendered definition list, the no-fields message (nothing when the payload has none), or a contained notice.
 */
export function DynamicFormWidget({ widgetMetaData, data, recordContext }: WidgetComponentProps<DynamicFormPayload>) {
  const widgetName = widgetMetaData.name
  const fields = asList<DynamicFormField>(data?.fieldList)
  const values = valuesFor(data ?? {}, recordContext)
  if (fields === undefined || values === undefined || fields.some((field) => !isPlainObject(field) || typeof field.name !== 'string')) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('dynamic form', 'fieldList or recordOfFieldValues')} />
  }
  if (fields.length === 0) {
    // Without a message there is nothing to show: a process step with no report variables has no form (as in Material)
    return data?.noFieldsMessage ? <WidgetEmpty widgetName={widgetName}>{data.noFieldsMessage}</WidgetEmpty> : null
  }
  const displayValues = data?.recordOfFieldValues?.displayValues ?? {}
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2" data-qqq-id={`widget-dynamicForm-${widgetName}`}>
      {fields.map((field) => {
        const display = displayValues[field.name]
        const value = display !== undefined && display !== null && display !== '' ? display : values[field.name]
        return (
          <div key={field.name} data-qqq-id={`dynamic-form-field-${widgetName}-${field.name}`}>
            <dt className="text-sm text-muted-foreground">{field.label ?? field.name}</dt>
            <dd className="text-sm font-medium text-foreground">{formatPlainValue(value, field.type)}</dd>
          </div>
        )
      })}
    </dl>
  )
}
