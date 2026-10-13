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
 * @file RecordPickerDialog — the record picker for a field whose possible value source declares a
 * `picker` (tables that grow large, e.g. 100,000+ media): server-side search, filters from the
 * picker's table, orderings, a thumbnail grid or a list, keyset or offset paging without counts,
 * a preview pane, uploading a new record, and single or multiple selection. Loaded on demand by
 * {@link PossibleValueSelect}. The API contract and scale approach are in QQQ's
 * docs/misc/RecordPicker.adoc.
 */

'use client'

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, ExternalLink, Grid2x2, List, Loader2, Maximize2, Search, Upload, X } from 'lucide-react'

import type { QFieldMetaData, QPossibleValue, QPossibleValuePicker } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { fetchPossibleValuesPage, fetchTablePossibleValues } from '@/lib/api/possible-values'
import { useProcessMetaData, useTableMetaData } from '@/lib/hooks/use-metadata'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { cn } from '@/lib/utils/cn'
import {
  type PickerFilterValue,
  type PickerPreferences,
  pickerFilterKind,
  pickerPageRequest,
  pickerStorageKey,
  readPickerPreferences,
  writePickerPreferences,
} from '@/lib/utils/record-picker-query'
import { pickerPreviewUrl, pickerRecordPath, pickerSubtitle, pickerThumbnailUrl, pickerValueText } from '@/lib/utils/record-picker'
import { buttonClass, iconButtonClass, INPUT_CLASS, SELECT_CLASS, ALERT_CLASS, LABEL_CLASS } from '@/components/ui/controls'

import { FilePreviewLightbox } from '@/components/preview/FilePreviewLightboxLazy'
import { ProcessRun } from '@/components/process/ProcessRunLazy'

/** Search debounce, in milliseconds. */
const SEARCH_DEBOUNCE_MS = 300

/** Props for {@link RecordPickerDialog}. */
export interface RecordPickerDialogProps {
  /** The field's label (the dialog title is "Choose {label}"). */
  label: string
  /** The field the picker chooses for. */
  fieldName: string
  /** Where the field is (its possible-values route). */
  context: PossibleValueContext
  /** Source name, for a standalone lookup. */
  possibleValueSourceName?: string
  /** The field's picker. */
  picker: QPossibleValuePicker
  /** The table the picker reads. */
  pickerTableName?: string
  /** The form's current values (the field's own filter may use them). */
  formValues?: Record<string, unknown>
  /** Choose several records (an association or gallery) instead of one. */
  multiple?: boolean
  /** The ids already chosen. */
  selectedIds?: Array<string | number>
  /** Called with the chosen options when the user confirms. */
  onConfirm: (options: QPossibleValue[]) => void
  /** Called when the dialog closes without a choice. */
  onClose: () => void
}

/**
 * One filter control: a choice (the field's own possible values), yes/no, a text, or a range.
 *
 * @param props - The field, its value, the picker table and the change handler.
 * @returns The labelled control.
 */
function PickerFilter({ field, value, tableName, onChange }: {
  field: QFieldMetaData
  value: PickerFilterValue | undefined
  tableName: string
  onChange: (value: PickerFilterValue | undefined) => void
}) {
  const kind = pickerFilterKind(field)
  const [choices, setChoices] = useState<QPossibleValue[]>([])
  const id = `record-picker-filter-${field.name}`

  useEffect(() => {
    if (kind !== 'choice') return
    let cancelled = false
    fetchTablePossibleValues(tableName, field.name, { useCase: 'filter' })
      .then((options) => { if (!cancelled) setChoices(options) })
      .catch(() => { if (!cancelled) setChoices([]) })
    return () => { cancelled = true }
  }, [kind, tableName, field.name])

  const set = (patch: PickerFilterValue) => {
    const next = { ...(value ?? {}), ...patch }
    onChange(next.value || next.from || next.to ? next : undefined)
  }

  if (kind === 'choice' || kind === 'boolean') {
    return (
      <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
        {field.label}
        <select id={id} value={value?.value ?? ''} onChange={(event) => set({ value: event.target.value })} className={SELECT_CLASS} data-qqq-id={`record-picker-filter-${field.name}`}>
          <option value="">Any</option>
          {kind === 'boolean'
            ? (<><option value="true">Yes</option><option value="false">No</option></>)
            : choices.map((choice) => <option key={String(choice.id)} value={String(choice.id)}>{choice.label}</option>)}
        </select>
      </label>
    )
  }
  if (kind === 'text') {
    return (
      <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
        {field.label}
        <input id={id} type="text" value={value?.value ?? ''} onChange={(event) => set({ value: event.target.value })} className={INPUT_CLASS} placeholder="Contains" data-qqq-id={`record-picker-filter-${field.name}`} />
      </label>
    )
  }
  const type = kind === 'number' ? 'number' : 'date'
  return (
    <fieldset className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground" data-qqq-id={`record-picker-filter-${field.name}`}>
      <legend className="mb-1">{field.label}</legend>
      <div className="flex gap-1">
        <input type={type} aria-label={`${field.label} from`} value={value?.from ?? ''} onChange={(event) => set({ from: event.target.value })} className={INPUT_CLASS} placeholder="From" />
        <input type={type} aria-label={`${field.label} to`} value={value?.to ?? ''} onChange={(event) => set({ to: event.target.value })} className={INPUT_CLASS} placeholder="To" />
      </div>
    </fieldset>
  )
}

/**
 * The record picker dialog. Escape closes it and focus is trapped while it is open (Radix);
 * arrow keys move through the results (by row in the grid), Enter or a double click confirms,
 * Space toggles in multiple selection.
 *
 * @param props - See {@link RecordPickerDialogProps}.
 * @returns The dialog.
 */
export function RecordPickerDialog({
  label,
  fieldName,
  context,
  possibleValueSourceName,
  picker,
  pickerTableName,
  formValues,
  multiple = false,
  selectedIds = [],
  onConfirm,
  onClose,
}: RecordPickerDialogProps) {
  const restoreFocus = useRestoreFocus(true)
  const { data: table } = useTableMetaData(pickerTableName)
  const { data: uploadProcess } = useProcessMetaData(picker.uploadProcessName)
  const storageKey = pickerStorageKey(pickerTableName, fieldName)
  const [preferences, setPreferences] = useState<PickerPreferences>(() => readPickerPreferences(storageKey))
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [options, setOptions] = useState<QPossibleValue[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(0)
  // the option the user last focused or clicked (the preview follows it)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [chosen, setChosen] = useState<QPossibleValue[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewing, setPreviewing] = useState<QPossibleValue | null>(null)
  const sequence = useRef(0)
  const resultsRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const selectedKey = selectedIds.map(String).join(',')

  // the remembered filters/ordering/view of this field
  useEffect(() => { writePickerPreferences(storageKey, preferences) }, [storageKey, preferences])

  // debounce the search box
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const filterFields = useMemo(
    () => (picker.filterFields ?? []).map((name) => table?.fields?.[name]).filter((field): field is QFieldMetaData => Boolean(field)),
    [picker.filterFields, table]
  )
  const activeFilterCount = Object.values(preferences.filters).filter(Boolean).length

  /**
   * Load a page: the first page replaces the results, later pages append to them.
   *
   * @param loaded - The options already shown ([] for the first page).
   */
  const load = useCallback(async (loaded: QPossibleValue[]) => {
    const current = ++sequence.current
    setLoading(true)
    setFailed(false)
    try {
      const page = await fetchPossibleValuesPage(context, fieldName, possibleValueSourceName, {
        searchTerm: term || undefined,
        formValues,
        picker: pickerPageRequest(picker, preferences, table?.fields, table?.primaryKeyField, loaded),
      })
      if (current !== sequence.current) return
      const seen = new Set(loaded.map((option) => String(option.id)))
      setOptions([...loaded, ...page.options.filter((option) => !seen.has(String(option.id)))])
      setHasMore(page.hasMore)
    } catch {
      if (current === sequence.current) setFailed(true)
    } finally {
      if (current === sequence.current) setLoading(false)
    }
  }, [context, fieldName, possibleValueSourceName, term, formValues, picker, preferences, table])

  // a new search, filter or ordering starts over (after the table's fields are known)
  useEffect(() => {
    if (pickerTableName && !table) return
    setActive(0)
    void load([])
  }, [term, preferences.filters, preferences.sortIndex, table]) // eslint-disable-line react-hooks/exhaustive-deps

  // the current selection, looked up once so it shows as chosen with its thumbnail
  useEffect(() => {
    if (!selectedKey) return
    let cancelled = false
    fetchPossibleValuesPage(context, fieldName, possibleValueSourceName, { ids: selectedKey, formValues, picker: {} })
      .then((page) => { if (!cancelled) setChosen(page.options) })
      .catch(() => { /* the results still show the selection */ })
    return () => { cancelled = true }
  }, [selectedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // infinite scroll: load the next page when the end of the results comes into view
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !loading) void load(options)
    }, { root: resultsRef.current, rootMargin: '200px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, options, load])

  const isChosen = (option: QPossibleValue) => chosen.some((item) => String(item.id) === String(option.id))
  const focused = options[active] ?? null
  const previewOption = options.find((option) => String(option.id) === previewId) ?? chosen[0] ?? options[0] ?? null

  /**
   * Choose an option: replace the choice, or toggle it in multiple selection.
   *
   * @param option - The option.
   */
  const choose = (option: QPossibleValue) => {
    if (!multiple) setChosen([option])
    else setChosen((current) => (current.some((item) => String(item.id) === String(option.id))
      ? current.filter((item) => String(item.id) !== String(option.id))
      : [...current, option]))
  }

  const confirm = (option?: QPossibleValue) => {
    const result = option && !multiple ? [option] : chosen
    if (!result.length) return
    onConfirm(result)
  }

  /**
   * How many results one grid row holds (from the laid-out options), for Up/Down.
   *
   * @returns The column count (1 in the list).
   */
  const columns = () => {
    if (preferences.view === 'list') return 1
    const items = resultsRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
    if (!items || items.length < 2) return 1
    const top = items[0].offsetTop
    let count = 0
    for (const item of Array.from(items)) {
      if (item.offsetTop !== top) break
      count += 1
    }
    return Math.max(1, count)
  }

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(options.length - 1, index))
    setActive(next)
    resultsRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus()
    if (next >= options.length - 1 && hasMore && !loading) void load(options)
  }

  const handleResultsKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (!options.length) return
    let handled = true
    if (event.key === 'ArrowRight') moveTo(active + 1)
    else if (event.key === 'ArrowLeft') moveTo(active - 1)
    else if (event.key === 'ArrowDown') moveTo(active + columns())
    else if (event.key === 'ArrowUp') moveTo(active - columns())
    else if (event.key === 'Home') moveTo(0)
    else if (event.key === 'End') moveTo(options.length - 1)
    else if (event.key === ' ' && focused) choose(focused)
    else if (event.key === 'Enter' && focused) {
      if (multiple) choose(focused)
      else confirm(focused)
    } else handled = false
    if (handled) event.preventDefault()
  }

  const setFilter = (name: string, value: PickerFilterValue | undefined) => {
    setPreferences((current) => {
      const filters = { ...current.filters }
      if (value) filters[name] = value
      else delete filters[name]
      return { ...current, filters }
    })
  }

  /**
   * Select the record an upload created, read from the upload process's result value.
   *
   * @param values - The completed process's values.
   */
  const handleUploaded = async (values: Record<string, unknown>) => {
    const id = picker.uploadResultIdField ? values[picker.uploadResultIdField] : undefined
    setUploading(false)
    if (id === undefined || id === null || id === '') return
    try {
      const page = await fetchPossibleValuesPage(context, fieldName, possibleValueSourceName, { ids: String(id), formValues, picker: {} })
      const created = page.options[0]
      if (!created) return
      setOptions((current) => [created, ...current.filter((option) => String(option.id) !== String(created.id))])
      setActive(0)
      choose(created)
    } catch {
      /* the upload succeeded; it is found by searching */
    }
  }

  const thumbnail = (option: QPossibleValue, size: string) => {
    const url = pickerThumbnailUrl(option, picker)
    return url
      // eslint-disable-next-line @next/next/no-img-element -- record URLs from any allowed origin; the static export has no image optimizer
      ? <img src={url} alt="" loading="lazy" decoding="async" className={cn(size, 'rounded object-cover bg-muted')} />
      : <span aria-hidden="true" className={cn(size, 'rounded bg-muted')} />
  }

  const previewUrl = pickerPreviewUrl(previewOption, picker)

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-black/80" />
        <Dialog.Content
          onCloseAutoFocus={restoreFocus}
          aria-describedby={undefined}
          className="fixed inset-0 z-[2001] flex flex-col overflow-hidden border border-border bg-card text-foreground shadow-xl focus:outline-none sm:inset-6 sm:rounded-lg"
          data-qqq-id="record-picker-dialog"
          data-multiple={multiple || undefined}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold">{`Choose ${label}`}</Dialog.Title>
            {uploadProcess?.hasPermission && !uploading && (
              <button type="button" onClick={() => setUploading(true)} className={buttonClass('secondary', 'sm')} data-qqq-id="record-picker-upload">
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{uploadProcess.label || 'Upload new'}</span>
              </button>
            )}
            <Dialog.Close className={iconButtonClass()} aria-label="Close" data-qqq-id="record-picker-close">
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {uploading && picker.uploadProcessName && uploadProcess ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" data-qqq-id="record-picker-upload-panel">
              <button type="button" onClick={() => setUploading(false)} className={cn(buttonClass('ghost', 'sm'), 'mb-2')}>Back to the list</button>
              <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />}>
                <ProcessRun processName={picker.uploadProcessName} processMetaData={uploadProcess} isEmbedded onComplete={(values) => { void handleUploaded(values) }} />
              </Suspense>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2 border-b border-border px-3 py-2 sm:px-4">
                <label className="relative min-w-0 flex-1 basis-48">
                  <span className="sr-only">{`Search ${label}`}</span>
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search"
                    className={cn(INPUT_CLASS, 'pl-8')}
                    data-qqq-id="record-picker-search"
                    autoFocus
                  />
                </label>
                {(picker.sorts?.length ?? 0) > 1 && (
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="sr-only sm:not-sr-only">Sort</span>
                    <select
                      value={preferences.sortIndex}
                      onChange={(event) => setPreferences((current) => ({ ...current, sortIndex: Number(event.target.value) }))}
                      className={SELECT_CLASS}
                      aria-label="Sort"
                      data-qqq-id="record-picker-sort"
                    >
                      {picker.sorts!.map((sort, index) => <option key={sort.label} value={index}>{sort.label}</option>)}
                    </select>
                  </label>
                )}
                {filterFields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFilters((shown) => !shown)}
                    aria-expanded={showFilters}
                    className={buttonClass('secondary', 'sm')}
                    data-qqq-id="record-picker-filters-toggle"
                  >
                    {activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
                  </button>
                )}
                <div className="flex" role="group" aria-label="View">
                  <button type="button" onClick={() => setPreferences((current) => ({ ...current, view: 'grid' }))} aria-pressed={preferences.view === 'grid'} aria-label="Grid view" className={cn(iconButtonClass(), preferences.view === 'grid' && 'bg-accent text-foreground')} data-qqq-id="record-picker-view-grid">
                    <Grid2x2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setPreferences((current) => ({ ...current, view: 'list' }))} aria-pressed={preferences.view === 'list'} aria-label="List view" className={cn(iconButtonClass(), preferences.view === 'list' && 'bg-accent text-foreground')} data-qqq-id="record-picker-view-list">
                    <List className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {showFilters && filterFields.length > 0 && pickerTableName && (
                <div className="grid grid-cols-1 gap-2 border-b border-border px-3 py-2 sm:grid-cols-2 sm:px-4 lg:grid-cols-4" data-qqq-id="record-picker-filters">
                  {filterFields.map((field) => (
                    <PickerFilter key={field.name} field={field} value={preferences.filters[field.name]} tableName={pickerTableName} onChange={(value) => setFilter(field.name, value)} />
                  ))}
                  {activeFilterCount > 0 && (
                    <button type="button" onClick={() => setPreferences((current) => ({ ...current, filters: {} }))} className={cn(buttonClass('ghost', 'sm'), 'self-end')}>Clear filters</button>
                  )}
                </div>
              )}

              <div className="flex min-h-0 flex-1">
                <div
                  ref={resultsRef}
                  className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-4"
                  aria-busy={loading || undefined}
                  data-qqq-id="record-picker-results"
                  data-view={preferences.view}
                >
                  {failed ? (
                    <p role="alert" className={ALERT_CLASS}>
                      Results could not be loaded.{' '}
                      <button type="button" className="underline" onClick={() => void load([])}>Try again</button>
                    </p>
                  ) : !loading && options.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground" data-qqq-id="record-picker-empty">No matches.</p>
                  ) : (
                    <ul
                      role="listbox"
                      aria-label={`${label} results`}
                      aria-multiselectable={multiple || undefined}
                      onKeyDown={handleResultsKeyDown}
                      className={preferences.view === 'grid' ? 'qqq-record-picker-grid grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' : 'flex flex-col gap-1'}>
                      {options.map((option, index) => {
                        const selected = isChosen(option)
                        const subtitle = pickerSubtitle(option, picker)
                        return (
                          <li
                            key={String(option.id)}
                            role="option"
                            aria-selected={selected}
                            tabIndex={index === active ? 0 : -1}
                            data-index={index}
                            data-qqq-id="record-picker-option"
                            data-value={String(option.id)}
                            onClick={() => { setActive(index); setPreviewId(String(option.id)); choose(option) }}
                            onDoubleClick={() => confirm(option)}
                            onFocus={() => { setActive(index); setPreviewId(String(option.id)) }}
                            className={cn(
                              'relative cursor-pointer rounded-md border p-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                              preferences.view === 'list' && 'flex items-center gap-3',
                              selected ? 'border-primary bg-accent' : 'border-border'
                            )}
                          >
                            {preferences.view === 'grid' ? thumbnail(option, 'block aspect-square w-full') : thumbnail(option, 'h-10 w-10 shrink-0')}
                            <span className={cn('block min-w-0', preferences.view === 'grid' && 'mt-1')}>
                              <span className="block truncate font-medium" title={option.label}>{option.label}</span>
                              {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
                            </span>
                            {selected && (
                              <Check className="absolute right-2 top-2 h-4 w-4 rounded-full bg-primary text-primary-foreground" aria-hidden="true" />
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <div ref={sentinelRef} aria-hidden="true" />
                  {loading && (
                    <p role="status" className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Loading...
                    </p>
                  )}
                  {hasMore && !loading && !failed && (
                    <div className="flex justify-center py-3">
                      <button type="button" onClick={() => void load(options)} className={buttonClass('secondary', 'sm')} data-qqq-id="record-picker-more">Load more</button>
                    </div>
                  )}
                </div>

                {previewOption && (
                  <aside className="hidden min-h-0 w-80 shrink-0 overflow-y-auto border-l border-border p-4 lg:block" aria-label="Preview" data-qqq-id="record-picker-preview">
                    {previewUrl && (
                      <button type="button" onClick={() => setPreviewing(previewOption)} className="block w-full rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Preview ${previewOption.label} full size`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- record URLs from any allowed origin; the static export has no image optimizer */}
                        <img src={previewUrl} alt={previewOption.label} className="max-h-80 w-full rounded-md bg-muted object-contain" />
                      </button>
                    )}
                    <h3 className="mt-3 break-words text-sm font-semibold">{previewOption.label}</h3>
                    {(picker.detailFields ?? []).length > 0 && (
                      <dl className="mt-2 flex flex-col gap-1 text-xs">
                        {picker.detailFields!.map((name) => {
                          const text = pickerValueText(previewOption, name)
                          if (!text) return null
                          return (
                            <div key={name} className="flex gap-2">
                              <dt className="shrink-0 text-muted-foreground">{table?.fields?.[name]?.label ?? name}</dt>
                              <dd className="min-w-0 break-words">{text}</dd>
                            </div>
                          )
                        })}
                      </dl>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {previewUrl && (
                        <button type="button" onClick={() => setPreviewing(previewOption)} className={buttonClass('secondary', 'sm')}>
                          <Maximize2 className="h-4 w-4" aria-hidden="true" />
                          Full size
                        </button>
                      )}
                      {pickerTableName && (
                        <a href={pickerRecordPath(pickerTableName, previewOption.id)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          Open
                        </a>
                      )}
                    </div>
                  </aside>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 sm:px-4">
                <p className={cn(LABEL_CLASS, 'min-w-0 flex-1 truncate')} aria-live="polite" data-qqq-id="record-picker-selection">
                  {chosen.length === 0 ? 'Nothing selected' : multiple ? `${chosen.length} selected` : chosen[0].label}
                </p>
                {previewOption && previewUrl && (
                  <button type="button" onClick={() => setPreviewing(previewOption)} className={cn(buttonClass('secondary'), 'lg:hidden')} aria-label={`Preview ${previewOption.label} full size`}>
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <Dialog.Close className={buttonClass('secondary')} data-qqq-id="record-picker-cancel">Cancel</Dialog.Close>
                <button type="button" onClick={() => confirm()} disabled={chosen.length === 0} className={buttonClass('primary')} data-qqq-id="record-picker-select">
                  Select
                </button>
              </div>
            </>
          )}
          {previewing && (
            <Suspense fallback={null}>
              <FilePreviewLightbox
                items={[{
                  url: pickerPreviewUrl(previewing, picker) ?? '',
                  thumbnailUrl: pickerThumbnailUrl(previewing, picker),
                  fileName: previewing.label,
                  kind: 'image',
                  alt: previewing.label,
                  previewable: true,
                  thumbnailSize: 40,
                }]}
                index={0}
                onIndexChange={() => { /* a single image */ }}
                onClose={() => setPreviewing(null)}
              />
            </Suspense>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default RecordPickerDialog
