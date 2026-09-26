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
 * @file RowBuilderWidget — a `rowBuilder` widget (Material `RowBuilderWidget`): its rows
 * read-only (record view and dashboards), editable in a record form, or editable in a
 * process step through its host form.
 */
'use client'

import React, { useMemo } from 'react'

import type { QFieldMetaData } from '@/types'
import { ProcessRowBuilderEditor, isRowBuilderEditable as isProcessRowBuilderEditable } from './ProcessRowBuilderEditor'
import { useWidgetFormHost } from './widget-form-host'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { RowBuilderEditor } from './RowBuilderEditor'
import { RowBuilderTable } from './RowBuilderTable'
import {
  DEFAULT_MODAL_TITLE, isRowBuilderEditable, readRowBuilderConfig, rowBuilderFields, seedRows,
} from './row-builder-model'
import type { RowBuilderRecord } from './row-builder-model'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import type { WidgetComponentProps } from './widget-types'

/** Payload of the `rowBuilder` widget (`RowBuilderData`). */
export interface RowBuilderPayload {
  type?: string
  records?: RowBuilderRecord[]
  /** Values written to the host form as they are. */
  hiddenValues?: Record<string, unknown>
  /** Values every new row starts with. */
  defaultValuesForNewRecords?: Record<string, unknown>
  /** Title of the modal editor (wins over the metadata's `modalTitle`). */
  modalTitle?: string
}

/**
 * Columns for rows whose widget declares no fields: the union of the rows' value keys.
 *
 * @param rows - The payload rows.
 * @returns One text column per key, labelled by its key.
 */
function derivedFields(rows: RowBuilderRecord[]): QFieldMetaData[] {
  const names: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row.values ?? {})) {
      if (!names.includes(key)) names.push(key)
    }
  }
  return names.map((name) => ({ name, label: name, type: 'STRING', isRequired: false, isEditable: false, isHeavy: false, isHidden: false, adornments: [] }))
}

/**
 * Renders the widget. With a `formContext` in which the widget is editable (Material:
 * `isForRecordViewAndEditScreen` widgets on record create and edit forms, others when
 * `isEditable`), it edits the rows; otherwise it shows them read-only with the fields
 * from `defaultValues.frontendFields` (else `fields`), hiding `isHidden` fields.
 *
 * @param props - Widget metadata, payload and, inside a form, the form context.
 * @returns The rows, the editor, or a contained notice.
 */
export function RowBuilderWidget({ widgetMetaData, data, formContext, onWidgetData }: WidgetComponentProps<RowBuilderPayload>) {
  const widgetName = widgetMetaData.name
  const host = useWidgetFormHost()
  const defaultValues = widgetMetaData.defaultValues
  const config = useMemo(() => readRowBuilderConfig(defaultValues), [defaultValues])
  const fields = useMemo(() => rowBuilderFields(defaultValues), [defaultValues])
  const records = asList<RowBuilderRecord>(data?.records)
  const malformed = records === undefined || records.some((row) => !isPlainObject(row) || (row.values !== undefined && !isPlainObject(row.values)))
  const hiddenValues = isPlainObject(data?.hiddenValues) ? data.hiddenValues : undefined
  const defaultValuesForNewRecords = isPlainObject(data?.defaultValuesForNewRecords) ? data.defaultValuesForNewRecords : undefined

  if (malformed) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('row builder', 'records')} />
  }

  if (host && onWidgetData && isProcessRowBuilderEditable(widgetMetaData)) {
    return <ProcessRowBuilderEditor widgetMetaData={widgetMetaData} data={data} fields={fields} host={host} onWidgetData={onWidgetData} />
  }

  if (formContext && isRowBuilderEditable(config, formContext.screen)) {
    // on the edit screen, rows come from the payload (the backend loads the association),
    // else from the record's associated records when the page already has them
    const associated = config.associationName ? formContext.record?.associatedRecords?.[config.associationName] : undefined
    const initialRecords = records.length === 0 && associated?.length ? associated : records
    const modalTitle = (typeof data?.modalTitle === 'string' && data.modalTitle) || config.modalTitle || DEFAULT_MODAL_TITLE
    return (
      <RowBuilderEditor
        widgetMetaData={widgetMetaData}
        config={config}
        fields={fields}
        initialRecords={initialRecords}
        defaultValuesForNewRecords={defaultValuesForNewRecords}
        hiddenValues={hiddenValues}
        modalTitle={modalTitle}
        formContext={formContext}
      />
    )
  }

  const columns = fields.length > 0 ? fields : derivedFields(records)
  if (records.length === 0 && columns.length === 0) {
    return <WidgetEmpty widgetName={widgetName}>No rows</WidgetEmpty>
  }
  return (
    <div className="space-y-2" data-qqq-id={`widget-rowBuilder-${widgetName}`}>
      {config.inlineHeading && (
        <h4 className="text-base font-semibold text-foreground" data-qqq-id={`row-builder-heading-${widgetName}`}>{config.inlineHeading}</h4>
      )}
      <RowBuilderTable widgetName={widgetName} caption={widgetMetaData.label} fields={columns} rows={seedRows(records, config).rows} />
    </div>
  )
}
