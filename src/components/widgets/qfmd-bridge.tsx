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
 * @file qfmd-bridge — the `qfmdBridge` object a customComponent widget's component receives,
 * with the Material dashboard's contract (`QFMDBridge`: makeAlert, makeButton, makeForm,
 * makeModal, makeWidget, makeIcon), built from this dashboard's own components, so bundles
 * written for the Material dashboard render the same pieces here. Also exposes React and
 * ReactDOM as `window.React` / `window.ReactDOM` for those bundles, as Material does.
 */
'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'

import type { QFieldMetaData, QRecord } from '@/types'
import type { QContextType } from '@/lib/context/q-context'
import { useMetaData } from '@/lib/hooks/use-metadata'
import { cn } from '@/lib/utils/cn'
import { DynamicForm } from '@/components/forms/DynamicForm'
import type { BlockActionCallback } from './widget-types'
import { isPlainObject } from './widget-types'
import { widgetField } from './widget-field-values'
import { WidgetIcon } from './WidgetIcon'
import { ConnectedWidget } from './ConnectedWidget'

/** A record as a bundle passes it: Material's `QRecord` (Map values) or a plain `{ values }` object. */
export type BridgeRecord = { values?: Map<string, unknown> | Record<string, unknown>; displayValues?: Map<string, unknown> | Record<string, unknown> } | undefined

/** Why a bridge modal is asked to close (Material's MUI Modal reasons). */
export type BridgeModalCloseReason = 'backdropClick' | 'escapeKeyDown'

/** The Material dashboard's `QFMDBridge` contract. */
export interface QfmdBridge {
  /** An alert with the text (one line per `\n`) in a color: success, info, warning or error. */
  makeAlert: (text: string, color: string, mayManuallyClose?: boolean) => React.ReactElement
  /** A full-width button. */
  makeButton: (label: string, onClick: () => void, extra?: Record<string, unknown>) => React.ReactElement
  /** A form for the fields, seeded from the record; reports each change and the submitted values. */
  makeForm: (fields: unknown[], record: BridgeRecord, handleChange: (fieldName: string, newValue: unknown) => void,
    handleSubmit: (values: Record<string, unknown>) => void, helpRoles?: string[], helpContentKeyPrefix?: string) => React.ReactElement
  /** A modal dialog, open until closed (by `onClose`, or on Escape or a click outside when there is none). */
  makeModal: (children: React.ReactElement, onClose?: (setIsOpen: (isOpen: boolean) => void, event: unknown, reason: BridgeModalCloseReason) => void,
    qContext?: Partial<QContextType>, modalIdentifier?: string) => React.ReactElement
  /** A widget of the instance, with its data loaded for the record. */
  makeWidget: (widgetName: string, tableName?: string, entityPrimaryKey?: string, record?: BridgeRecord, actionCallback?: BlockActionCallback) => React.ReactElement
  /** A Material icon by name. */
  makeIcon: (name: string) => React.ReactElement
}

/**
 * Reads a bridge record's values, from a Map (Material's `QRecord`) or a plain object.
 *
 * @param source - Record values.
 * @returns The values as a plain object.
 */
function plainValues(source: Map<string, unknown> | Record<string, unknown> | undefined): Record<string, unknown> {
  if (source instanceof Map) return Object.fromEntries(source.entries())
  return isPlainObject(source) ? { ...source } : {}
}

/**
 * Normalizes a bundle's field (a Material `QFieldMetaData` instance or a plain object).
 *
 * @param field - The field.
 * @returns Field metadata.
 */
function bridgeField(field: unknown): QFieldMetaData {
  const source = isPlainObject(field) ? field : {}
  const adornments = Array.isArray(source.adornments) ? source.adornments : source.adornments instanceof Map ? [] : undefined
  return widgetField({ ...source, adornments })
}

/** Alert classes by Material color name. */
const ALERT_COLORS: Record<string, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
}

/**
 * The bridge alert (Material `QFMDBridgeAlert`).
 *
 * @param props - Alert properties.
 * @param props.text - Alert text; each `\n` starts a line.
 * @param props.color - success, info, warning or error.
 * @param props.mayManuallyClose - Whether a close button dismisses it.
 * @returns The alert, or nothing once dismissed.
 */
function BridgeAlert({ text, color, mayManuallyClose }: { text: string; color: string; mayManuallyClose?: boolean }) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  const tone = ALERT_COLORS[color] ? color : 'info'
  return (
    <div role="alert" className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', ALERT_COLORS[tone])} data-qqq-id="bridge-alert" data-color={tone}>
      <div className="min-w-0 flex-1">
        {String(text ?? '').split('\n').map((line, index) => <div key={index}>{line}</div>)}
      </div>
      {mayManuallyClose && (
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" data-qqq-id="button-bridge-alert-close"
          className="rounded p-1 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-ring">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/**
 * The bridge button (Material `QFMDBridgeButton`: a full-width MDButton). `extra` may set
 * `disabled` and a `variant` of `outlined` or `text`.
 *
 * @param props - Button properties.
 * @param props.label - Button text.
 * @param props.onClick - Click handler.
 * @param props.extra - Extra button properties.
 * @returns The button.
 */
function BridgeButton({ label, onClick, extra }: { label: string; onClick: () => void; extra?: Record<string, unknown> }) {
  const variant = extra?.variant === 'outlined' ? 'outlined' : extra?.variant === 'text' ? 'text' : 'filled'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={extra?.disabled === true}
      className={cn(
        'inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'filled' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'outlined' && 'border border-input bg-card text-foreground hover:bg-accent',
        variant === 'text' && 'text-primary hover:bg-accent'
      )}
      data-qqq-id="bridge-button"
    >
      {label}
    </button>
  )
}

/**
 * The bridge form (Material `QFMDBridgeForm`): the fields seeded from the record (else each
 * field's default value), reporting every change to `handleChange` and the values to
 * `handleSubmit` when the form is submitted (Enter in a field).
 *
 * @param props - Form properties.
 * @param props.fields - The fields.
 * @param props.record - The record whose values seed the form.
 * @param props.handleChange - Called with a field name and its new value on each change.
 * @param props.handleSubmit - Called with every value on submit.
 * @param props.helpRoles - Screen roles for field help content.
 * @returns The form.
 */
function BridgeForm({ fields, record, handleChange, handleSubmit, helpRoles }: {
  fields: unknown[]; record: BridgeRecord; handleChange: (fieldName: string, newValue: unknown) => void
  handleSubmit: (values: Record<string, unknown>) => void; helpRoles?: string[]
}) {
  const [typedFields] = useState(() => (Array.isArray(fields) ? fields : []).map(bridgeField))
  const [defaults] = useState(() => {
    const values = plainValues(record?.values)
    return Object.fromEntries(typedFields.map((field) => {
      const value = values[field.name] ?? field.defaultValue
      return [field.name, field.type === 'BOOLEAN' ? value === true || value === 'true' : value ?? '']
    }))
  })
  const { register, control, formState: { errors }, watch, handleSubmit: submit } = useForm<Record<string, unknown>>({ defaultValues: defaults })
  const changeRef = useRef(handleChange)
  changeRef.current = handleChange

  // Report each changed value, as Material's bridge form does from its Formik render.
  useEffect(() => {
    const last: Record<string, unknown> = { ...defaults }
    const subscription = watch((values) => {
      for (const [name, value] of Object.entries(values)) {
        if (last[name] !== value) {
          last[name] = value
          changeRef.current(name, value)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, defaults])

  const displayValues = plainValues(record?.displayValues)
  const formRecord: QRecord = {
    tableName: '',
    values: plainValues(record?.values),
    displayValues: Object.fromEntries(Object.entries(displayValues).map(([key, value]) => [key, String(value)])),
  }
  return (
    <form onSubmit={submit((values) => handleSubmit(values))} noValidate data-qqq-id="bridge-form">
      <DynamicForm register={register} control={control} errors={errors} fields={typedFields} record={formRecord} helpRoles={helpRoles}
        possibleValueContext={{ type: 'standalone' }} />
      {/* implicit submission (Enter in a field) needs a submit button; it is not a visible control */}
      <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only">Submit</button>
    </form>
  )
}

/**
 * The bridge modal (Material `QFMDBridgeModal`): open when made; Escape and a click outside
 * call `onClose(setIsOpen, event, reason)`, or close it when there is no `onClose`. It is
 * pushed on the caller's modal stack while open, as in Material.
 *
 * @param props - Modal properties.
 * @param props.children - The modal content.
 * @param props.onClose - Close handler.
 * @param props.qContext - Context whose modal stack tracks the modal.
 * @param props.modalIdentifier - The modal's name on that stack.
 * @returns The modal.
 */
function BridgeModal({ children, onClose, qContext, modalIdentifier }: {
  children: React.ReactNode; onClose?: (setIsOpen: (isOpen: boolean) => void, event: unknown, reason: BridgeModalCloseReason) => void
  qContext?: Partial<QContextType>; modalIdentifier?: string
}) {
  const [open, setOpen] = useState(true)
  const [identifier] = useState(() => modalIdentifier ?? `anonymousModal:${Date.now()}`)
  const contextRef = useRef(qContext)

  useEffect(() => {
    contextRef.current?.pushModalOnStack?.(identifier)
  }, [identifier])

  const setIsOpen = (isOpen: boolean) => {
    if (!isOpen) contextRef.current?.popModalOffStack?.(identifier)
    setOpen(isOpen)
  }
  const close = (event: Event, reason: BridgeModalCloseReason) => {
    event.preventDefault()
    if (onClose) onClose(setIsOpen, event, reason)
    else setIsOpen(false)
  }

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => close(event, 'escapeKeyDown')}
          onPointerDownOutside={(event) => close(event, 'backdropClick')}
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2.5rem)] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-lg"
          data-qqq-id="bridge-modal"
        >
          <DialogPrimitive.Title className="sr-only">{identifier.startsWith('anonymousModal:') ? 'Dialog' : identifier}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * The bridge widget (Material `QFMDBridgeWidget`): the named widget of the instance with
 * its data loaded for the record (its values, plus `id` and `tableName` when given).
 *
 * @param props - Widget properties.
 * @param props.widgetName - The widget's name.
 * @param props.tableName - The hosting table.
 * @param props.entityPrimaryKey - The hosting record's primary key.
 * @param props.record - The hosting record.
 * @param props.actionCallback - Callback for the widget's interactive blocks.
 * @returns The widget.
 */
function BridgeWidget({ widgetName, tableName, entityPrimaryKey, record, actionCallback }: {
  widgetName: string; tableName?: string; entityPrimaryKey?: string; record?: BridgeRecord; actionCallback?: BlockActionCallback
}) {
  const { data: instance, isLoading } = useMetaData()
  const widgetMetaData = instance?.widgets?.[widgetName]
  if (isLoading) return <div className="py-4 text-sm text-muted-foreground" role="status">Loading...</div>
  if (!widgetMetaData) {
    return <p role="alert" className="text-sm text-destructive" data-qqq-id={`bridge-widget-error-${widgetName}`}>Error: Could not load widget [{widgetName}]</p>
  }
  const params: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(plainValues(record?.values))) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') params[key] = value
  }
  if (entityPrimaryKey !== undefined && entityPrimaryKey !== null) params.id = entityPrimaryKey
  if (tableName) params.tableName = tableName
  return (
    <div className={`bridgedWidget ${widgetMetaData.type ?? ''}`} data-qqq-id={`bridge-widget-${widgetName}`}>
      <ConnectedWidget widgetMetaData={widgetMetaData} params={params} actionCallback={actionCallback}
        recordContext={tableName ? { tableName, recordId: entityPrimaryKey } : undefined} />
    </div>
  )
}

/** The bridge handed to every customComponent widget's component. */
export const qfmdBridge: QfmdBridge = {
  makeAlert: (text, color, mayManuallyClose) => <BridgeAlert text={text} color={color} mayManuallyClose={mayManuallyClose} />,
  makeButton: (label, onClick, extra) => <BridgeButton label={label} onClick={onClick} extra={extra} />,
  makeForm: (fields, record, handleChange, handleSubmit, helpRoles) => (
    <BridgeForm fields={fields} record={record} handleChange={handleChange} handleSubmit={handleSubmit} helpRoles={helpRoles} />
  ),
  makeModal: (children, onClose, qContext, modalIdentifier) => (
    <BridgeModal onClose={onClose} qContext={qContext} modalIdentifier={modalIdentifier}>{children}</BridgeModal>
  ),
  makeWidget: (widgetName, tableName, entityPrimaryKey, record, actionCallback) => (
    <BridgeWidget widgetName={widgetName} tableName={tableName} entityPrimaryKey={entityPrimaryKey} record={record} actionCallback={actionCallback} />
  ),
  makeIcon: (name) => <WidgetIcon name={name} />,
}

/**
 * Exposes React and ReactDOM (with the React 19 `react-dom/client` roots) as `window.React`
 * and `window.ReactDOM` for dynamically loaded bundles, as Material's index.tsx does, so a
 * bundle's components share this dashboard's React (hooks work, elements are compatible).
 */
export function exposeReactGlobals(): void {
  if (typeof window === 'undefined') return
  const target = window as unknown as Record<string, unknown>
  target.React ??= React
  target.ReactDOM ??= { ...ReactDOM, ...ReactDOMClient }
}
