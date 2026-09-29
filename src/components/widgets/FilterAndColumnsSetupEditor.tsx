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
 * @file FilterAndColumnsSetupEditor — saved-report filter and column editor.
 * Changes reach the record only on OK.
 */
'use client'

import React, { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import type { QQueryFilter, QTableMetaData, QWidgetMetaData } from '@/types'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import type { PageSize } from '@/lib/hooks/use-record-query'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { useApiTableMetaData, useFilterSetupPreview } from '@/lib/hooks/use-filter-setup'
import { emptyFilter, normalizeFilter, prepFilterForBackend } from '@/lib/utils/filter-utils'
import { EDIT_SCREEN_HELP_ROLES, INSERT_SCREEN_HELP_ROLES } from '@/lib/utils/help-utils'
import { ColumnConfig } from '@/components/query/ColumnConfig'
import { DataGrid } from '@/components/query/DataGrid'
import { FilterBuilder, buildFilterFields } from '@/components/query/FilterBuilder'
import { Pagination } from '@/components/query/Pagination'
import {
  columnsStateFromEntries, DEFAULT_COLUMNS_STATE, editButtonLabel, editorHeading,
  fieldLookup, filterHasVariables, missingDefaultFields, missingDefaultFieldsMessage, omitExposedJoins,
  openInNewWindowHref, PREVIEW_PAGE_SIZE, previewJoins, removeUnknownCriteria, removedFieldsWarning,
  resolveApiVersion, seedDefaultCriteria, selectTableFirstMessage, toBackendFilter, toColumnsJson,
  visibleColumnNames,
} from './filter-and-columns-utils'
import type { ColumnsState } from './filter-and-columns-utils'
import { parseJsonValue, formatPlainValue, resolveFieldLabel } from './record-widget-utils'
import type { FilterAndColumnsSetupPayload } from './FilterAndColumnsSetupWidget'
import type { WidgetComponentProps, WidgetFormContext } from './widget-types'
import { WidgetHeaderLinkButton } from './WidgetHeaderControls'
import { WidgetSlotHelp } from './WidgetSlotHelp'

interface EditorProps extends WidgetComponentProps<FilterAndColumnsSetupPayload> {
  formContext: WidgetFormContext
  renderSummary: (values: Record<string, unknown>) => React.ReactNode
}

/**
 * A saved list may contain names or full QQueryColumns entries.
 * @param value - Stored column field value.
 * @returns Normalized entries, if parseable.
 */
function storedColumns(value: unknown): Array<{ name: string; isVisible: boolean; width?: number }> | undefined {
  const parsed = parseJsonValue(value)
  if (!parsed.ok || parsed.value === undefined) return undefined
  const source = parsed.value
  const list = Array.isArray(source) ? source : source && typeof source === 'object' && 'columns' in source ? source.columns : null
  if (!Array.isArray(list)) return undefined
  return list.flatMap((entry): Array<{ name: string; isVisible: boolean; width?: number }> => {
    if (typeof entry === 'string') return [{ name: entry, isVisible: true }]
    if (!entry || typeof entry !== 'object' || !('name' in entry) || typeof entry.name !== 'string') return []
    return [{ name: entry.name, isVisible: !('isVisible' in entry) || entry.isVisible !== false,
      ...('width' in entry && typeof entry.width === 'number' ? { width: entry.width } : {}) }]
  })
}

/**
 * Normalizes a stored filter and seeds configured defaults from the form.
 * @param value - Stored filter field value.
 * @param table - Selected table metadata.
 * @param data - Widget configuration.
 * @param values - Current form values.
 * @returns The filter and any removed field names.
 */
function initialFilter(value: unknown, table: QTableMetaData, data: FilterAndColumnsSetupPayload | undefined, values: Record<string, unknown>) {
  const parsed = parseJsonValue(value)
  const normalized = parsed.ok ? normalizeFilter(parsed.value, PREVIEW_PAGE_SIZE) : emptyFilter(PREVIEW_PAGE_SIZE)
  const seeded = seedDefaultCriteria(normalized, data?.filterDefaultFieldNames, values, data?.filterDefaultFieldNameSourceFieldNames)
  return removeUnknownCriteria(table, seeded)
}

/**
 * Queries the first page only; variables suppress requests until resolved.
 * @param root0 - Current query draft and table.
 * @returns The preview table or request state.
 */
export function FilterSetupPreview({ table, filter, columns, api, widgetName }: {
  table: QTableMetaData; filter: QQueryFilter; columns: ColumnsState
  api: ReturnType<typeof resolveApiVersion>; widgetName: string
}) {
  const names = visibleColumnNames(table, columns)
  const joins = previewJoins(table, names, filter)
  const prepared = prepFilterForBackend({ ...filter, skip: 0, limit: PREVIEW_PAGE_SIZE }, fieldLookup(table))
  const hasVariables = filterHasVariables(filter)
  const result = useFilterSetupPreview({ table, api, filter: prepared, joins: joins.joins, includeDistinct: joins.includeDistinct, enabled: !hasVariables })
  if (hasVariables) return <p role="status" className="text-sm text-muted-foreground">Cannot perform query because of a missing value for a variable.</p>
  if (result.isLoading) return <p role="status" className="text-sm text-muted-foreground">Loading preview…</p>
  if (result.error) return <p role="alert" className="text-sm text-destructive">Preview could not be loaded.</p>
  return (
    <div data-qqq-id={`filter-preview-${widgetName}`} className="overflow-x-auto rounded-md border border-border">
      <p className="p-2 text-xs text-muted-foreground">{result.totalCount === null ? `${result.records.length} shown` : `${result.totalCount} matching records`}</p>
      <table className="w-full text-left text-sm">
        <thead><tr>{names.map((name) => <th key={name} scope="col" className="border-b px-3 py-2">{resolveFieldLabel(table, name).label}</th>)}</tr></thead>
        <tbody>{result.records.map((record, index) => (
          <tr key={String(record.values?.[table.primaryKeyField] ?? index)}>
            {names.map((name) => <td key={name} className="border-b px-3 py-2">{formatPlainValue(record.displayValues?.[name] ?? record.values?.[name])}</td>)}
          </tr>
        ))}</tbody>
      </table>
      {result.records.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching records</p>}
    </div>
  )
}

/**
 * The report editor uses the same server-side grid controls as Record Query.
 * @param root0 - Draft report filter, columns, and change callbacks.
 * @returns The paged, sortable preview grid.
 */
function FilterSetupEditorPreview({ table, filter, onFilterChange, columns, onColumnsChange, api, widgetName }: {
  table: QTableMetaData; filter: QQueryFilter; onFilterChange: (filter: QQueryFilter) => void
  columns: ColumnsState; onColumnsChange: (columns: ColumnsState) => void
  api: ReturnType<typeof resolveApiVersion>; widgetName: string
}) {
  const names = visibleColumnNames(table, columns)
  const joins = previewJoins(table, names, filter)
  const queryKey = JSON.stringify({ criteria: filter.criteria, subFilters: filter.subFilters, orderBys: filter.orderBys, names })
  const [pagination, setPagination] = useState<{ key: string; pageNum: number; pageSize: PageSize }>(
    { key: queryKey, pageNum: 1, pageSize: PREVIEW_PAGE_SIZE },
  )
  const pageNum = pagination.key === queryKey ? pagination.pageNum : 1
  const pageSize = pagination.pageSize
  const prepared = prepFilterForBackend({ ...filter, skip: (pageNum - 1) * pageSize, limit: pageSize }, fieldLookup(table))
  const hasVariables = filterHasVariables(filter)
  const result = useFilterSetupPreview({ table, api, filter: prepared, joins: joins.joins, includeDistinct: joins.includeDistinct, enabled: !hasVariables })
  if (hasVariables) return <p role="status" className="text-sm text-muted-foreground">Cannot perform query because of a missing value for a variable.</p>
  if (result.error) return <p role="alert" className="text-sm text-destructive">Preview could not be loaded.</p>
  const totalPages = result.totalCount === null
    ? pageNum + (result.records.length === pageSize ? 1 : 0)
    : Math.max(1, Math.ceil(result.totalCount / pageSize))
  return (
    <div data-qqq-id={`filter-preview-${widgetName}`} className="overflow-hidden rounded-md border border-border">
      <DataGrid tableName={table.name} tableMetaData={table} records={result.records}
        totalCount={result.totalCount ?? result.records.length} isLoading={result.isLoading} isFetching={result.isFetching}
        sortOrder={filter.orderBys ?? []} onSortChange={(orderBys) => onFilterChange({ ...filter, orderBys })}
        rowSelection={{}} onRowSelectionChange={() => {}}
        columnVisibility={columns.columnVisibility} columnOrder={columns.columnOrder} columnWidths={columns.columnWidths}
        onColumnWidthChange={(name, width) => onColumnsChange({ ...columns, columnWidths: { ...columns.columnWidths, [name]: width } })}
        density="standard" pageSize={pageSize} selectable={false} disableRowClick
        scrollResetKey={`${pageNum}:${pageSize}`} />
      <Pagination pageNum={pageNum} pageSize={pageSize} totalCount={result.totalCount}
        pageRowCount={result.records.length} totalPages={totalPages} isFetching={result.isFetching}
        onPageChange={(next) => setPagination({ key: queryKey, pageNum: next, pageSize })}
        onPageSizeChange={(next) => setPagination({ key: queryKey, pageNum: 1, pageSize: next })} />
    </div>
  )
}

/**
 * State mounts when the dialog opens, so Cancel discards every draft change.
 * @param root0 - Widget metadata, current form values and save callback.
 * @returns The dialog content.
 */
function EditorDialog({ table, data, values, widgetMetaData, widgetName, onCancel, onSave, disabled, helpRoles, api, initialTab }: {
  table: QTableMetaData; data: FilterAndColumnsSetupPayload | undefined; values: Record<string, unknown>
  widgetMetaData: QWidgetMetaData
  widgetName: string; onCancel: () => void; onSave: (filter: QQueryFilter, columns: ColumnsState) => void
  disabled: boolean; helpRoles: readonly string[]; api: ReturnType<typeof resolveApiVersion>
  initialTab: 'filters' | 'columns'
}) {
  const filterField = data?.filterFieldName ?? 'queryFilterJson'
  const columnField = data?.columnsFieldName ?? data?.columnFieldName ?? 'columnsJson'
  const loaded = initialFilter(values[filterField], table, data, values)
  const [filter, setFilter] = useState(loaded.filter)
  const [columns, setColumns] = useState(() => columnsStateFromEntries(table, storedColumns(values[columnField])) ?? DEFAULT_COLUMNS_STATE)
  const [tab, setTab] = useState<'filters' | 'columns'>(initialTab)
  const [warning] = useState(removedFieldsWarning(loaded.removed))
  const fields = buildFilterFields(table)
  const sorts = filter.orderBys ?? []
  const changeSort = (index: number, name: string) => setFilter((current) => {
    const orderBys = [...(current.orderBys ?? [])]
    if (!name) orderBys.splice(index, 1)
    else if (index < orderBys.length) orderBys[index] = { ...orderBys[index], fieldName: name }
    else orderBys.push({ fieldName: name, isAscending: true })
    return { ...current, orderBys }
  })
  const addSort = () => {
    const field = fields.find(({ name }) => !sorts.some((sort) => sort.fieldName === name))
    if (field) changeSort(sorts.length, field.name)
  }
  const backend = toBackendFilter(table, filter)
  return (
    <>
      <div className="flex items-start justify-between border-b border-border p-4">
        <div><DialogPrimitive.Title className="text-lg font-semibold">{editorHeading(Boolean(data?.hideColumns), data?.modalHeader)}</DialogPrimitive.Title>
          <WidgetSlotHelp widgetMetaData={widgetMetaData} slot="modalSubheader" roles={helpRoles} /></div>
        <DialogPrimitive.Close type="button" aria-label="Close editor" className="rounded p-2 text-muted-foreground focus:ring-2 focus:ring-ring">×</DialogPrimitive.Close>
      </div>
      {warning && <p role="status" className="mx-4 mt-3 rounded bg-amber-100 p-2 text-sm text-amber-900">{warning}</p>}
      <div className="flex gap-2 border-b border-border px-4 pt-3" role="tablist" aria-label="Report setup">
        <button type="button" role="tab" aria-selected={tab === 'filters'} onClick={() => setTab('filters')} className="rounded-t px-3 py-2 data-[selected=true]:bg-muted" data-selected={tab === 'filters'}>Filters and sort</button>
        {!data?.hideColumns && <button type="button" role="tab" aria-selected={tab === 'columns'} onClick={() => setTab('columns')} className="rounded-t px-3 py-2 data-[selected=true]:bg-muted" data-selected={tab === 'columns'}>Columns</button>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'filters' ? <>
          <FilterBuilder tableMetaData={table} filter={filter} onChange={setFilter} allowVariables={data?.allowVariables} />
          {!data?.hideSortBy && <div className="space-y-2 border-t border-border pt-3">
            {(sorts.length ? sorts : [undefined]).map((sort, index) => (
              <div key={index} className="flex flex-wrap items-center gap-3">
                <label htmlFor={`report-sort-${widgetName}-${index}`} className="text-sm font-medium">{index === 0 ? 'Sort by' : `Then by ${index + 1}`}</label>
                <select id={`report-sort-${widgetName}-${index}`} value={sort?.fieldName ?? ''} onChange={(event) => changeSort(index, event.target.value)} className="rounded border border-input bg-background p-2 text-sm">
                  <option value="">No sort</option>{fields.filter((field) => field.name === sort?.fieldName || !sorts.some((used) => used.fieldName === field.name))
                    .map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
                </select>
                {sort && <>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sort.isAscending !== false}
                    onChange={(event) => setFilter((current) => ({ ...current, orderBys: (current.orderBys ?? []).map((entry, at) =>
                      at === index ? { ...entry, isAscending: event.target.checked } : entry) }))} />Ascending</label>
                  <button type="button" onClick={() => changeSort(index, '')} className="rounded px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
                    aria-label={`Remove sort ${index + 1}`}>Remove</button>
                </>}
              </div>
            ))}
            {sorts.length > 0 && sorts.length < fields.length && <button type="button" onClick={addSort}
              className="rounded px-2 py-2 text-sm text-primary hover:underline" data-qqq-id={`filter-editor-add-sort-${widgetName}`}>+ Add sort</button>}
          </div>}
        </> : <ColumnConfig tableMetaData={table} columnVisibility={columns.columnVisibility} columnOrder={columns.columnOrder}
          onVisibilityChange={(visibility) => setColumns((current) => ({ ...current, columnVisibility: visibility }))}
          onOrderChange={(order) => setColumns((current) => ({ ...current, columnOrder: order }))} embedded />}
        {!data?.hidePreview && <section className="mt-5 space-y-2"><h3 className="text-sm font-semibold">Preview</h3><FilterSetupEditorPreview table={table} filter={filter} onFilterChange={setFilter}
          columns={columns} onColumnsChange={setColumns} api={api} widgetName={widgetName} /></section>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
        <a href={openInNewWindowHref(table.name, backend)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Open in new window</a>
        <div className="flex gap-2"><button type="button" onClick={onCancel} className="rounded border border-border px-4 py-2 text-sm">Cancel</button>
          <button type="button" disabled={disabled} onClick={() => onSave(filter, columns)} data-qqq-id={`filter-editor-save-${widgetName}`} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">OK</button></div>
      </div>
    </>
  )
}

/**
 * Connects the editor to the hosting form's live values.
 * @param root0 - Widget metadata, payload and form context.
 * @returns The summary, edit control and dialog.
 */
export function FilterAndColumnsSetupEditor({ widgetMetaData, data, formContext, renderSummary }: EditorProps) {
  const { values, disabled = false, setValues } = formContext
  const tableName = data?.tableName || (typeof values.tableName === 'string' ? values.tableName : undefined)
  const api = resolveApiVersion(data, values)
  const plain = useTableMetaData(data?.isApiVersioned ? undefined : tableName)
  const versioned = useApiTableMetaData(data?.isApiVersioned ? api : undefined, tableName)
  const table = data?.isApiVersioned ? versioned.data : plain.data
  const [open, setOpen] = useState(false)
  const [initialTab, setInitialTab] = useState<'filters' | 'columns'>('filters')
  const [alert, setAlert] = useState('')
  const restoreFocus = useRestoreFocus(open)
  const name = widgetMetaData.name
  const helpRoles = formContext.screen === 'recordCreate' ? INSERT_SCREEN_HELP_ROLES : EDIT_SCREEN_HELP_ROLES
  const reason = !table || (data?.isApiVersioned && !api) ? selectTableFirstMessage(Boolean(data?.isApiVersioned), Boolean(data?.hideColumns)) : null
  const openEditor = (tab: 'filters' | 'columns' = 'filters') => {
    if (!table || disabled) return
    const missing = missingDefaultFields(data?.filterDefaultFieldNames, values, data?.filterDefaultFieldNameSourceFieldNames)
    if (missing.length) {
      setAlert(missingDefaultFieldsMessage(missing.map((field) => resolveFieldLabel(table, field).label)))
      return
    }
    setAlert('')
    setInitialTab(tab)
    setOpen(true)
  }
  const save = (filter: QQueryFilter, columns: ColumnsState) => {
    if (!table) return
    const filterField = data?.filterFieldName ?? 'queryFilterJson'
    const columnField = data?.columnsFieldName ?? data?.columnFieldName ?? 'columnsJson'
    setValues({ [filterField]: JSON.stringify(toBackendFilter(table, filter)),
      ...(!data?.hideColumns ? { [columnField]: JSON.stringify(toColumnsJson(table, columns)) } : {}) })
    setOpen(false)
  }
  const filterField = data?.filterFieldName ?? 'queryFilterJson'
  const columnField = data?.columnsFieldName ?? data?.columnFieldName ?? 'columnsJson'
  const configuredFilter = table ? initialFilter(values[filterField], table, data, values).filter : null
  const hasFilters = Boolean(configuredFilter?.criteria.length || configuredFilter?.subFilters?.length)
  const hasColumns = Boolean(storedColumns(values[columnField])?.some((column) => column.isVisible))
  return (
    <div className="space-y-2" data-qqq-id={`widget-filterAndColumnsSetup-${name}`}>
      <div className="flex flex-wrap justify-end gap-2">
        {!hasFilters && <WidgetHeaderLinkButton label="+ Add Filters" onClick={() => openEditor('filters')}
          disabled={disabled || Boolean(reason)} disabledTooltip={reason} qqqId={`filter-add-button-${name}`} />}
        {!data?.hideColumns && !hasColumns && <WidgetHeaderLinkButton label="+ Add Columns" onClick={() => openEditor('columns')}
          disabled={disabled || Boolean(reason)} disabledTooltip={reason} qqqId={`columns-add-button-${name}`} />}
        <WidgetHeaderLinkButton label={editButtonLabel(Boolean(data?.hideColumns), data?.editButtonLabel)}
          onClick={() => openEditor()} disabled={disabled || Boolean(reason)} disabledTooltip={reason} qqqId={`filter-edit-button-${name}`} />
      </div>
      {alert && <p role="alert" className="rounded bg-destructive/10 p-2 text-sm text-destructive">{alert}</p>}
      {renderSummary(values)}
      {table && <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) setOpen(false) }}>
        <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content aria-describedby={undefined} onCloseAutoFocus={restoreFocus} onInteractOutside={(event) => event.preventDefault()}
            data-qqq-id={`filter-editor-${name}`} className="fixed inset-2 z-50 flex flex-col rounded-lg border border-border bg-card shadow-lg focus:outline-none sm:inset-8">
            <EditorDialog table={omitExposedJoins(table, data?.omitExposedJoins)} data={data} values={values} widgetMetaData={widgetMetaData} widgetName={name}
              initialTab={initialTab}
              onCancel={() => setOpen(false)} onSave={save} disabled={disabled} helpRoles={helpRoles} api={api} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>}
    </div>
  )
}
