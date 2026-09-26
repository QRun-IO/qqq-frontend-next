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
 * @file DynamicFormWidget — a `dynamicForm` widget: a backend-declared field list with
 * values. It is read-only on dashboards and record views. On a screen whose form hosts
 * widgets (a process step, see `widget-form-host`) it is editable when its metadata says
 * so (`defaultValues.isEditable`, as the report-variables widget of the render-report
 * process does) or when the host makes widgets editable by default, as Material's
 * DynamicFormWidget: its fields join the host's form (required fields block the
 * submission, possible values show labels and search their source) and their values
 * are submitted with it.
 */
'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { useWatch } from 'react-hook-form'

import type { QFieldMetaData, QRecord } from '@/types'
import { DynamicForm } from '@/components/forms/DynamicForm'
import { useWidgetFormHost, type WidgetFormHost } from './widget-form-host'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { formatPlainValue, parseJsonValue, recordValue } from './record-widget-utils'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import type { WidgetComponentProps, WidgetFormContext } from './widget-types'

/** A field in the dynamic form's field list (backend `QFieldMetaData`). */
export interface DynamicFormField {
  name: string
  label?: string
  type?: string
  isRequired?: boolean
  isEditable?: boolean
  defaultValue?: unknown
  possibleValueSourceName?: string
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
 * Whether the widget is editable on this screen: its `defaultValues.isEditable` when set
 * (Material reads it first), else what the host screen decides.
 *
 * @param defaults - The widget's default values.
 * @param host - The hosting form, if any.
 * @returns `true` when the fields are edited in the host's form.
 */
export function isDynamicFormEditable(defaults: Record<string, unknown> | undefined, host: WidgetFormHost | null): boolean {
  if (!host) return false
  const declared = defaults?.isEditable
  if (declared !== undefined && declared !== null) return declared === true || declared === 'true'
  return host.editableByDefault
}

/**
 * The widget's fields as form fields: labeled, and editable unless the backend says not.
 *
 * @param fields - The payload's field list.
 * @returns Form field metadata.
 */
function formFieldsOf(fields: DynamicFormField[]): QFieldMetaData[] {
  return fields.map((field) => ({
    ...({ isHeavy: false, isHidden: false, adornments: [] } as Partial<QFieldMetaData>),
    ...(field as unknown as QFieldMetaData),
    label: field.label || field.name,
    type: (field.type ?? 'STRING') as QFieldMetaData['type'],
    isRequired: field.isRequired === true,
    isEditable: field.isEditable !== false,
  }))
}

/**
 * The widget's fields in the host's form: registered with the host (so they are
 * validated and submitted), seeded from their default or current values, with
 * possible values from their sources and labels from `recordOfFieldValues`.
 *
 * @param props - Widget name, fields, starting values and display values, and the host.
 * @returns The editable fields.
 */
function EditableDynamicForm({ widgetName, fields, values, displayValues, host, mergedFieldName, setMergedValues }: {
  widgetName: string
  fields: DynamicFormField[]
  values: Record<string, unknown>
  displayValues: Record<string, string>
  host: WidgetFormHost
  mergedFieldName?: string
  setMergedValues?: WidgetFormContext['setValues']
}) {
  const formFields = useMemo(() => formFieldsOf(fields), [fields])
  const names = useMemo(() => formFields.map((field) => field.name), [formFields])
  const { form, registerFields } = host
  const watched = useWatch({ control: form.control, name: names })
  const seeded = useRef(new Set<string>())

  useEffect(() => {
    for (const field of formFields) {
      if (seeded.current.has(field.name)) continue
      seeded.current.add(field.name)
      const start = values[field.name] ?? field.defaultValue
      form.setValue(field.name, start === undefined || start === null ? (field.type === 'BOOLEAN' ? null : '') : field.type === 'BOOLEAN' ? start === true || start === 'true' : start)
    }
  }, [form, formFields, values])

  useEffect(() => {
    registerFields(widgetName, formFields)
    return () => registerFields(widgetName, [])
  }, [formFields, registerFields, widgetName])

  // Material writes the widget's current fields as JSON into a declared record field.
  // Process widgets have no record form callback, so their values stay as process inputs.
  useEffect(() => {
    if (!mergedFieldName || !setMergedValues || watched.some((value) => value === undefined)) return
    const serialized = JSON.stringify(Object.fromEntries(names.map((name, index) => [name, watched[index]])))
    if (form.getValues(mergedFieldName) !== serialized) setMergedValues({ [mergedFieldName]: serialized })
  }, [form, mergedFieldName, names, setMergedValues, watched])

  const record = useMemo<QRecord>(() => ({ tableName: '', values, displayValues }), [displayValues, values])
  return (
    <div data-qqq-id={`widget-dynamicForm-${widgetName}`} data-editable="true">
      <DynamicForm
        register={form.register}
        control={form.control}
        errors={form.formState.errors}
        fields={formFields}
        record={record}
        possibleValueContext={{ type: 'standalone' }}
        disabled={host.disabled}
      />
    </div>
  )
}

/**
 * Renders the dynamic form's fields: editable in a hosting form when the widget is
 * editable there (see {@link isDynamicFormEditable}), else as labeled read-only values
 * (`0` and `false` are shown; absent values show an em dash).
 *
 * @param props - Widget metadata, payload and the hosting record context.
 * @returns The fields, the no-fields message (nothing when the payload has none), or a contained notice.
 */
export function DynamicFormWidget({ widgetMetaData, data, recordContext, formContext }: WidgetComponentProps<DynamicFormPayload>) {
  const widgetName = widgetMetaData.name
  const host = useWidgetFormHost()
  const fields = useMemo(() => asList<DynamicFormField>(data?.fieldList), [data?.fieldList])
  const values = useMemo(() => valuesFor(data ?? {}, recordContext), [data, recordContext])
  const displayValues = useMemo(() => data?.recordOfFieldValues?.displayValues ?? {}, [data?.recordOfFieldValues?.displayValues])
  if (fields === undefined || values === undefined || fields.some((field) => !isPlainObject(field) || typeof field.name !== 'string')) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('dynamic form', 'fieldList or recordOfFieldValues')} />
  }
  if (fields.length === 0) {
    // Without a message there is nothing to show: a process step with no report variables has no form (as in Material)
    return data?.noFieldsMessage ? <WidgetEmpty widgetName={widgetName}>{data.noFieldsMessage}</WidgetEmpty> : null
  }
  if (host && isDynamicFormEditable(widgetMetaData.defaultValues, host)) {
    return (
      <EditableDynamicForm
        widgetName={widgetName}
        fields={fields}
        values={values}
        displayValues={displayValues}
        host={host}
        mergedFieldName={data.mergedDynamicFormValuesIntoFieldName}
        setMergedValues={formContext?.setValues}
      />
    )
  }
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
