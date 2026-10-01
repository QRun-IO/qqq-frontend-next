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
 * @file PivotTableSetupWidget — a record's pivot table definition (the `pivotTableSetup`
 * widget type, used by saved reports). On the record view it lists the rows, columns and
 * values; inside a record form it edits them (Material's `PivotTableSetupWidget`): the
 * "Use Pivot Table?" switch and the "Edit Pivot Table" modal editor.
 */
'use client'

import React, { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import type { QTableMetaData, QWidgetMetaData } from '@/types'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { VIEW_SCREEN_HELP_ROLES } from '@/lib/utils/help-utils'
import { WidgetSlotHelp } from './WidgetSlotHelp'
import { HoverTooltip } from './HoverTooltip'
import { WidgetHeaderLinkButton, WidgetHeaderToggle } from './WidgetHeaderControls'
import { WidgetPayloadNotice } from './WidgetNotice'
import { PivotTableEditorDialog } from './pivot-table/PivotTableEditorDialog'
import {
  hasPivotEntries,
  parsePivotDefinition,
  PIVOT_FUNCTION_LABELS,
  PIVOT_NO_COLUMNS_REASON,
  PIVOT_NO_TABLE_REASON,
  reportColumnFieldNames,
  serializePivotDefinition,
} from './pivot-table/pivot-table-model'
import type { PivotDefinition, PivotSection } from './pivot-table/pivot-table-model'
import { parseJsonValue, resolveFieldLabel } from './record-widget-utils'
import { isPlainObject, payloadProblem } from './widget-types'
import type { WidgetComponentProps, WidgetFormContext } from './widget-types'

export { PIVOT_FUNCTION_LABELS } from './pivot-table/pivot-table-model'

/** Payload of the `pivotTableSetup` widget (the default widget renderer's echo). */
export interface PivotTableSetupPayload {
  type?: string
  queryParams?: Record<string, string>
}

/** Record field holding the pivot table definition JSON. */
const PIVOT_FIELD_NAME = 'pivotTableJson'

/** Record field holding the report's columns JSON (the fields a pivot table may use). */
const COLUMNS_FIELD_NAME = 'columnsJson'

/** Record field holding the report's table name. */
const TABLE_FIELD_NAME = 'tableName'

/**
 * Form value (not a backend field) that Material's widget writes when its switch changes;
 * a definition also turns the pivot table on.
 */
const USE_PIVOT_FIELD_NAME = 'usePivotTable'

/** Singular noun of each part, used in the "Add new ..." buttons. */
const SECTION_NOUNS: Record<PivotSection, string> = { rows: 'row', columns: 'column', values: 'value' }

/** Result of reading the definition from a record's or form's values. */
type DefinitionRead = { definition: PivotDefinition; problem?: undefined } | { definition?: undefined; problem: string }

/**
 * Reads the pivot table definition from a `pivotTableJson` value.
 *
 * @param raw - The stored value (a JSON string, an object, or empty).
 * @returns The definition, or the problem to show when it is not a definition.
 */
function readDefinition(raw: unknown): DefinitionRead {
  const parsed = parseJsonValue(raw)
  if (!parsed.ok || (parsed.value !== undefined && parsed.value !== null && !isPlainObject(parsed.value))) {
    return { problem: payloadProblem('pivot table', 'the pivot table definition is not valid JSON') }
  }
  const definition = parsePivotDefinition(parsed.value)
  return definition ? { definition } : { problem: payloadProblem('pivot table', 'the pivot table definition has an unexpected shape') }
}

/**
 * Whether the pivot table is on: the `usePivotTable` value is set, or there is a definition
 * (Material sets its switch on when the record has a definition).
 *
 * @param values - The record's or form's values.
 * @param definition - The definition, when readable.
 * @returns True when the report uses a pivot table.
 */
function usesPivotTable(values: Record<string, unknown>, definition: PivotDefinition | undefined): boolean {
  return Boolean(values[USE_PIVOT_FIELD_NAME]) || (definition !== undefined && hasPivotEntries(definition))
}

/**
 * Reads the report's table name.
 *
 * @param values - The record's or form's values.
 * @returns The table name, or undefined when none is set.
 */
function tableNameOf(values: Record<string, unknown>): string | undefined {
  const tableName = values[TABLE_FIELD_NAME]
  return typeof tableName === 'string' && tableName ? tableName : undefined
}

/** Props for {@link PivotSummary}. */
interface PivotSummaryProps {
  widgetMetaData: QWidgetMetaData
  widgetName: string
  table: QTableMetaData | undefined
  definition: PivotDefinition
  /** What an empty part shows ("None" on the record view, an add button in a form). */
  emptyContent: (section: PivotSection) => React.ReactNode
}

/**
 * The rows, columns and values of a definition, by field label.
 *
 * @param props - See {@link PivotSummaryProps}.
 * @returns The three parts.
 */
function PivotSummary({ widgetMetaData, widgetName, table, definition, emptyContent }: PivotSummaryProps) {
  const label = (fieldName: string) => resolveFieldLabel(table, fieldName).label
  const groupByLabels = (section: 'rows' | 'columns') =>
    (definition[section] ?? []).flatMap((item) => (item.fieldName ? [label(item.fieldName)] : []))
  const valueLabels = (definition.values ?? []).map((item) =>
    item.fieldName && item.function ? `${PIVOT_FUNCTION_LABELS[item.function] ?? item.function} of ${label(item.fieldName)}` : '--')

  const part = (title: string, section: PivotSection, items: string[]) => (
    <div key={section}>
      <dt className="text-sm font-semibold text-foreground">{title}</dt>
      <dd className="mt-0.5 text-sm">
        {items.length === 0 ? (
          <div data-qqq-id={`pivot-${section}-${widgetName}`}>{emptyContent(section)}</div>
        ) : (
          <ul className="flex flex-wrap gap-1.5" data-qqq-id={`pivot-${section}-${widgetName}`}>
            {items.map((item, index) => (
              <li key={`${item}-${index}`} className="rounded-lg border border-border px-2 py-0.5">{item}</li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  )

  return (
    <div className="space-y-3" data-qqq-id={`widget-pivotTableSetup-${widgetName}`}>
      {/* Material's "sectionSubhead" help slot, above the pivot table definition */}
      <WidgetSlotHelp widgetMetaData={widgetMetaData} slot="sectionSubhead" roles={VIEW_SCREEN_HELP_ROLES} className="text-sm text-muted-foreground" />
      <dl className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-qqq-id={`pivot-definition-${widgetName}`}>
        {part('Rows', 'rows', groupByLabels('rows'))}
        {part('Columns', 'columns', groupByLabels('columns'))}
        {part('Values', 'values', valueLabels)}
      </dl>
    </div>
  )
}

/**
 * Read-only view: the rows, columns and values, or that the report does not use a pivot table.
 *
 * @param props - Widget metadata and the hosting record's values.
 * @returns The summary, the no-pivot message, or a contained notice.
 */
function PivotTableSetupView({ widgetMetaData, values }: { widgetMetaData: QWidgetMetaData; values: Record<string, unknown> }) {
  const widgetName = widgetMetaData.name
  const tableName = tableNameOf(values)
  const { data: table, isLoading } = useTableMetaData(tableName)
  const read = readDefinition(values[PIVOT_FIELD_NAME])

  if (read.problem !== undefined) {
    return <WidgetPayloadNotice widgetName={widgetName} message={read.problem} />
  }
  if (!usesPivotTable(values, read.definition)) {
    return (
      <p className="text-sm text-muted-foreground" data-qqq-id={`widget-pivotTableSetup-${widgetName}`}>
        This report does not use a pivot table.
      </p>
    )
  }
  if (tableName && isLoading) {
    return <div className="h-12 animate-pulse rounded bg-muted" aria-busy="true" aria-label="Loading pivot table" data-qqq-id={`widget-pivotTableSetup-${widgetName}`} />
  }
  return (
    <div data-qqq-id={`widget-pivotTableSetup-${widgetName}`}>
      <PivotSummary
        widgetMetaData={widgetMetaData}
        widgetName={widgetName}
        table={table}
        definition={read.definition}
        emptyContent={() => <span className="text-muted-foreground">None</span>}
      />
    </div>
  )
}

/**
 * Edit mode, inside a record form: the "Use Pivot Table?" switch (off clears the definition),
 * the "Edit Pivot Table" button and its modal editor, and the current definition. Editing
 * needs the report's table and columns; until then the controls are disabled with the reason.
 *
 * @param props - Widget metadata and the form context.
 * @returns The editor.
 */
function PivotTableSetupEditor({ widgetMetaData, formContext }: { widgetMetaData: QWidgetMetaData; formContext: WidgetFormContext }) {
  const widgetName = widgetMetaData.name
  const { values, setValues, disabled = false } = formContext
  const tableName = tableNameOf(values)
  const { data: table } = useTableMetaData(tableName)
  const rawDefinition = values[PIVOT_FIELD_NAME]
  const rawColumns = values[COLUMNS_FIELD_NAME]
  const read = useMemo(() => readDefinition(rawDefinition), [rawDefinition])
  const availableFieldNames = useMemo(() => {
    const parsed = parseJsonValue(rawColumns)
    return parsed.ok ? reportColumnFieldNames(parsed.value) : []
  }, [rawColumns])
  const [enabledOverride, setEnabledOverride] = useState<boolean | undefined>(undefined)
  const [editorOpen, setEditorOpen] = useState(false)

  const enabled = enabledOverride ?? usesPivotTable(values, read.definition)
  const reason = !table ? PIVOT_NO_TABLE_REASON : availableFieldNames.length === 0 ? PIVOT_NO_COLUMNS_REASON : null
  const editDisabled = disabled || reason !== null

  const toggle = (checked: boolean) => {
    setEnabledOverride(checked)
    setValues(checked ? { [USE_PIVOT_FIELD_NAME]: true } : { [USE_PIVOT_FIELD_NAME]: false, [PIVOT_FIELD_NAME]: null })
  }

  const openEditor = () => {
    if (!editDisabled && read.definition) setEditorOpen(true)
  }

  const save = (definition: PivotDefinition) => {
    setValues({ [PIVOT_FIELD_NAME]: serializePivotDefinition(definition), [USE_PIVOT_FIELD_NAME]: true })
    setEditorOpen(false)
  }

  const toggleControl = (
    <WidgetHeaderToggle
      label="Use Pivot Table?"
      checked={enabled}
      onChange={toggle}
      disabled={editDisabled}
      qqqId={`pivot-use-toggle-${widgetName}`}
    />
  )

  const addButton = (section: PivotSection) => {
    const noun = SECTION_NOUNS[section]
    const button = (
      <button
        type="button"
        onClick={openEditor}
        disabled={editDisabled}
        data-qqq-id={`pivot-add-${noun}-${widgetName}`}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline pointer-coarse:min-h-11"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add new {noun}
      </button>
    )
    return !disabled && reason ? <HoverTooltip content={reason} qqqId={`pivot-add-${noun}-${widgetName}-tooltip`}>{button}</HoverTooltip> : button
  }

  return (
    <div className="space-y-3" data-qqq-id={`widget-pivotTableSetup-${widgetName}`}>
      <div className="flex justify-end">
        {!disabled && reason ? <HoverTooltip content={reason} qqqId={`pivot-use-toggle-${widgetName}-tooltip`}>{toggleControl}</HoverTooltip> : toggleControl}
      </div>
      {read.problem !== undefined && <WidgetPayloadNotice widgetName={widgetName} message={read.problem} />}
      {enabled && read.definition && (
        <>
          <div className="flex justify-end">
            <WidgetHeaderLinkButton
              label="Edit Pivot Table"
              onClick={openEditor}
              disabled={editDisabled}
              disabledTooltip={disabled ? null : reason}
              qqqId={`pivot-edit-button-${widgetName}`}
            />
          </div>
          <PivotSummary widgetMetaData={widgetMetaData} widgetName={widgetName} table={table} definition={read.definition} emptyContent={addButton} />
        </>
      )}
      {table && read.definition && (
        <PivotTableEditorDialog
          open={editorOpen}
          widgetName={widgetName}
          tableMetaData={table}
          availableFieldNames={availableFieldNames}
          definition={read.definition}
          disabled={disabled}
          onCancel={() => setEditorOpen(false)}
          onSave={save}
        />
      )}
    </div>
  )
}

/**
 * Renders the hosting record's pivot table: editable inside a form (`formContext`), else
 * read-only from the record view's record.
 *
 * @param props - Widget metadata and the hosting record or form context.
 * @returns The editor, or the read-only view.
 */
export function PivotTableSetupWidget({ widgetMetaData, recordContext, formContext }: WidgetComponentProps<PivotTableSetupPayload>) {
  if (formContext) return <PivotTableSetupEditor widgetMetaData={widgetMetaData} formContext={formContext} />
  return <PivotTableSetupView widgetMetaData={widgetMetaData} values={recordContext?.record?.values ?? {}} />
}
