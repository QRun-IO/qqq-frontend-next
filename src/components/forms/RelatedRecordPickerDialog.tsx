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
 * @file RelatedRecordPickerDialog — the metadata-driven related-record picker (QQQ
 * `docs/RELATED-RECORD-PICKER.md`), in the same dialog family as the media picker
 * ({@link PickerDialogFrame}). One component serves the three modes of a table's
 * `relatedRecordPickers`:
 *
 * - `SINGLE`: choose one target record for a foreign-key field (or quick-create one);
 * - `MULTI_CHILD`: pick many targets, review one new child row per pick, then add them;
 * - `LINK`: check to link and uncheck to unlink targets through a join table.
 *
 * The target table's own filter builder and saved views, search, sorting, Load more and a preview
 * pane drive the results; every read and write goes through the picker's v1 routes, which apply
 * the picker filter, permissions, record locks and audit. Loaded on demand (`import()`).
 */

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, ExternalLink, Filter, Loader2, Plus, Search } from 'lucide-react'

import type { QFieldMetaData, QQueryFilter, QRecord, QRelatedRecordPicker, QTableMetaData } from '@/types'
import { addRelatedPicker, prepareRelatedPicker, queryRelatedPicker, removeRelatedPicker } from '@/lib/api/related-record-picker'
import { insertRecord } from '@/lib/api/tables'
import { useMetaData, useTableMetaData } from '@/lib/hooks/use-metadata'
import { useSavedViews } from '@/lib/hooks/use-saved-views'
import { useQContext } from '@/lib/context/q-context'
import { cn } from '@/lib/utils/cn'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { emptyFilter } from '@/lib/utils/filter-utils'
import { pickerRecordPath } from '@/lib/utils/record-picker'
import { quickCreateFields, recordText, relatedPickerColumns, relatedPickerPreviewFields } from '@/lib/utils/related-record-picker'
import { ALERT_CLASS, buttonClass, INPUT_CLASS, LABEL_CLASS, SELECT_CLASS } from '@/components/ui/controls'

import { DynamicFormField } from './DynamicFormField'
import { FilterBuilder } from '@/components/query/FilterBuilder'
import { PickerDialogClose, PickerDialogFrame } from './PickerDialogFrame'

/** Search debounce, in milliseconds. */
const SEARCH_DEBOUNCE_MS = 300
/** Records per page. */
const PAGE_SIZE = 50

/** What confirming the dialog did, for the opener's status message. */
export interface RelatedPickerResult {
  /** Rows added (MULTI_CHILD, LINK). */
  added: number
  /** Links removed (LINK). */
  removed: number
}

/** Props for {@link RelatedRecordPickerDialog}. */
export interface RelatedRecordPickerDialogProps {
  /** The table that declares the picker. */
  tableName: string
  /** The picker, from the table's metadata. */
  picker: QRelatedRecordPicker
  /** The parent record (MULTI_CHILD, LINK). */
  primaryKey?: string | number
  /** The form's current values (SINGLE), for the picker's `${input.x}` variables. */
  formValues?: Record<string, unknown>
  /** The current value (SINGLE). */
  selectedId?: string | number | null
  /** SINGLE: called with the chosen (or quick-created) record and its primary key. */
  onSelect?: (record: QRecord, id: string | number) => void
  /** MULTI_CHILD, LINK: called after rows were added or removed. */
  onDone?: (result: RelatedPickerResult) => void
  /** Called when the dialog closes without a change. */
  onClose: () => void
}

type Step = 'browse' | 'create' | 'review'

/**
 * The related-record picker dialog.
 *
 * @param props - See {@link RelatedRecordPickerDialogProps}.
 * @returns The dialog.
 */
export function RelatedRecordPickerDialog({ tableName, picker, primaryKey, formValues, selectedId, onSelect, onDone, onClose }: RelatedRecordPickerDialogProps) {
  const multiple = picker.mode !== 'SINGLE'
  const { data: target } = useTableMetaData(picker.targetTableName)
  const { data: child } = useTableMetaData(picker.childTableName)
  const { data: instance } = useMetaData()
  const { userId } = useQContext()
  const savedViews = useSavedViews(picker.targetTableName, instance, userId)

  const [step, setStep] = useState<Step>('browse')
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [filter, setFilter] = useState<QQueryFilter>(() => emptyFilter(PAGE_SIZE))
  const [filterReady, setFilterReady] = useState(!picker.defaultFilter)
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState('')
  const [records, setRecords] = useState<QRecord[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [linked, setLinked] = useState<Set<string>>(new Set())
  const [active, setActive] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Map<string, QRecord>>(new Map())
  const [unlinked, setUnlinked] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<QRecord[]>([])
  const [reviewFields, setReviewFields] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const rowValues = useRef<Array<Record<string, unknown>>>([])
  const sequence = useRef(0)
  const listRef = useRef<HTMLUListElement>(null)

  const pk = target?.primaryKeyField ?? 'id'
  const idOf = useCallback((record: QRecord) => String(record.values?.[pk] ?? ''), [pk])
  const rawId = (record: QRecord) => (record.values?.[pk] as string | number | undefined) ?? idOf(record)
  const columns = useMemo(() => relatedPickerColumns(picker, target), [picker, target])
  const previewFields = useMemo(() => relatedPickerPreviewFields(picker, target), [picker, target])
  const filterTable = useMemo<QTableMetaData | undefined>(() => target ? { ...target, exposedJoins: [] } : undefined, [target])
  const views = useMemo(() => [...savedViews.quickViews, ...savedViews.yourViews, ...savedViews.sharedViews]
    .filter((view, index, all) => all.findIndex((other) => other.id === view.id) === index), [savedViews.quickViews, savedViews.yourViews, savedViews.sharedViews])

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  /**
   * Load a page: the first replaces the results, later ones append.
   *
   * @param loaded - The records already shown ([] for the first page).
   */
  const load = useCallback(async (loaded: QRecord[]) => {
    const current = ++sequence.current
    setLoading(true)
    setFailed(false)
    try {
      const [sortField, sortDirection] = sort ? sort.split(':') : []
      const orderBys = sortField ? [{ fieldName: sortField, isAscending: sortDirection !== 'desc' }] : filter.orderBys
      const page = await queryRelatedPicker(tableName, picker.name, {
        primaryKey: multiple ? primaryKey : undefined,
        values: multiple ? undefined : formValues,
        searchTerm: term || undefined,
        filter: { criteria: filter.criteria, subFilters: filter.subFilters, booleanOperator: filter.booleanOperator, orderBys },
        skip: loaded.length,
        limit: PAGE_SIZE,
      })
      if (current !== sequence.current) return
      // the picker's default filter (resolved from the parent) starts the filter once
      if (!filterReady) {
        setFilterReady(true)
        if (page.resolvedDefaultFilter?.criteria?.some((criterion) => criterion.operator !== 'TRUE')) {
          setFilter({ ...emptyFilter(PAGE_SIZE), ...page.resolvedDefaultFilter, criteria: page.resolvedDefaultFilter.criteria.filter((criterion) => criterion.operator !== 'TRUE') })
          return
        }
      }
      const seen = new Set(loaded.map(idOf))
      setRecords([...loaded, ...page.records.filter((record) => !seen.has(idOf(record)))])
      setHasMore(page.hasMore)
      if (page.linkedIds?.length) setLinked((previous) => new Set([...previous, ...page.linkedIds!]))
    } catch {
      if (current === sequence.current) setFailed(true)
    } finally {
      if (current === sequence.current) setLoading(false)
    }
  }, [tableName, picker.name, multiple, primaryKey, formValues, term, filter, sort, filterReady, idOf])

  useEffect(() => {
    if (!target || step !== 'browse') return
    setActive(0)
    void load([])
  }, [term, filter, sort, target]) // eslint-disable-line react-hooks/exhaustive-deps

  const isLinked = (id: string) => picker.mode === 'LINK' && linked.has(id) && !unlinked.has(id)
  const isChecked = (id: string) => chosen.has(id) || isLinked(id) || (!multiple && chosen.size === 0 && selectedId !== undefined && selectedId !== null && String(selectedId) === id)

  /**
   * Toggle (multiple) or choose (single) a record.
   *
   * @param record - The record.
   */
  const toggle = (record: QRecord) => {
    const id = idOf(record)
    if (!multiple) {
      setChosen(new Map([[id, record]]))
      return
    }
    if (picker.mode === 'LINK' && linked.has(id)) {
      setUnlinked((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      return
    }
    setChosen((current) => {
      const next = new Map(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < (picker.maxSelections ?? 200)) next.set(id, record)
      return next
    })
  }

  const changeCount = chosen.size + unlinked.size
  const canConfirm = multiple ? changeCount > 0 : chosen.size > 0

  /**
   * Confirm: select (SINGLE), go to the review or add (MULTI_CHILD), or link and unlink (LINK).
   *
   * @param record - SINGLE: the record to choose (Enter or double click).
   */
  const confirm = async (record?: QRecord) => {
    setError(null)
    if (!multiple) {
      const choice = record ?? [...chosen.values()][0]
      if (choice) onSelect?.(choice, rawId(choice))
      return
    }
    if (primaryKey === undefined || !canConfirm) return
    setSaving(true)
    try {
      const ids = [...chosen.keys()]
      if (picker.mode === 'MULTI_CHILD' && (picker.reviewFieldNames?.length ?? 0) > 0) {
        const prepared = await prepareRelatedPicker(tableName, picker.name, primaryKey, ids)
        rowValues.current = prepared.records.map((row) => ({ ...row.values }))
        setDrafts(prepared.records)
        setReviewFields(prepared.reviewFieldNames)
        setStep('review')
        return
      }
      let added = 0
      let removed = 0
      if (ids.length) added = (await addRelatedPicker(tableName, picker.name, primaryKey, { targetIds: ids })).records.length
      if (unlinked.size) removed = await removeRelatedPicker(tableName, picker.name, primaryKey, [...unlinked])
      onDone?.({ added, removed })
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  /** Add the reviewed rows (all or nothing). */
  const addReviewed = async () => {
    if (primaryKey === undefined) return
    setError(null)
    setSaving(true)
    try {
      const childTargetField = picker.childTargetFieldName ?? ''
      const rows = drafts.map((draft, index) => ({ ...rowValues.current[index], [childTargetField]: draft.values?.[childTargetField] }))
      const result = await addRelatedPicker(tableName, picker.name, primaryKey, { records: rows })
      onDone?.({ added: result.records.length, removed: 0 })
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  /**
   * A record quick-created in the dialog: SINGLE selects it, the others add it to the choice.
   *
   * @param record - The saved record.
   */
  const handleCreated = (record: QRecord) => {
    setStep('browse')
    if (!multiple) {
      onSelect?.(record, rawId(record))
      return
    }
    setRecords((current) => [record, ...current.filter((other) => idOf(other) !== idOf(record))])
    setChosen((current) => new Map(current).set(idOf(record), record))
  }

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(records.length - 1, index))
    setActive(next)
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus()
    if (next >= records.length - 1 && hasMore && !loading) void load(records)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (!records.length) return
    const focused = records[active]
    let handled = true
    if (event.key === 'ArrowDown') moveTo(active + 1)
    else if (event.key === 'ArrowUp') moveTo(active - 1)
    else if (event.key === 'Home') moveTo(0)
    else if (event.key === 'End') moveTo(records.length - 1)
    else if (event.key === ' ' && focused) toggle(focused)
    else if (event.key === 'Enter' && focused) {
      if (multiple) toggle(focused)
      else void confirm(focused)
    } else handled = false
    if (handled) event.preventDefault()
  }

  const previewRecord = records.find((record) => idOf(record) === previewId) ?? records[active] ?? null
  const activeCriteria = filter.criteria.length + (filter.subFilters?.length ?? 0)
  const fieldLabel = (name: string) => target?.fields?.[name]?.label ?? name
  const confirmLabel = picker.mode === 'SINGLE' ? 'Select'
    : picker.mode === 'LINK' ? 'Save'
      : (picker.reviewFieldNames?.length ?? 0) > 0 ? `Next (${chosen.size})` : `Add ${chosen.size}`

  return (
    <PickerDialogFrame
      title={step === 'create' ? `New ${target?.label ?? ''}` : step === 'review' ? `${picker.label}: review` : picker.label}
      dataQqqId="related-picker-dialog"
      dataAttributes={{ 'data-mode': picker.mode, 'data-step': step }}
      onClose={onClose}
      onEscapeKeyDown={(event) => {
        if (step !== 'browse') {
          event.preventDefault()
          setStep('browse')
        }
      }}
      headerActions={step === 'browse' && picker.canCreateTarget && target?.insertPermission !== false && (
        <button type="button" onClick={() => setStep('create')} className={buttonClass('secondary', 'sm')} aria-label={`New ${target?.label ?? ''}`} data-qqq-id="related-picker-new">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">{`New ${target?.label ?? ''}`}</span>
        </button>
      )}
    >
      {step === 'create' && target && (
        <QuickCreatePanel table={target} onCreated={handleCreated} onCancel={() => setStep('browse')} />
      )}

      {step === 'review' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" data-qqq-id="related-picker-review">
            <p className="mb-3 text-sm text-muted-foreground">{`Fill in each new ${child?.label ?? 'row'}, then add them. Nothing is saved until every row is valid.`}</p>
            <ol className="flex flex-col gap-3">
              {drafts.map((draft, index) => (
                <li key={`${index}-${String(draft.values?.[picker.childTargetFieldName ?? ''])}`} className="rounded-md border border-border p-3" data-qqq-id="related-picker-review-row">
                  <h3 className="mb-2 text-sm font-semibold">{draft.displayValues?.[picker.childTargetFieldName ?? ''] ?? String(draft.values?.[picker.childTargetFieldName ?? ''] ?? '')}</h3>
                  {child && (
                    <ReviewRow
                      idPrefix={`related-picker-row-${index}`}
                      table={child}
                      fieldNames={reviewFields}
                      values={draft.values ?? {}}
                      onChange={(values) => { rowValues.current[index] = { ...rowValues.current[index], ...values } }}
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>
          <Footer error={error}>
            <button type="button" onClick={() => setStep('browse')} className={buttonClass('secondary')} data-qqq-id="related-picker-back">Back</button>
            <button type="button" onClick={() => void addReviewed()} disabled={saving || drafts.length === 0} className={buttonClass('primary')} data-qqq-id="related-picker-add">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {`Add ${drafts.length}`}
            </button>
          </Footer>
        </div>
      )}

      {step === 'browse' && (
        <>
          <div className="flex flex-wrap items-end gap-2 border-b border-border px-3 py-2 sm:px-4">
            <label className="relative min-w-0 flex-1 basis-48">
              <span className="sr-only">{`Search ${target?.label ?? ''}`}</span>
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className={cn(INPUT_CLASS, 'pl-8')} data-qqq-id="related-picker-search" autoFocus />
            </label>
            {views.length > 0 && (
              <select
                aria-label="Saved view"
                value=""
                onChange={(event) => {
                  const view = views.find((candidate) => String(candidate.id) === event.target.value)
                  if (view) setFilter({ ...emptyFilter(PAGE_SIZE), ...view.view.queryFilter, skip: 0, limit: PAGE_SIZE } as QQueryFilter)
                }}
                className={cn(SELECT_CLASS, 'w-auto')}
                data-qqq-id="related-picker-view"
              >
                <option value="">Saved views</option>
                {views.map((view) => <option key={view.id} value={String(view.id)}>{view.label}</option>)}
              </select>
            )}
            <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)} className={cn(SELECT_CLASS, 'w-auto')} data-qqq-id="related-picker-sort">
              <option value="">Default order</option>
              {columns.flatMap((name) => [
                <option key={`${name}:asc`} value={`${name}:asc`}>{`${fieldLabel(name)} (A to Z)`}</option>,
                <option key={`${name}:desc`} value={`${name}:desc`}>{`${fieldLabel(name)} (Z to A)`}</option>,
              ])}
            </select>
            <button type="button" onClick={() => setShowFilters((shown) => !shown)} aria-expanded={showFilters} className={buttonClass('secondary', 'sm')} data-qqq-id="related-picker-filters-toggle">
              <Filter className="h-4 w-4" aria-hidden="true" />
              {activeCriteria ? `Filters (${activeCriteria})` : 'Filters'}
            </button>
          </div>

          {showFilters && filterTable && (
            <div className="max-h-[40vh] overflow-y-auto border-b border-border px-3 py-2 sm:px-4" data-qqq-id="related-picker-filters">
              <FilterBuilder tableMetaData={filterTable} filter={filter} onChange={(next) => setFilter({ ...next, skip: 0, limit: PAGE_SIZE })} onClear={() => setFilter(emptyFilter(PAGE_SIZE))} onClose={() => setShowFilters(false)} />
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-4" aria-busy={loading || undefined} data-qqq-id="related-picker-results">
              {failed ? (
                <p role="alert" className={ALERT_CLASS}>
                  Results could not be loaded.{' '}
                  <button type="button" className="underline" onClick={() => void load([])}>Try again</button>
                </p>
              ) : !loading && records.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground" data-qqq-id="related-picker-empty">No matches.</p>
              ) : (
                <>
                  <div className="mb-1 hidden gap-3 px-2 text-xs font-medium text-muted-foreground sm:grid" style={{ gridTemplateColumns: `1.5rem repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }} aria-hidden="true">
                    <span />
                    {columns.map((name) => <span key={name} className="truncate">{fieldLabel(name)}</span>)}
                  </div>
                  <ul ref={listRef} role="listbox" aria-label={`${target?.label ?? picker.label} results`} aria-multiselectable={multiple || undefined} onKeyDown={handleKeyDown} className="flex flex-col gap-1">
                    {records.map((record, index) => {
                      const id = idOf(record)
                      const checked = isChecked(id)
                      const present = picker.mode === 'MULTI_CHILD' && linked.has(id)
                      return (
                        <li
                          key={id}
                          role="option"
                          aria-selected={checked}
                          tabIndex={index === active ? 0 : -1}
                          data-index={index}
                          data-value={id}
                          data-qqq-id="related-picker-option"
                          onClick={() => { setActive(index); setPreviewId(id); toggle(record) }}
                          onDoubleClick={() => { if (!multiple) void confirm(record) }}
                          onFocus={() => { setActive(index); setPreviewId(id) }}
                          className={cn('grid cursor-pointer items-center gap-x-3 gap-y-0.5 rounded-md border p-2 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                            'grid-cols-[1.5rem_minmax(0,1fr)] sm:[grid-template-columns:var(--cols)]',
                            checked ? 'border-primary bg-accent' : 'border-border')}
                          style={{ '--cols': `1.5rem repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` } as React.CSSProperties}
                        >
                          <span className={cn('flex h-4 w-4 items-center justify-center rounded border', checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input')} aria-hidden="true">
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          {columns.map((name, columnIndex) => (
                            <span key={name} className={cn('min-w-0 truncate', columnIndex === 0 ? 'font-medium' : 'col-start-2 text-xs text-muted-foreground sm:col-start-auto sm:text-sm sm:text-foreground')} title={recordText(record, name)}>
                              {columnIndex === 0 && present && <span className="mr-1 rounded bg-muted px-1 text-xs text-muted-foreground" data-qqq-id="related-picker-present">Added</span>}
                              {recordText(record, name) || (columnIndex === 0 ? record.recordLabel ?? id : '')}
                            </span>
                          ))}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
              {loading && (
                <p role="status" className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading...
                </p>
              )}
              {hasMore && !loading && !failed && (
                <div className="flex justify-center py-3">
                  <button type="button" onClick={() => void load(records)} className={buttonClass('secondary', 'sm')} data-qqq-id="related-picker-more">Load more</button>
                </div>
              )}
            </div>

            {previewRecord && (
              <aside className="hidden min-h-0 w-80 shrink-0 overflow-y-auto border-l border-border p-4 lg:block" aria-label="Preview" data-qqq-id="related-picker-preview">
                <h3 className="break-words text-sm font-semibold">{previewRecord.recordLabel ?? recordText(previewRecord, columns[0] ?? pk)}</h3>
                <dl className="mt-2 flex flex-col gap-1 text-xs">
                  {previewFields.map((name) => {
                    const text = recordText(previewRecord, name)
                    if (!text) return null
                    return (
                      <div key={name} className="flex gap-2">
                        <dt className="shrink-0 text-muted-foreground">{fieldLabel(name)}</dt>
                        <dd className="min-w-0 break-words">{text}</dd>
                      </div>
                    )
                  })}
                </dl>
                <a href={pickerRecordPath(picker.targetTableName, idOf(previewRecord))} target="_blank" rel="noopener noreferrer" className={cn(buttonClass('secondary', 'sm'), 'mt-3')}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open
                </a>
              </aside>
            )}
          </div>

          <Footer error={error}>
            <p className={cn(LABEL_CLASS, 'min-w-0 flex-1 truncate')} aria-live="polite" data-qqq-id="related-picker-selection">
              {selectionText(picker.mode, chosen, unlinked.size)}
            </p>
            <PickerDialogClose className={buttonClass('secondary')} data-qqq-id="related-picker-cancel">Cancel</PickerDialogClose>
            <button type="button" onClick={() => void confirm()} disabled={!canConfirm || saving || (multiple && !(picker.canAddChildren || picker.canRemoveChildren))} className={buttonClass('primary')} data-qqq-id="related-picker-confirm">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </button>
          </Footer>
        </>
      )}
    </PickerDialogFrame>
  )
}

/**
 * The selection summary in the footer.
 *
 * @param mode - The picker's mode.
 * @param chosen - The chosen records.
 * @param unlinkCount - How many links will be removed (LINK).
 * @returns The text.
 */
function selectionText(mode: QRelatedRecordPicker['mode'], chosen: Map<string, QRecord>, unlinkCount: number): string {
  if (mode === 'SINGLE') {
    const record = [...chosen.values()][0]
    return record ? record.recordLabel ?? 'Selected' : 'Nothing selected'
  }
  if (mode === 'LINK') {
    const parts = [chosen.size ? `${chosen.size} to link` : '', unlinkCount ? `${unlinkCount} to unlink` : ''].filter(Boolean)
    return parts.length ? parts.join(', ') : 'No changes'
  }
  return chosen.size ? `${chosen.size} selected` : 'Nothing selected'
}

/**
 * The dialog footer: an error, then the actions.
 *
 * @param props - The error and the actions.
 * @returns The footer.
 */
function Footer({ error, children }: { error: string | null; children: React.ReactNode }) {
  return (
    <div className="border-t border-border px-3 py-2 sm:px-4">
      {error && <p role="alert" className={cn(ALERT_CLASS, 'mb-2 whitespace-pre-line')} data-qqq-id="related-picker-error">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  )
}

/**
 * One review row: the child table's review fields as standard form controls.
 *
 * @param props - The child table, the fields, the row's values and the change callback.
 * @returns The row's form.
 */
function ReviewRow({ idPrefix, table, fieldNames, values, onChange }: { idPrefix: string; table: QTableMetaData; fieldNames: string[]; values: Record<string, unknown>; onChange: (values: Record<string, unknown>) => void }) {
  const { register, control, formState, watch } = useForm<Record<string, unknown>>({ defaultValues: values })
  useEffect(() => {
    const subscription = watch((next) => onChange(next as Record<string, unknown>))
    return () => subscription.unsubscribe()
  }, [watch, onChange])
  const fields = fieldNames.map((name) => table.fields?.[name]).filter((field): field is QFieldMetaData => Boolean(field))
  // one id prefix per row, so the rows' labels and inputs stay paired
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <DynamicFormField key={field.name} idPrefix={idPrefix} field={field} register={register} control={control} errors={formState.errors} possibleValueContext={{ type: 'table', tableName: table.name }} />
      ))}
    </div>
  )
}

/**
 * Quick-create of a target record: its quick-create section (or required fields), saved through
 * the standard insert route (validation, permissions, record locks and audit as any create).
 *
 * @param props - The target table and the callbacks.
 * @returns The form.
 */
function QuickCreatePanel({ table, onCreated, onCancel }: { table: QTableMetaData; onCreated: (record: QRecord) => void; onCancel: () => void }) {
  const { register, control, formState, handleSubmit } = useForm<Record<string, unknown>>()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fields = useMemo(() => quickCreateFields(table), [table])

  const save = handleSubmit(async (values) => {
    setError(null)
    setSaving(true)
    try {
      const cleaned = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== ''))
      onCreated(await insertRecord(table.name, cleaned))
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  })

  // the dialog is portaled, but React events bubble through the React tree: stop the submit
  // so it never reaches a form hosting the picker (e.g. the order's create form)
  return (
    <form onSubmit={(event) => { event.stopPropagation(); void save(event) }} className="flex min-h-0 flex-1 flex-col" data-qqq-id="related-picker-create" noValidate>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="grid gap-3">
          {fields.map((field) => (
            <DynamicFormField key={field.name} idPrefix="related-picker-create" field={field} register={register} control={control} errors={formState.errors} possibleValueContext={{ type: 'table', tableName: table.name }} />
          ))}
        </div>
        <a href={`/app/${encodeURIComponent(table.name)}/create`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline" data-qqq-id="related-picker-full-create">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open the full create screen
        </a>
      </div>
      <Footer error={error}>
        <button type="button" onClick={onCancel} className={buttonClass('secondary')} data-qqq-id="related-picker-create-cancel">Back</button>
        <button type="submit" disabled={saving} className={buttonClass('primary')} data-qqq-id="related-picker-create-save">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
      </Footer>
    </form>
  )
}

export default RelatedRecordPickerDialog
