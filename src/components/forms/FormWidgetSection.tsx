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
 * @file FormWidgetSection — a widget shown as an editable section of a record create or edit
 * form (Material's `EntityForm.getWidgetSection`): its data is loaded with the record's key and
 * the form's preset values, and it edits through a {@link WidgetFormContext}.
 */

'use client'

import React, { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'

import type { QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import { fetchWidgetData } from '@/lib/api/widgets'
import { HANDLES_OWN_ERRORS } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'

import type { ChildRecordListPayload } from '@/components/widgets/ChildRecordListWidget'
import type { WidgetFormContext } from '@/components/widgets/widget-types'
import { WidgetFormHostContext, type WidgetFormHost } from '@/components/widgets/widget-form-host'
import { WidgetRenderer } from '@/components/widgets/WidgetRenderer'
import { ChildRecordListEditor } from './ChildRecordListEditor'

/**
 * Whether a widget renders as an editable section on record create and edit screens, as
 * Material's `processTableSections` decides: a child record list that manages an association,
 * the filter and columns, pivot table and dynamic form setups, and any widget declaring
 * `includeOnRecordEditScreen` (a cron schedule is edited through its fields by DynamicForm).
 *
 * @param widget - Widget metadata.
 * @returns True when the form shows the widget.
 */
export function isEditableFormWidget(widget: QWidgetMetaData): boolean {
  const defaults = widget.defaultValues ?? {}
  if (widget.type === 'cronUI') return false
  if (widget.type === 'childRecordList') return typeof defaults.manageAssociationName === 'string' && defaults.manageAssociationName !== ''
  if (widget.type === 'filterAndColumnsSetup' || widget.type === 'pivotTableSetup' || widget.type === 'dynamicForm') return true
  return defaults.includeOnRecordEditScreen === true
}

/** Props for {@link FormWidgetSection}. */
export interface FormWidgetSectionProps {
  /** The widget the section houses. */
  widgetMetaData: QWidgetMetaData
  /** Widget request parameters: the record's key and the form's preset values (plus field rule reloads). */
  params: Record<string, string | number | boolean>
  /** Bumped by a RELOAD_WIDGET field rule to fetch the widget again. */
  reloadCount: number
  /** The form's control, for live values. */
  control: Control<Record<string, unknown>>
  /** Create or edit screen. */
  screen: 'recordCreate' | 'recordEdit'
  /** The record being edited. */
  record?: QRecord
  /** The form's table definition. */
  tableMetaData: QTableMetaData
  /** Writes values into the form. */
  setValues: (values: Record<string, unknown>) => void
  /** Replaces a managed association's records. */
  setAssociation: (name: string, records: Array<Record<string, unknown>>) => void
  /** Registers a check run before saving. */
  registerValidator: (key: string, validate: (() => string[]) | null) => void
  /** Gives dynamic widgets the parent React Hook Form and field registration. */
  host: WidgetFormHost
  /** When true the form is locked. */
  disabled: boolean
}

/**
 * Loads a widget's data and renders it as an editable part of the form.
 *
 * @param props - See {@link FormWidgetSectionProps}.
 * @returns The widget, its loading state, or its load error.
 */
export function FormWidgetSection({
  widgetMetaData, params, reloadCount, control, screen, record, tableMetaData, setValues, setAssociation, registerValidator, host, disabled,
}: FormWidgetSectionProps) {
  const query = useQuery({
    queryKey: ['qqq', 'formWidget', widgetMetaData.name, params, reloadCount],
    queryFn: () => fetchWidgetData(widgetMetaData.name, params),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    meta: HANDLES_OWN_ERRORS,
  })
  const watched = useWatch({ control }) as Record<string, unknown>
  // The form holds only what it edits; a widget reads anything else from the stored record.
  const values = useMemo(() => ({ ...(record?.values ?? {}), ...watched }), [record, watched])
  const formContext = useMemo<WidgetFormContext>(() => ({
    screen, values, setValues, setAssociation, registerValidator, record, tableMetaData, disabled,
  }), [screen, values, setValues, setAssociation, registerValidator, record, tableMetaData, disabled])

  if (query.isError) {
    return (
      <p role="alert" className="text-sm text-destructive" data-qqq-id={`form-widget-error-${widgetMetaData.name}`}>
        {`Could not load ${widgetMetaData.label}: ${getErrorMessage(query.error)}`}
      </p>
    )
  }
  if (!query.data) {
    return (
      <p role="status" className="text-sm text-muted-foreground" data-qqq-id={`form-widget-loading-${widgetMetaData.name}`}>
        {`Loading ${widgetMetaData.label}...`}
      </p>
    )
  }

  const primaryKey = record?.values[tableMetaData.primaryKeyField]
  return (
    <div data-qqq-id={`form-widget-${widgetMetaData.name}`}>
      {widgetMetaData.type === 'childRecordList' ? (
        <ChildRecordListEditor
          widgetMetaData={widgetMetaData}
          data={query.data as unknown as ChildRecordListPayload}
          formContext={formContext}
        />
      ) : (
        <WidgetFormHostContext.Provider value={host}>
          <WidgetRenderer
            widgetMetaData={widgetMetaData}
            data={query.data}
            formContext={formContext}
            recordContext={{
              tableName: tableMetaData.name,
              recordId: primaryKey !== null && primaryKey !== undefined ? String(primaryKey) : undefined,
              record: { tableName: tableMetaData.name, values, displayValues: record?.displayValues ?? {} },
              tableMetaData,
            }}
          />
        </WidgetFormHostContext.Provider>
      )}
    </div>
  )
}
