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

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Columns, RefreshCw } from 'lucide-react'

import type { QQueryFilter, QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import { useMetaData, useTableMetaData } from '@/lib/hooks/use-metadata'
import type { Density, PageSize } from '@/lib/hooks/use-record-query'
import { queryApiRecords } from '@/lib/api/api-versioned'
import { queryRecords, type TableVariant } from '@/lib/api/tables'
import { DEFAULT_COPY_FULL_QUERY_VALUES_LIMIT } from '@/lib/constants'
import { arrangePinnedColumns, effectivePins, getQueryColumns, hasCapability, orderColumns, pinColumn } from '@/lib/utils/query-columns'
import { ColumnStatsDialog, COLUMN_STATS_PROCESS } from '@/components/query/ColumnStatsDialog'
import { FilterSettingsProvider, filterSettingsFrom } from '@/lib/context/filter-settings-context'
import { useQContext } from '@/lib/context/q-context'
import { useSavedViews } from '@/lib/hooks/use-saved-views'
import { canFilterWorkAsBasic, getDefaultQuickFilterFieldNames } from '@/lib/utils/quick-filter-utils'
import type { SavedView } from '@/lib/utils/saved-view-utils'
import { QuickFilterBar } from '@/components/query/QuickFilterBar'
import { SavedViewsMenu } from '@/components/query/SavedViewsMenu'
import { DensitySelector } from '@/components/query/RecordQueryToolbar'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { useApiTableMetaData, useFilterSetupPreview } from '@/lib/hooks/use-filter-setup'
import { emptyFilter, isCriterionComplete, normalizeFilter, prepFilterForBackend } from '@/lib/utils/filter-utils'
import { EDIT_SCREEN_HELP_ROLES, INSERT_SCREEN_HELP_ROLES } from '@/lib/utils/help-utils'
import { ColumnConfig } from '@/components/query/ColumnConfig'
import { DataGrid } from '@/components/query/DataGrid'
import { FilterBuilder, buildFilterFields } from '@/components/query/FilterBuilder'
import { Pagination } from '@/components/query/Pagination'
import { VariantPicker } from '@/components/query/VariantPicker'
import { readStoredTableVariant, TABLE_VARIANT_STORAGE_KEY_ROOT } from '@/lib/utils/table-variant'
import {
  columnsStateFromEntries, DEFAULT_COLUMNS_STATE, editButtonLabel, editorHeading,
  fieldLookup, filterHasVariables, missingDefaultFields, missingDefaultFieldsMessage, omitExposedJoins,
  openInNewWindowHref, PREVIEW_PAGE_SIZE, previewJoins, removeUnknownCriteria, removedFieldsWarning,
  resolveApiVersion, seedDefaultCriteria, selectTableFirstMessage, toBackendFilter, toColumnsJson,
  visibleColumnNames,
} from './filter-and-columns-utils'
import type { ColumnsState } from './filter-and-columns-utils'
import { parseJsonValue, resolveFieldLabel } from './record-widget-utils'
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
function storedColumns(value: unknown): Array<{ name: string; isVisible: boolean; width?: number; pinned?: 'left' | 'right' }> | undefined {
  const parsed = parseJsonValue(value)
  if (!parsed.ok || parsed.value === undefined) return undefined
  const source = parsed.value
  const list = Array.isArray(source) ? source : source && typeof source === 'object' && 'columns' in source ? source.columns : null
  if (!Array.isArray(list)) return undefined
  return list.flatMap((entry): Array<{ name: string; isVisible: boolean; width?: number; pinned?: 'left' | 'right' }> => {
    if (typeof entry === 'string') return [{ name: entry, isVisible: true }]
    if (!entry || typeof entry !== 'object' || !('name' in entry) || typeof entry.name !== 'string') return []
    return [{ name: entry.name, isVisible: !('isVisible' in entry) || entry.isVisible !== false,
      ...('pinned' in entry && (entry.pinned === 'left' || entry.pinned === 'right') ? { pinned: entry.pinned } : {}),
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

interface PreviewProps {
  table: QTableMetaData
  filter: QQueryFilter
  columns: ColumnsState
  api: ReturnType<typeof resolveApiVersion>
  widgetName: string
  hideColumns?: boolean
  /** Joined tables omitted from field choices; saved preview data remains intact. */
  omittedJoins?: string[]
}

/**
 * A read-only report preview with temporary paging, sorting and column sizing.
 * @param props - Saved report configuration and table metadata.
 * @returns The shared grid, reset when the saved configuration changes.
 */
export function FilterSetupPreview(props: PreviewProps) {
  const key = JSON.stringify([props.table.name, props.api, props.filter, props.columns])
  return <LocalFilterSetupPreview key={key} {...props} />
}

/**
 * Keeps preview interactions local so they never write to the saved report.
 * @param props - Initial saved configuration.
 * @returns The paged preview grid.
 */
function LocalFilterSetupPreview({ filter, columns, ...props }: PreviewProps) {
  const [previewFilter, setPreviewFilter] = useState(filter)
  const [previewColumns, setPreviewColumns] = useState(columns)
  return <FilterSetupGrid {...props} filter={previewFilter} onFilterChange={setPreviewFilter}
    columns={previewColumns} onColumnsChange={setPreviewColumns} />
}

/** Shared report preview metadata, draft state and editor callbacks. */
interface FilterSetupGridProps {
  table: QTableMetaData; filter: QQueryFilter; onFilterChange: (filter: QQueryFilter) => void
  columns: ColumnsState; onColumnsChange: (columns: ColumnsState) => void
  api: ReturnType<typeof resolveApiVersion>; widgetName: string; editable?: boolean; onEditFilter?: () => void; hideColumns?: boolean; omittedJoins?: string[]
}

/**
 * Scopes preview controls and cached records to the user's selected backend variant.
 * @param props - Report preview metadata and draft state.
 * @returns The variant selector and scoped grid.
 */
function FilterSetupGrid(props: FilterSetupGridProps) {
  const { table, widgetName } = props
  const [variant, setVariant] = useState<TableVariant | null>(() => table.usesVariants ? readStoredTableVariant(table.name) : null)
  const [pickerOpen, setPickerOpen] = useState(() => Boolean(table.usesVariants) && !readStoredTableVariant(table.name))
  const label = table.variantTableLabel ?? 'Variant'
  const chooseVariant = (selected: TableVariant) => {
    try { localStorage.setItem(`${TABLE_VARIANT_STORAGE_KEY_ROOT}.${table.name}`, JSON.stringify(selected)) } catch { /* Persistence is best-effort. */ }
    setVariant(selected)
    setPickerOpen(false)
  }
  return <>
    {table.usesVariants && <div className="mb-2 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setPickerOpen(true)} data-qqq-id={`filter-preview-variant-${widgetName}`}
        className="min-h-11 rounded border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
        {label}: {variant?.name ?? variant?.id ?? 'Select…'}
      </button>
      {!variant && <p role="status" data-qqq-id={`filter-preview-needs-variant-${widgetName}`} className="text-sm text-muted-foreground">Select a {label} to preview {table.label} records.</p>}
      <VariantPicker open={pickerOpen} tableName={table.name} variantTableLabel={label} selected={variant}
        onSelect={chooseVariant} onCancel={() => setPickerOpen(false)} />
    </div>}
    {(!table.usesVariants || variant) && <VariantFilterSetupGrid key={variant ? JSON.stringify([variant.type, variant.id]) : 'default'} {...props} tableVariant={variant} />}
  </>
}

/**
 * Keeps paging, copy and statistics within one selected backend variant.
 * @param props - Preview configuration and selected variant.
 * @returns The paged report grid.
 */
function VariantFilterSetupGrid({ table, filter, onFilterChange, columns, onColumnsChange, api, widgetName, editable = false, onEditFilter, hideColumns = false, omittedJoins, tableVariant }: FilterSetupGridProps & { tableVariant: TableVariant | null }) {
  const [density, setDensity] = useState<Density>('standard')
  const [showColumns, setShowColumns] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [notice, setNotice] = useState('')
  const [statsColumn, setStatsColumn] = useState<{ name: string; label: string } | null>(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const { data: metaData } = useMetaData()
  const statsProcess = metaData?.processes?.[COLUMN_STATS_PROCESS]
  const canShowStats = hasCapability(table, 'QUERY_STATS') && Boolean(statsProcess) && statsProcess?.hasPermission !== false
  const filteredColumns = useMemo(() => {
    const names = new Set<string>()
    const visit = (group: QQueryFilter) => {
      for (const criterion of group.criteria ?? []) if (isCriterionComplete(criterion)) names.add(criterion.fieldName)
      for (const child of group.subFilters ?? []) visit(child)
    }
    visit(filter)
    return names
  }, [filter])
  const showExistingFilter = () => {
    if (onEditFilter) onEditFilter()
    else setShowFilter(true)
  }
  const selectionTable = useMemo(() => omitExposedJoins(table, omittedJoins), [table, omittedJoins])
  const queryColumns = getQueryColumns(table)
  const changeColumnOrder = (columnOrder: string[]) => {
    const selectable = new Set(columnOrder)
    const current = arrangePinnedColumns(orderColumns(queryColumns, columns.columnOrder),
      effectivePins(queryColumns.map((column) => column.name), columns.columnPins ?? null, table.primaryKeyField))
    let next = 0
    onColumnsChange({ ...columns, columnOrder: current.map((column) => selectable.has(column.name) ? columnOrder[next++] : column.name) })
  }
  const names = visibleColumnNames(table, columns)
  const joins = previewJoins(table, names, filter)
  const queryKey = JSON.stringify({ booleanOperator: filter.booleanOperator, criteria: filter.criteria, subFilters: filter.subFilters, orderBys: filter.orderBys, names })
  const [pagination, setPagination] = useState<{ key: string; pageNum: number; pageSize: PageSize }>(
    { key: queryKey, pageNum: 1, pageSize: PREVIEW_PAGE_SIZE },
  )
  const pageNum = pagination.key === queryKey ? pagination.pageNum : 1
  const pageSize = pagination.pageSize
  const prepared = prepFilterForBackend({ ...filter, skip: (pageNum - 1) * pageSize, limit: pageSize }, fieldLookup(table))
  const hasVariables = filterHasVariables(filter)
  const result = useFilterSetupPreview({ table, api, tableVariant, filter: prepared, joins: joins.joins, includeDistinct: joins.includeDistinct, enabled: !hasVariables })
  const copyValues = async (name: string, all: boolean) => {
    const label = queryColumns.find((column) => column.name === name)?.label ?? name
    const textValues = (records: QRecord[]) => records.map((record) => String(record.displayValues?.[name] ?? record.values[name] ?? ''))
    const settings = metaData?.supplementalInstanceMetaData?.materialDashboard
    const configuredLimit = settings && typeof settings === 'object' && 'queryScreenCopyFullQueryColumnValuesLimit' in settings
      ? settings.queryScreenCopyFullQueryColumnValuesLimit : undefined
    const limit = typeof configuredLimit === 'number' && configuredLimit > 0 ? configuredLimit : DEFAULT_COPY_FULL_QUERY_VALUES_LIMIT
    try {
      let values = textValues(result.records)
      if (all) {
        if (result.totalCount !== null && result.totalCount > limit) throw new Error(`The current query contains too many rows to copy (limit: ${limit.toLocaleString()}).`)
        values = []
        // One extra row distinguishes an exact-limit result from a truncated query without a count.
        while (active.current && values.length <= limit) {
          const length = Math.min(250, limit + 1 - values.length)
          const request = { filter: { ...prepared, skip: values.length, limit: length }, joins: joins.joins, ...(tableVariant ? { tableVariant } : {}) }
          const page = await (api ? queryApiRecords(api, table.name, request) : queryRecords(table.name, request))
          values.push(...textValues(page.records))
          if (page.records.length < length) break
        }
        if (values.length > limit) throw new Error(`The current query contains too many rows to copy (limit: ${limit.toLocaleString()}).`)
      }
      if (!active.current) return
      await navigator.clipboard.writeText(`${values.join('\n')}\n`)
      if (active.current) setNotice(`Copied ${values.length.toLocaleString()} ${label} values.`)
    } catch (error) {
      if (active.current) setNotice(error instanceof Error ? error.message : `Could not copy ${label} values.`)
    }
  }
  const columnMenu = {
    onFilter: (name: string) => {
      onFilterChange({ ...filter, criteria: [...filter.criteria, { fieldName: name, operator: 'EQUALS', values: [] }] })
      showExistingFilter()
    },
    onHide: (name: string) => onColumnsChange({ ...columns, columnVisibility: { ...columns.columnVisibility, [name]: false } }),
    onPin: (name: string, side: 'left' | 'right' | null) => onColumnsChange({ ...columns,
      columnPins: pinColumn(queryColumns.map((column) => column.name), columns.columnPins ?? null, name, side, table.primaryKeyField) }),
    onCopyPageValues: (name: string) => { void copyValues(name, false) },
    onCopyFullQueryValues: (name: string) => { void copyValues(name, true) },
  }
  if (hasVariables) return <p role="status" className="text-sm text-muted-foreground">Cannot perform query because of a missing value for a variable.</p>
  const totalPages = result.totalCount === null
    ? pageNum + (result.records.length === pageSize ? 1 : 0)
    : Math.max(1, Math.ceil(result.totalCount / pageSize))
  return (
    <div data-qqq-id={`filter-preview-${widgetName}`} className="overflow-hidden rounded-md border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
        <button type="button" onClick={result.refresh} disabled={result.isFetching} aria-label="Refresh preview"
          data-qqq-id={`filter-preview-refresh-${widgetName}`} className="flex min-h-11 min-w-11 items-center justify-center rounded border border-input bg-background text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${result.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
        {!hideColumns && <button type="button" onClick={() => setShowColumns(!showColumns)} aria-expanded={showColumns}
          aria-label="Configure preview columns" data-qqq-id={`filter-preview-columns-${widgetName}`}
          className="flex min-h-11 min-w-11 items-center justify-center rounded border border-input bg-background text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
          <Columns className="h-4 w-4" aria-hidden="true" />
        </button>}
        {editable ? <DensitySelector density={density} onSelect={setDensity} /> :
          <a href={openInNewWindowHref(table.name, toBackendFilter(table, filter))} target="_blank" rel="noopener noreferrer"
            data-qqq-id={`filter-preview-open-${widgetName}`} className="inline-flex min-h-11 items-center text-sm text-primary underline">Open in new window</a>}
      </div>
      {showColumns && !hideColumns && <div className="border-b border-border p-3"><ColumnConfig tableMetaData={selectionTable}
        columnVisibility={columns.columnVisibility} columnOrder={columns.columnOrder}
        onVisibilityChange={(columnVisibility) => onColumnsChange({ ...columns, columnVisibility })}
        onOrderChange={changeColumnOrder} embedded /></div>}
      {showFilter && <div className="border-b border-border p-3"><FilterSettingsProvider value={filterSettingsFrom(metaData)}><FilterBuilder tableMetaData={table} omittedJoinTables={omittedJoins} filter={filter} onChange={onFilterChange} /></FilterSettingsProvider></div>}
      {notice && <p role="status" className="p-3 text-sm" data-qqq-id={`filter-preview-notice-${widgetName}`}>{notice}</p>}
      {result.error && <p role="alert" className="p-3 text-sm text-destructive">Preview could not be loaded. Use Refresh preview to try again.</p>}
      <DataGrid tableName={table.name} tableMetaData={table} records={result.records}
        totalCount={result.totalCount ?? result.records.length} isLoading={result.isLoading} isFetching={result.isFetching}
        sortOrder={filter.orderBys ?? []} onSortChange={(orderBys) => onFilterChange({ ...filter, orderBys })}
        rowSelection={{}} onRowSelectionChange={() => {}}
        columnVisibility={columns.columnVisibility} columnOrder={columns.columnOrder} columnWidths={columns.columnWidths}
        onColumnWidthChange={(name, width) => onColumnsChange({ ...columns, columnWidths: { ...columns.columnWidths, [name]: width } })}
        columnPins={columns.columnPins ?? null} columnMenu={columnMenu}
        filteredColumns={filteredColumns} onShowFilter={showExistingFilter}
        onColumnStats={canShowStats ? (name, label) => setStatsColumn({ name, label }) : undefined}
        density={density} pageSize={pageSize} selectable={false} disableRowClick
        scrollResetKey={`${pageNum}:${pageSize}`} />
      {statsColumn && <ColumnStatsDialog tableName={table.name} tableLabel={table.label} fieldName={statsColumn.name}
        fieldLabel={statsColumn.label} fieldType={queryColumns.find((column) => column.name === statsColumn.name)?.field.type}
        filter={prepared} tableVariant={tableVariant} onClose={() => setStatsColumn(null)} />}
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
  const tabId = React.useId()
  const tabs: { key: 'filters' | 'columns'; label: string }[] = [
    { key: 'filters', label: 'Filters and sort' },
    ...(!data?.hideColumns ? [{ key: 'columns' as const, label: 'Columns' }] : []),
  ]
  /**
   * Activates and focuses the adjacent tab, keeping one tab stop in the list.
   * @param event - Keyboard event from a report tab.
   * @param index - Index of the focused tab.
   */
  function handleTabKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | undefined
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next === undefined) return
    event.preventDefault()
    setTab(tabs[next].key)
    document.getElementById(`${tabId}-${tabs[next].key}`)?.focus()
  }
  const [warning] = useState(removedFieldsWarning(loaded.removed))
  const [mode, setMode] = useState<'basic' | 'advanced'>('advanced')
  const [quickFields, setQuickFields] = useState<string[]>([])
  const [selectedView, setSelectedView] = useState<SavedView | null>(null)
  const [viewRevision, setViewRevision] = useState(0)
  const { data: metaData } = useMetaData()
  const { userId } = useQContext()
  const savedViews = useSavedViews(table.name, metaData, userId)
  const fields = buildFilterFields(table)
  const defaults = getDefaultQuickFilterFieldNames(table)
  const basicCheck = canFilterWorkAsBasic(table, filter)
  const quickNames = [...new Set([...defaults, ...quickFields, ...filter.criteria.map((criterion) => criterion.fieldName)])]
  const selectView = (view: SavedView) => {
    const cleaned = removeUnknownCriteria(table, normalizeFilter(view.view.queryFilter, PREVIEW_PAGE_SIZE))
    setFilter(cleaned.filter)
    if (!data?.hideColumns) setColumns(columnsStateFromEntries(table, view.view.queryColumns?.columns) ?? DEFAULT_COLUMNS_STATE)
    setQuickFields(view.view.quickFilterFieldNames ?? [])
    setMode(view.view.mode === 'basic' && canFilterWorkAsBasic(table, cleaned.filter).canWorkAsBasic ? 'basic' : 'advanced')
    setSelectedView(view)
    setViewRevision((revision) => revision + 1)
  }
  const newView = () => {
    setFilter({ ...emptyFilter(PREVIEW_PAGE_SIZE), orderBys: table.primaryKeyField ? [{ fieldName: table.primaryKeyField, isAscending: false }] : [] })
    if (!data?.hideColumns) setColumns(DEFAULT_COLUMNS_STATE)
    setQuickFields([])
    setMode('basic')
    setSelectedView(null)
    setViewRevision((revision) => revision + 1)
  }
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
    <FilterSettingsProvider value={filterSettingsFrom(metaData)}>
      <div className="flex items-start justify-between border-b border-border p-4">
        <div><DialogPrimitive.Title className="text-lg font-semibold">{editorHeading(Boolean(data?.hideColumns), data?.modalHeader)}</DialogPrimitive.Title>
          <WidgetSlotHelp widgetMetaData={widgetMetaData} slot="modalSubheader" roles={helpRoles} /></div>
        <DialogPrimitive.Close type="button" aria-label="Close editor" className="rounded p-2 text-muted-foreground focus:ring-2 focus:ring-ring">×</DialogPrimitive.Close>
      </div>
      {warning && <p role="status" className="mx-4 mt-3 rounded bg-amber-100 p-2 text-sm text-amber-900">{warning}</p>}
      <div className="flex gap-2 border-b border-border px-4 pt-3" role="tablist" aria-label="Report setup">
        {tabs.map((item, index) => <button key={item.key} type="button" role="tab"
          id={`${tabId}-${item.key}`} aria-controls={`${tabId}-panel`} aria-selected={tab === item.key}
          tabIndex={tab === item.key ? 0 : -1} onClick={() => setTab(item.key)} onKeyDown={(event) => handleTabKey(event, index)}
          data-qqq-id={`filter-editor-tab-${widgetName}-${item.key}`}
          className="rounded-t px-3 py-2 data-[selected=true]:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-selected={tab === item.key}>
          {item.label}
        </button>)}
      </div>
      <div id={`${tabId}-panel`} role="tabpanel" tabIndex={-1} aria-labelledby={`${tabId}-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'filters' ? <>
          <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter mode">
            <button type="button" aria-pressed={mode === 'basic'} disabled={!basicCheck.canWorkAsBasic} title={basicCheck.reasons.join(' ')}
              onClick={() => setMode('basic')} data-qqq-id={`filter-editor-basic-${widgetName}`}
              className="min-h-11 rounded border border-input px-3 py-1.5 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring">Basic</button>
            <button type="button" aria-pressed={mode === 'advanced'} onClick={() => setMode('advanced')} data-qqq-id={`filter-editor-advanced-${widgetName}`}
              className="min-h-11 rounded border border-input px-3 py-1.5 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring">Advanced</button>
            <SavedViewsMenu selectionOnly savedViews={savedViews} currentView={selectedView} viewDiffs={[]} onSelectView={selectView} />
            {selectedView && <>
              <button type="button" onClick={() => selectView(selectedView)} data-qqq-id={`filter-editor-reset-view-${widgetName}`}
                className="min-h-11 text-sm text-muted-foreground underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring">Reset Changes</button>
              <button type="button" onClick={newView} data-qqq-id={`filter-editor-new-view-${widgetName}`}
                className="min-h-11 text-sm text-muted-foreground underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring">Reset to New View</button>
            </>}
          </div>
          {mode === 'basic' ? <QuickFilterBar key={viewRevision} fields={fields.filter((field) => quickNames.includes(field.name))} allFields={fields}
            defaultFieldNames={defaults} customFieldNames={quickNames.filter((name) => !defaults.includes(name))}
            filter={filter} onChange={setFilter} onCustomFieldsChange={setQuickFields} onOpenAdvanced={() => setMode('advanced')} /> :
            <FilterBuilder tableMetaData={table} filter={filter} onChange={setFilter} allowVariables={data?.allowVariables} />}
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
        {!data?.hidePreview && <section className="mt-5 space-y-2"><h3 className="text-sm font-semibold">Preview</h3><FilterSetupGrid table={table} filter={filter} onFilterChange={setFilter}
          columns={columns} onColumnsChange={setColumns} api={api} widgetName={widgetName} editable hideColumns={data?.hideColumns} onEditFilter={() => { setTab('filters'); setMode('advanced') }} /></section>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
        <a href={openInNewWindowHref(table.name, backend)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Open in new window</a>
        <div className="flex gap-2"><button type="button" onClick={onCancel} className="rounded border border-border px-4 py-2 text-sm">Cancel</button>
          <button type="button" disabled={disabled} onClick={() => onSave(filter, columns)} data-qqq-id={`filter-editor-save-${widgetName}`} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">OK</button></div>
      </div>
    </FilterSettingsProvider>
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
  const selection = JSON.stringify([tableName, api])
  const previousSelection = useRef(selection)
  useEffect(() => {
    if (!table || table.name !== tableName || previousSelection.current === selection) return
    previousSelection.current = selection
    const cleaned = initialFilter(values[filterField], table, data, values).filter
    const columns = columnsStateFromEntries(table, storedColumns(values[columnField])) ?? DEFAULT_COLUMNS_STATE
    setValues({
      [filterField]: JSON.stringify(toBackendFilter(table, cleaned)),
      ...(!data?.hideColumns ? { [columnField]: JSON.stringify(toColumnsJson(table, columns)) } : {}),
    })
    setOpen(false)
    setAlert('Filters and columns now use the selected table.')
  }, [selection, table, tableName, values, filterField, columnField, data, setValues])
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
