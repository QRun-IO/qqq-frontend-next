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
 * @file RowBuilderEditor — the editing mode of a `rowBuilder` widget inside a form (Material
 * `RowBuilderWidget` with `isEditable`): rows edited inline or in the "Edit Rows" modal,
 * added with the widget's defaults, removed, reordered by drag or keyboard, validated
 * before the host form saves, and written to the host form as record associations, a
 * field or a process value.
 */
'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Check, Plus } from 'lucide-react'

import type { QFieldMetaData, QWidgetMetaData } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { cn } from '@/lib/utils/cn'

import { WidgetHeaderLinkButton } from './WidgetHeaderControls'
import { RowBuilderRowForm } from './RowBuilderRowForm'
import type { RowDragHandlers, RowFormHandle, RowScope } from './RowBuilderRowForm'
import { RowBuilderTable } from './RowBuilderTable'
import {
  newRow, outputRows, rowErrorMessages, rowErrors, rowFormValues, seedRows, wireValueFromForm,
} from './row-builder-model'
import type { BuilderRow, RowBuilderConfig, RowBuilderRecord } from './row-builder-model'
import type { WidgetFormContext } from './widget-types'

/** Props for {@link RowBuilderEditor}. */
export interface RowBuilderEditorProps {
  /** Widget metadata. */
  widgetMetaData: QWidgetMetaData
  /** Configuration from the widget's default values. */
  config: RowBuilderConfig
  /** Row fields. */
  fields: QFieldMetaData[]
  /** Records the rows start from. */
  initialRecords: RowBuilderRecord[]
  /** The payload's defaults for new rows. */
  defaultValuesForNewRecords?: Record<string, unknown>
  /** The payload's values written to the host form as they are. */
  hiddenValues?: Record<string, unknown>
  /** Title of the modal editor. */
  modalTitle: string
  /** The host form. */
  formContext: WidgetFormContext
}

/** Where focus goes after the next render: a row's first field, or a control by `data-qqq-id`. */
type PendingFocus = { scope: RowScope; rowKey: number } | { scope: RowScope; qqqId: string }

/**
 * Moves one item of a list.
 *
 * @param rows - The list.
 * @param from - Position of the item.
 * @param to - Its new position.
 * @returns A new list.
 */
function moveRow(rows: BuilderRow[], from: number, to: number): BuilderRow[] {
  const next = [...rows]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * A copy of rows the modal edits, so Cancel leaves the widget's rows as they were.
 *
 * @param rows - The widget's rows.
 * @returns Independent copies.
 */
function cloneRows(rows: BuilderRow[]): BuilderRow[] {
  return rows.map((row) => ({ key: row.key, values: { ...row.values }, displayValues: { ...row.displayValues } }))
}

/**
 * Edits a row builder's rows inside a host form.
 *
 * @param props - See {@link RowBuilderEditorProps}.
 * @returns The editor.
 */
export function RowBuilderEditor({
  widgetMetaData, config, fields, initialRecords, defaultValuesForNewRecords, hiddenValues, modalTitle, formContext,
}: RowBuilderEditorProps) {
  const widgetName = widgetMetaData.name
  const disabled = formContext.disabled === true
  const enforceMaxLength = formContext.screen === 'processStep'
  const mayReorder = config.mayReorderRows
  const possibleValueContext = useMemo<PossibleValueContext>(() => ({ type: 'standalone' }), [])
  const fieldsByName = useMemo(() => new Map(fields.map((field) => [field.name, field])), [fields])

  const [seed] = useState(() => seedRows(initialRecords, config))
  const [rows, setRows] = useState<BuilderRow[]>(seed.rows)
  const [modalRows, setModalRows] = useState<BuilderRow[] | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [dragState, setDragState] = useState<{ key: number | null; over: number | null }>({ key: null, over: null })

  // the rows as of the last change, read by event handlers and the host's validator
  const rowsRef = useRef(rows)
  const modalRowsRef = useRef<BuilderRow[] | null>(null)
  const nextKeyRef = useRef(seed.nextKey)
  const handlesRef = useRef<Record<RowScope, Map<number, RowFormHandle>>>({ edit: new Map(), modal: new Map() })
  const pendingFocusRef = useRef<PendingFocus | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const modalContentRef = useRef<HTMLDivElement>(null)
  const formContextRef = useRef(formContext)
  formContextRef.current = formContext

  const modalOpen = modalRows !== null
  const restoreFocus = useRestoreFocus(modalOpen)

  /**
   * Writes the rows to the host form, as Material's `onSaveCallback` hosts do: the
   * association's records on a record form that names one, else the rows as JSON under
   * the output field name (a field of the record, or a process value).
   */
  const emit = useCallback((next: BuilderRow[]) => {
    const context = formContextRef.current
    if (config.associationName && context.screen !== 'processStep') {
      context.setAssociation(config.associationName, outputRows(next, fields, config, false))
    } else {
      context.setValues({ [config.outputFieldName]: JSON.stringify(outputRows(next, fields, config, true)) })
    }
  }, [config, fields])

  /**
   * Applies a change to the inline rows (written to the host form) or the modal's rows.
   *
   * @param scope - Which rows.
   * @param compute - The change.
   */
  const change = useCallback((scope: RowScope, compute: (current: BuilderRow[]) => BuilderRow[]) => {
    const resequence = (list: BuilderRow[]) => (mayReorder && config.orderByFieldName
      ? list.map((row, index) => (row.values[config.orderByFieldName as string] === index
        ? row
        : { ...row, values: { ...row.values, [config.orderByFieldName as string]: index } }))
      : list)
    if (scope === 'modal') {
      const next = resequence(compute(modalRowsRef.current ?? []))
      modalRowsRef.current = next
      setModalRows(next)
      return
    }
    const next = resequence(compute(rowsRef.current))
    rowsRef.current = next
    setRows(next)
    emit(next)
  }, [config.orderByFieldName, emit, mayReorder])

  const onFieldChange = useCallback((scope: RowScope, rowKey: number, fieldName: string, value: unknown) => {
    const field = fieldsByName.get(fieldName)
    if (!field || fieldName === config.orderByFieldName) return
    const wire = wireValueFromForm(field, value)
    change(scope, (current) => current.map((row) => {
      if (row.key !== rowKey) return row
      if (row.values[fieldName] === wire) return row
      const displayValues = { ...row.displayValues }
      delete displayValues[fieldName]
      return { ...row, values: { ...row.values, [fieldName]: wire }, displayValues }
    }))
  }, [change, config.orderByFieldName, fieldsByName])

  const addRow = useCallback((scope: RowScope) => {
    const key = nextKeyRef.current++
    change(scope, (current) => [...current, newRow(key, current.length, config, formContextRef.current.values, defaultValuesForNewRecords)])
    pendingFocusRef.current = { scope, rowKey: key }
  }, [change, config, defaultValuesForNewRecords])

  const removeRow = useCallback((scope: RowScope, rowKey: number) => {
    const current = scope === 'modal' ? modalRowsRef.current ?? [] : rowsRef.current
    const index = current.findIndex((row) => row.key === rowKey)
    if (index < 0) return
    change(scope, (list) => list.filter((row) => row.key !== rowKey))
    setAnnouncement(`Removed row ${index + 1}`)
    const remaining = current.length - 1
    pendingFocusRef.current = {
      scope,
      qqqId: remaining === 0 ? `row-builder-add-${widgetName}` : `row-builder-remove-${widgetName}-${Math.min(index, remaining - 1)}`,
    }
  }, [change, widgetName])

  const moveTo = useCallback((scope: RowScope, rowKey: number, to: number, control: 'up' | 'down' | 'drag') => {
    const current = scope === 'modal' ? modalRowsRef.current ?? [] : rowsRef.current
    const from = current.findIndex((row) => row.key === rowKey)
    if (from < 0 || to < 0 || to >= current.length || to === from) return
    change(scope, (list) => moveRow(list, from, to))
    setAnnouncement(`Moved row ${from + 1} to position ${to + 1} of ${current.length}`)
    const button = control === 'drag' ? 'drag' : control === 'up' ? 'move-up' : 'move-down'
    pendingFocusRef.current = { scope, qqqId: `row-builder-${button}-${widgetName}-${to}` }
  }, [change, widgetName])

  const moveBy = useCallback((scope: RowScope, rowKey: number, delta: number, control: 'up' | 'down' | 'drag') => {
    const current = scope === 'modal' ? modalRowsRef.current ?? [] : rowsRef.current
    const from = current.findIndex((row) => row.key === rowKey)
    moveTo(scope, rowKey, from + delta, control)
  }, [moveTo])

  /**
   * Validates rows: mounted rows show their messages on their fields (the first invalid
   * one takes focus when asked); rows without a form are checked from their values.
   *
   * @param scope - Which rows.
   * @param list - The rows.
   * @param focusFirstError - Move focus to the first invalid field.
   * @returns One message per invalid field, naming its row.
   */
  const validateRows = useCallback((scope: RowScope, list: BuilderRow[], focusFirstError: boolean): string[] => {
    const found: string[] = []
    list.forEach((row, index) => {
      const handle = handlesRef.current[scope].get(row.key)
      const errors = handle
        ? handle.validate(focusFirstError && found.length === 0)
        : rowErrors(fields, rowFormValues(fields, row), enforceMaxLength)
      found.push(...rowErrorMessages(index + 1, errors))
    })
    return found
  }, [enforceMaxLength, fields])

  // the host form runs this before it saves or submits (Material `addSubValidations`)
  const validateRef = useRef<() => string[]>(() => [])
  validateRef.current = () => {
    if (config.useModalEditor) {
      // no field editors are shown: list the problems in the widget
      const found = validateRows('edit', rowsRef.current, false)
      setMessages(found)
      return found
    }
    return validateRows('edit', rowsRef.current, true)
  }
  useEffect(() => {
    formContextRef.current.registerValidator(widgetName, () => validateRef.current())
    return () => formContextRef.current.registerValidator(widgetName, null)
  }, [widgetName])

  // the payload's hidden values go to the host form as they are (Material `buildInitialValues`)
  useEffect(() => {
    if (hiddenValues && Object.keys(hiddenValues).length > 0) formContextRef.current.setValues({ ...hiddenValues })
  }, [hiddenValues])

  // after a row is added, removed or moved, put focus where the user expects it
  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending) return
    pendingFocusRef.current = null
    if ('rowKey' in pending) {
      handlesRef.current[pending.scope].get(pending.rowKey)?.focusFirstField()
      return
    }
    const root = pending.scope === 'modal' ? modalContentRef.current : containerRef.current
    root?.querySelector<HTMLElement>(`[data-qqq-id="${CSS.escape(pending.qqqId)}"]`)?.focus()
  })

  // a spoken announcement is cleared a little later, so the same one can be repeated
  useEffect(() => {
    if (!announcement) return
    const timer = setTimeout(() => setAnnouncement(''), 3000)
    return () => clearTimeout(timer)
  }, [announcement])

  const registerRow = useMemo<Record<RowScope, (rowKey: number, handle: RowFormHandle | null) => void>>(() => ({
    edit: (rowKey, handle) => { if (handle) handlesRef.current.edit.set(rowKey, handle); else handlesRef.current.edit.delete(rowKey) },
    modal: (rowKey, handle) => { if (handle) handlesRef.current.modal.set(rowKey, handle); else handlesRef.current.modal.delete(rowKey) },
  }), [])

  const scopeHandlers = useMemo(() => {
    const make = (scope: RowScope) => ({
      onFieldChange: (rowKey: number, fieldName: string, value: unknown) => onFieldChange(scope, rowKey, fieldName, value),
      onRemove: (rowKey: number) => removeRow(scope, rowKey),
      onMove: (rowKey: number, delta: number, control: 'up' | 'down' | 'drag') => moveBy(scope, rowKey, delta, control),
    })
    return { edit: make('edit'), modal: make('modal') }
  }, [moveBy, onFieldChange, removeRow])

  const dragHandlers = useMemo<Record<RowScope, RowDragHandlers>>(() => {
    const make = (scope: RowScope): RowDragHandlers => ({
      draggingKey: dragState.key,
      overIndex: dragState.over,
      onDragStart: (rowKey, event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(rowKey))
        setDragState({ key: rowKey, over: null })
      },
      onDragOver: (index, event) => {
        if (dragState.key === null) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (dragState.over !== index) setDragState({ key: dragState.key, over: index })
      },
      onDrop: (index, event) => {
        if (dragState.key === null) return
        event.preventDefault()
        moveTo(scope, dragState.key, index, 'drag')
        setDragState({ key: null, over: null })
      },
      onDragEnd: () => setDragState({ key: null, over: null }),
    })
    return { edit: make('edit'), modal: make('modal') }
  }, [dragState, moveTo])

  const openModal = () => {
    const copy = cloneRows(rowsRef.current)
    modalRowsRef.current = copy
    setModalRows(copy)
  }

  const cancelModal = () => {
    modalRowsRef.current = null
    setModalRows(null)
  }

  const applyModal = () => {
    const edited = modalRowsRef.current ?? []
    if (validateRows('modal', edited, true).length > 0) return
    rowsRef.current = edited
    setRows(edited)
    setMessages([])
    emit(edited)
    cancelModal()
  }

  /**
   * The editable rows of one list and its add button.
   *
   * @param scope - Inline or modal.
   * @param list - The rows.
   * @returns The list.
   */
  const renderRows = (scope: RowScope, list: BuilderRow[]) => (
    <div className="space-y-2" data-qqq-id={`row-builder-${scope}-rows-${widgetName}`}>
      {list.map((row, index) => (
        <RowBuilderRowForm
          key={row.key}
          widgetName={widgetName}
          scope={scope}
          row={row}
          index={index}
          rowCount={list.length}
          fields={fields}
          mayReorder={mayReorder}
          disabled={disabled}
          enforceMaxLength={enforceMaxLength}
          possibleValueContext={possibleValueContext}
          onFieldChange={scopeHandlers[scope].onFieldChange}
          onRemove={scopeHandlers[scope].onRemove}
          onMove={scopeHandlers[scope].onMove}
          registerRow={registerRow[scope]}
          drag={dragHandlers[scope]}
        />
      ))}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => addRow(scope)}
          disabled={disabled}
          data-qqq-id={`row-builder-add-${widgetName}`}
          className={cn(
            'inline-flex min-h-9 items-center gap-1 rounded-xl border border-input bg-background px-4 py-1.5 text-sm text-foreground',
            'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:min-h-11',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add new
        </button>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="space-y-3" data-qqq-id={`widget-rowBuilder-${widgetName}`}>
      {(config.inlineHeading || config.useModalEditor) && (
        <div className="flex items-center justify-between gap-2">
          {config.inlineHeading
            ? <h4 className="text-base font-semibold text-foreground" data-qqq-id={`row-builder-heading-${widgetName}`}>{config.inlineHeading}</h4>
            : <span />}
          {config.useModalEditor && (
            <WidgetHeaderLinkButton label="Edit" onClick={openModal} disabled={disabled} qqqId={`row-builder-edit-${widgetName}`} />
          )}
        </div>
      )}
      {fields.length === 0 && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-qqq-id={`row-builder-config-error-${widgetName}`}>
          Configuration error: No fields were defined for this widget
        </p>
      )}
      {config.useModalEditor
        ? <RowBuilderTable widgetName={widgetName} caption={widgetMetaData.label} fields={fields} rows={rows} />
        : renderRows('edit', rows)}
      {messages.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-qqq-id={`row-builder-errors-${widgetName}`}>
          <ul className="list-disc pl-5">
            {messages.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}
      <div aria-live="polite" className="sr-only" data-qqq-id={`row-builder-status-${widgetName}`}>{modalOpen ? '' : announcement}</div>

      {config.useModalEditor && (
        <DialogPrimitive.Root open={modalOpen} onOpenChange={(open) => { if (!open) cancelModal() }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
            <DialogPrimitive.Content
              ref={modalContentRef}
              aria-describedby={undefined}
              data-qqq-id={`row-builder-modal-${widgetName}`}
              className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card shadow-lg focus:outline-none"
              onOpenAutoFocus={(event) => {
                const first = modalRowsRef.current?.[0]
                const handle = first ? handlesRef.current.modal.get(first.key) : undefined
                if (handle) {
                  event.preventDefault()
                  handle.focusFirstField()
                }
              }}
              onCloseAutoFocus={restoreFocus}
              // an outside click does not throw away the edits (as in Material); Escape cancels
              onInteractOutside={(event) => event.preventDefault()}
            >
              <div className="border-b border-border px-6 py-4">
                <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{modalTitle}</DialogPrimitive.Title>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                {modalRows && renderRows('modal', modalRows)}
              </div>
              <div aria-live="polite" className="sr-only">{modalOpen ? announcement : ''}</div>
              <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-border bg-muted px-6 py-4">
                <button
                  type="button"
                  onClick={cancelModal}
                  data-qqq-id={`row-builder-modal-cancel-${widgetName}`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 pointer-coarse:min-h-11"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyModal}
                  disabled={disabled}
                  data-qqq-id={`row-builder-modal-ok-${widgetName}`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  OK
                </button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </div>
  )
}
