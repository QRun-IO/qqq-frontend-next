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
 * @file PivotTableEditorDialog — Material's "Edit Pivot Table" modal: add, remove and reorder
 * the row and column group-bys and the values (a field plus an aggregate function), then OK
 * (blocked by "Missing value in N fields.") or Cancel (discards the changes).
 */
'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AlertCircle, Check, ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react'

import type { QTableMetaData } from '@/types'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { cn } from '@/lib/utils/cn'
import { resolveFieldLabel } from '../record-widget-utils'
import {
  clonePivotDefinition,
  countMissingValues,
  findPivotField,
  functionsForField,
  missingValueMessage,
  moveItem,
  nextPivotKey,
  PIVOT_FUNCTION_LABELS,
  pivotFieldOptions,
} from './pivot-table-model'
import type { PivotDefinition, PivotFieldOption, PivotItem, PivotSection } from './pivot-table-model'

/** Props for {@link PivotTableEditorDialog}. */
export interface PivotTableEditorDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Name of the widget, used in `data-qqq-id` values. */
  widgetName: string
  /** Metadata of the report's table. */
  tableMetaData: QTableMetaData
  /** The report's visible column names: the only fields the pivot table may use. */
  availableFieldNames: readonly string[]
  /** The definition to start from; the dialog edits a copy. */
  definition: PivotDefinition
  /** When true the form is locked: the definition is shown but cannot be changed or saved. */
  disabled?: boolean
  /** Called on Cancel or Escape; the changes are discarded. */
  onCancel: () => void
  /** Called on OK with the edited definition, once it has no missing values. */
  onSave: (definition: PivotDefinition) => void
}

/** The parts of a definition, in the order the editor shows them. */
const SECTIONS: readonly PivotSection[] = ['rows', 'columns', 'values']

/** Heading of each part. */
const SECTION_TITLES: Record<PivotSection, string> = { rows: 'Rows', columns: 'Columns', values: 'Values' }

/** Singular noun of each part, used in labels ("Add new row", "Remove row 1"). */
const SECTION_NOUNS: Record<PivotSection, string> = { rows: 'row', columns: 'column', values: 'value' }

/** Shared classes of the editor's selects. */
const SELECT_CLASS =
  'min-h-9 min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11'

/** Shared classes of the editor's small icon buttons. */
const ICON_BUTTON_CLASS =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent pointer-coarse:h-11 pointer-coarse:w-11'

/**
 * Capitalizes a word.
 *
 * @param word - The word.
 * @returns The word with its first letter in upper case.
 */
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * Groups field options by their group heading, keeping their order.
 *
 * @param options - The options.
 * @returns `[heading, options]` pairs.
 */
function groupOptions(options: PivotFieldOption[]): Array<[string, PivotFieldOption[]]> {
  const groups = new Map<string, PivotFieldOption[]>()
  for (const option of options) {
    const list = groups.get(option.group) ?? []
    list.push(option)
    groups.set(option.group, list)
  }
  return [...groups.entries()]
}

/**
 * The modal editor of a pivot table definition. Focus is trapped while it is open and returns
 * to what opened it; Escape and Cancel discard the changes, and a click outside is ignored
 * (as in Material) so work is not lost by accident.
 *
 * @param props - See {@link PivotTableEditorDialogProps}.
 * @returns The dialog.
 */
export function PivotTableEditorDialog({ open, widgetName, onCancel, ...bodyProps }: PivotTableEditorDialogProps) {
  const restoreFocus = useRestoreFocus(open)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-qqq-id={`pivot-editor-${widgetName}`}
          className="fixed inset-2 z-50 flex flex-col rounded-lg border border-border bg-card shadow-lg focus:outline-none sm:inset-8"
          onCloseAutoFocus={restoreFocus}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <PivotEditorBody widgetName={widgetName} onCancel={onCancel} {...bodyProps} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** A drag in progress: the part and index of the entry being dragged. */
interface DragState {
  section: PivotSection
  index: number
}

/**
 * The dialog's content. It mounts each time the dialog opens, so every opening starts from a
 * fresh copy of the definition.
 *
 * @param props - The dialog props, less `open`.
 * @returns The title, the three parts, the validation message, and Cancel and OK.
 */
function PivotEditorBody({ widgetName, tableMetaData, availableFieldNames, definition, disabled = false, onCancel, onSave }: Omit<PivotTableEditorDialogProps, 'open'>) {
  const idPrefix = useId()
  const [draft, setDraft] = useState<PivotDefinition>(() => clonePivotDefinition(definition))
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [errorAlert, setErrorAlert] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragOver, setDragOver] = useState<DragState | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [focusRequest, setFocusRequest] = useState<string[] | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const options = useMemo(() => pivotFieldOptions(tableMetaData, availableFieldNames), [tableMetaData, availableFieldNames])
  const grouped = (tableMetaData.exposedJoins ?? []).some((join) => Boolean(join.joinTable))

  ////////////////////////////////////////////////////////////////////
  // after an add, remove or keyboard move, focus the control asked  //
  // for (the first of the candidates that exists and is enabled)    //
  ////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (!focusRequest) return
    for (const candidate of focusRequest) {
      const element = bodyRef.current?.querySelector<HTMLElement>(`[data-pivot-focus="${candidate}"]`)
      if (element && !(element instanceof HTMLButtonElement && element.disabled)) {
        element.focus()
        break
      }
    }
    setFocusRequest(null)
  }, [focusRequest])

  const items = (section: PivotSection): PivotItem[] => draft[section] ?? []

  /////////////////////////////////////////////////////////////////////////
  // once OK was attempted, every change re-validates; when nothing is    //
  // missing any more the editor goes back to a clean state (Material)    //
  /////////////////////////////////////////////////////////////////////////
  const change = (section: PivotSection, list: PivotItem[]) => {
    const next: PivotDefinition = { ...draft }
    next[section] = list
    setDraft(next)
    if (attemptedSubmit) {
      const missing = countMissingValues(next)
      if (missing === 0) {
        setErrorAlert(null)
        setAttemptedSubmit(false)
      } else {
        setErrorAlert(missingValueMessage(missing))
      }
    }
  }

  const add = (section: PivotSection) => {
    const item: PivotItem = { key: nextPivotKey(), fieldName: null, extra: {} }
    if (section === 'values') item.function = null
    change(section, [...items(section), item])
    setFocusRequest([`${item.key}-field`])
  }

  const remove = (section: PivotSection, index: number) => {
    change(section, items(section).filter((_, i) => i !== index))
    setFocusRequest([`add-${section}`])
  }

  const setField = (section: PivotSection, index: number, fieldName: string | null) => {
    change(section, items(section).map((item, i) => {
      if (i !== index) return item
      const next: PivotItem = { ...item, fieldName }
      ///////////////////////////////////////////////////////////////////////////
      // if the newly selected field does not offer the chosen function, clear it //
      ///////////////////////////////////////////////////////////////////////////
      if (section === 'values' && fieldName && item.function && !functionsForField(findPivotField(tableMetaData, fieldName)).includes(item.function)) {
        next.function = null
      }
      return next
    }))
  }

  const setFunction = (index: number, aggregate: string | null) => {
    change('values', items('values').map((item, i) => (i === index ? { ...item, function: aggregate } : item)))
  }

  const itemLabel = (item: PivotItem) => (item.fieldName ? resolveFieldLabel(tableMetaData, item.fieldName).label : 'without a field')

  const move = (section: PivotSection, from: number, to: number, focus?: string[]) => {
    const list = items(section)
    if (from === to || to < 0 || to >= list.length) return
    const item = list[from]
    change(section, moveItem(list, from, to))
    setAnnouncement(`${capitalize(SECTION_NOUNS[section])} ${itemLabel(item)} moved to position ${to + 1} of ${list.length}.`)
    if (focus) setFocusRequest(focus.map((part) => `${item.key}-${part}`))
  }

  const ok = () => {
    const missing = countMissingValues(draft)
    if (missing > 0) {
      setAttemptedSubmit(true)
      setErrorAlert(missingValueMessage(missing))
      return
    }
    onSave(draft)
  }

  ///////////////////////////////////////////////////////////////////////////////
  // fields in use: a group-by may not reuse a row, column or value field; a    //
  // value may not reuse a row or column field (values may share a field)       //
  ///////////////////////////////////////////////////////////////////////////////
  const usedGroupByFields = new Set([...items('rows'), ...items('columns')].map((item) => item.fieldName).filter((name): name is string => Boolean(name)))
  const usedValueFields = new Set(items('values').map((item) => item.fieldName).filter((name): name is string => Boolean(name)))

  const renderFieldSelect = (section: PivotSection, item: PivotItem, index: number) => {
    const noun = SECTION_NOUNS[section]
    const hidden = section === 'values' ? usedGroupByFields : new Set([...usedGroupByFields, ...usedValueFields])
    const itemOptions = options.filter((option) => option.fieldName === item.fieldName || !hidden.has(option.fieldName))
    const unlisted = item.fieldName && !itemOptions.some((option) => option.fieldName === item.fieldName) ? item.fieldName : null
    const id = `${idPrefix}-${section}-${item.key}-field`
    const invalid = attemptedSubmit && !item.fieldName
    return (
      <>
        <label htmlFor={id} className="sr-only">{`${capitalize(noun)} ${index + 1} field`}</label>
        <select
          id={id}
          value={item.fieldName ?? ''}
          onChange={(event) => setField(section, index, event.target.value || null)}
          disabled={disabled}
          aria-required="true"
          aria-invalid={invalid || undefined}
          data-qqq-id={`pivot-editor-${noun}-${index}-field`}
          data-pivot-focus={`${item.key}-field`}
          className={cn(SELECT_CLASS, 'flex-1 basis-40', invalid && 'border-destructive')}
        >
          <option value="">{itemOptions.length === 0 ? 'There are no fields available.' : 'Select a field'}</option>
          {unlisted && <option value={unlisted}>{resolveFieldLabel(tableMetaData, unlisted).label}</option>}
          {grouped
            ? groupOptions(itemOptions).map(([group, groupItems]) => (
              <optgroup key={group} label={group}>
                {groupItems.map((option) => <option key={option.fieldName} value={option.fieldName}>{option.label}</option>)}
              </optgroup>
            ))
            : itemOptions.map((option) => <option key={option.fieldName} value={option.fieldName}>{option.label}</option>)}
        </select>
      </>
    )
  }

  const renderFunctionSelect = (item: PivotItem, index: number) => {
    const functions = functionsForField(findPivotField(tableMetaData, item.fieldName))
    const choices = item.function && !functions.includes(item.function) ? [item.function, ...functions] : functions
    const id = `${idPrefix}-values-${item.key}-function`
    const invalid = attemptedSubmit && !item.function
    return (
      <>
        <label htmlFor={id} className="sr-only">{`Value ${index + 1} function`}</label>
        <select
          id={id}
          value={item.function ?? ''}
          onChange={(event) => setFunction(index, event.target.value || null)}
          disabled={disabled}
          aria-required="true"
          aria-invalid={invalid || undefined}
          data-qqq-id={`pivot-editor-value-${index}-function`}
          data-pivot-focus={`${item.key}-function`}
          className={cn(SELECT_CLASS, 'flex-1 basis-32', invalid && 'border-destructive')}
        >
          <option value="">Select a function</option>
          {choices.map((aggregate) => <option key={aggregate} value={aggregate}>{PIVOT_FUNCTION_LABELS[aggregate] ?? aggregate}</option>)}
        </select>
      </>
    )
  }

  const renderItem = (section: PivotSection, item: PivotItem, index: number, count: number) => {
    const noun = SECTION_NOUNS[section]
    const position = index + 1
    const dragging = drag?.section === section && drag.index === index
    const over = dragOver?.section === section && dragOver.index === index && !dragging
    return (
      <div
        key={item.key}
        role="listitem"
        draggable={!disabled}
        onDragStart={(event) => {
          setDrag({ section, index })
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', `${noun} ${position}`)
        }}
        onDragOver={(event) => {
          if (drag?.section !== section) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setDragOver({ section, index })
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (drag?.section === section) move(section, drag.index, index)
          setDrag(null)
          setDragOver(null)
        }}
        onDragEnd={() => { setDrag(null); setDragOver(null) }}
        data-qqq-id={`pivot-editor-${noun}-${index}`}
        className={cn(
          'flex flex-wrap items-center gap-1.5 border-t-2 border-transparent py-1.5',
          dragging && 'opacity-50',
          over && 'border-primary'
        )}
      >
        <button
          type="button"
          disabled={disabled}
          aria-label={`Drag to reorder ${noun} ${position}`}
          title="Drag to reorder (or use arrow keys)"
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') { event.preventDefault(); move(section, index, index - 1, ['drag']) }
            if (event.key === 'ArrowDown') { event.preventDefault(); move(section, index, index + 1, ['drag']) }
          }}
          data-qqq-id={`pivot-editor-${noun}-${index}-drag`}
          data-pivot-focus={`${item.key}-drag`}
          className={cn(ICON_BUTTON_CLASS, 'cursor-grab')}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        {renderFieldSelect(section, item, index)}
        {section === 'values' && renderFunctionSelect(item, index)}
        <span className="flex items-center">
          <button
            type="button"
            onClick={() => move(section, index, index - 1, ['up', 'down', 'drag'])}
            disabled={disabled || index === 0}
            aria-label={`Move ${noun} ${position} up`}
            data-qqq-id={`pivot-editor-${noun}-${index}-up`}
            data-pivot-focus={`${item.key}-up`}
            className={ICON_BUTTON_CLASS}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => move(section, index, index + 1, ['down', 'up', 'drag'])}
            disabled={disabled || index === count - 1}
            aria-label={`Move ${noun} ${position} down`}
            data-qqq-id={`pivot-editor-${noun}-${index}-down`}
            data-pivot-focus={`${item.key}-down`}
            className={ICON_BUTTON_CLASS}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => remove(section, index)}
            disabled={disabled}
            aria-label={`Remove ${noun} ${position}`}
            data-qqq-id={`pivot-editor-${noun}-${index}-remove`}
            className={ICON_BUTTON_CLASS}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Edit Pivot Table</DialogPrimitive.Title>
      </div>

      <div ref={bodyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
        {errorAlert && (
          <div
            role="alert"
            data-qqq-id="pivot-editor-error"
            className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-red-800 dark:text-red-400"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{errorAlert}</span>
            <button
              type="button"
              onClick={() => setErrorAlert(null)}
              aria-label="Dismiss message"
              data-qqq-id="pivot-editor-error-dismiss"
              className={cn(ICON_BUTTON_CLASS, 'text-destructive hover:text-destructive')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((section) => {
            const list = items(section)
            const headingId = `${idPrefix}-${section}-heading`
            return (
              <section key={section} aria-labelledby={headingId} data-qqq-id={`pivot-editor-section-${section}`}>
                <h3 id={headingId} className="text-base font-semibold text-foreground">{SECTION_TITLES[section]}</h3>
                <div role="list" aria-labelledby={headingId} data-qqq-id={`pivot-editor-${section}`}>
                  {list.map((item, index) => renderItem(section, item, index, list.length))}
                </div>
                <button
                  type="button"
                  onClick={() => add(section)}
                  disabled={disabled}
                  data-qqq-id={`pivot-editor-add-${SECTION_NOUNS[section]}`}
                  data-pivot-focus={`add-${section}`}
                  className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add new {SECTION_NOUNS[section]}
                </button>
              </section>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-border bg-muted px-4 py-3 sm:px-6 sm:py-4">
        <button
          type="button"
          onClick={onCancel}
          data-qqq-id="pivot-editor-cancel"
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 pointer-coarse:min-h-11"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </button>
        <button
          type="button"
          onClick={ok}
          disabled={disabled}
          data-qqq-id="pivot-editor-ok"
          className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          OK
        </button>
      </div>
    </>
  )
}
