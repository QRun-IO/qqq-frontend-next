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
 * @file ProcessBlocks — composite widget blocks inside a process screen (ad hoc WIDGET
 * components and named composite widgets), rendered by the shared composite renderer
 * (`QqqComposite`: every block type, layout and style) with the process screen as its
 * host, as Material's ProcessRun hosts `CompositeWidget`:
 *
 * - TEXT interpolates `${value}` placeholders; a block whose `conditional` value is
 *   false is left out;
 * - INPUT_FIELD blocks are typed inputs in the screen's form, seeded from the process
 *   value of their field; with `submitOnEnter`, Enter submits the screen, and an entry
 *   of `->code` submits it with that `actionCode` instead of the text;
 * - BUTTON blocks with an `actionCode` submit the screen with it; a `controlCode`
 *   (`showModal:x`, `hideModal:x`, `toggleModal:x`) shows, hides or toggles the
 *   modal-mode composite (or `conditional` blocks) named `x`.
 */

'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

import type { QFieldMetaData, QWidgetMetaData } from '@/types'
import type { BlockActionCallback, QqqBlockData, QqqCompositeData } from '@/components/widgets/widget-types'
import { cn } from '@/lib/utils/cn'

import { BlockInputEditor, needsBlockInputEditor } from '@/components/widgets/blocks/BlockInputEditor'
import { QqqComposite } from '@/components/widgets/blocks/QqqComposite'
import { CompositeHostContext, type CompositeHost, type HostInputFieldProps } from '@/components/widgets/blocks/composite-host'
import { blockQqqId, blockValues } from '@/components/widgets/blocks/block-utils'
import { useProcessStep } from './ProcessStepContext'

/** A composite widget block as serialized by the backend. */
export interface ProcessBlockData {
  /** Registered-route name (`TEXT`, `BUTTON`, `INPUT_FIELD`, `COMPOSITE`, ...). */
  blockTypeName?: string
  /** Versioned-route name for the same thing. */
  blockType?: string
  values?: Record<string, unknown>
  /** Process value name that must be truthy for the block to show. */
  conditional?: string
  /** Nested blocks of a COMPOSITE block. */
  blocks?: ProcessBlockData[]
}

/**
 * Read a block list from composite widget data or component values.
 * @param source - Object with a `blocks` (or v1 `subBlocks`) array.
 * @returns The blocks.
 */
export function readBlocks(source: unknown): ProcessBlockData[] {
  if (!source || typeof source !== 'object') return []
  // v1 process metadata nests a composite's blocks as `subBlocks`
  const blocks = (source as { blocks?: unknown }).blocks ?? (source as { subBlocks?: unknown }).subBlocks
  return Array.isArray(blocks) ? blocks.filter((block): block is ProcessBlockData => Boolean(block) && typeof block === 'object') : []
}

/**
 * The block's type name, whichever route produced it.
 * @param block - The block.
 * @returns Upper-case type name.
 */
export function blockTypeOf(block: ProcessBlockData): string {
  return String(block.blockTypeName ?? block.blockType ?? '').toUpperCase()
}

/**
 * Give a block tree the shape the shared composite renderer reads: `blockTypeName`
 * (v1 sends `blockType`) and nested `blocks` (v1 sends `subBlocks`).
 * @param blocks - Blocks as the backend sent them.
 * @returns The same blocks in block-data shape.
 */
export function normalizeBlocks(blocks: ProcessBlockData[]): QqqBlockData[] {
  return blocks.map((block) => {
    const type = blockTypeOf(block)
    const nested = readBlocks(block)
    const { blockType: _blockType, subBlocks: _subBlocks, ...rest } = block as ProcessBlockData & { subBlocks?: unknown }
    void _blockType
    void _subBlocks
    return { ...rest, blockTypeName: type, ...(type === 'COMPOSITE' || nested.length > 0 ? { blocks: normalizeBlocks(nested) } : {}) } as QqqBlockData
  })
}

/**
 * Collect the input-field definitions of a block tree (they become form fields).
 * @param blocks - Blocks to scan.
 * @returns Field definitions of every INPUT_FIELD block.
 */
export function inputFieldsOfBlocks(blocks: ProcessBlockData[]): QFieldMetaData[] {
  const fields: QFieldMetaData[] = []
  for (const block of blocks) {
    const type = blockTypeOf(block)
    if (type === 'COMPOSITE') fields.push(...inputFieldsOfBlocks(readBlocks(block)))
    const field = block.values?.fieldMetaData
    if (type === 'INPUT_FIELD' && field && typeof field === 'object' && typeof (field as QFieldMetaData).name === 'string') {
      fields.push(field as QFieldMetaData)
    }
  }
  return fields
}

/**
 * HTML input type for an INPUT_FIELD block's field (Material renders a typed dynamic form field).
 * @param type - The field's QQQ type.
 * @returns The input `type`.
 */
function inputType(type: unknown): string {
  switch (type) {
    case 'INTEGER':
    case 'LONG':
    case 'DECIMAL':
      return 'number'
    case 'DATE':
      return 'date'
    case 'DATE_TIME':
      return 'datetime-local'
    case 'TIME':
      return 'time'
    case 'PASSWORD':
      return 'password'
    default:
      return 'text'
  }
}

/** The block action callback of the current process screen. */
const ProcessBlockActionContext = createContext<BlockActionCallback | undefined>(undefined)

/**
 * The action callback for blocks on this process screen (buttons and control codes).
 * @returns The callback, or `undefined` outside a process screen.
 */
export function useProcessBlockAction(): BlockActionCallback | undefined {
  return useContext(ProcessBlockActionContext)
}

/**
 * An INPUT_FIELD block as a typed input in the screen's form.
 * @param props - The block and its widget name.
 * @returns The labeled input.
 */
function ProcessInputField({ block, widgetName }: HostInputFieldProps) {
  const { form, isWorking, requestSubmit, processName, formFields, inputFieldNames, values: processValues } = useProcessStep()
  const values = blockValues(block)
  const field = values.fieldMetaData as QFieldMetaData | undefined
  if (!field || typeof field.name !== 'string' || field.isHidden) return null
  const submitInput = (entered: string) => {
    if (values.submitOnEnter !== true) return
    if (entered.startsWith('->')) {
      form.setValue(field.name, '')
      requestSubmit({ actionCode: entered.substring(2) })
      return
    }
    if (['STRING', 'TEXT', 'HTML', 'PASSWORD'].includes(field.type)) form.setValue(field.name, entered, { shouldDirty: true })
    if (field.isRequired && entered === '') {
      void form.trigger(field.name)
      return
    }
    requestSubmit()
  }
  if (field.type === 'BLOB' || needsBlockInputEditor(field)) {
    const processField = formFields.some((item) => item.name === field.name) && !inputFieldNames.has(field.name)
    return <div data-qqq-id={blockQqqId('INPUT_FIELD', widgetName)} data-block-type="INPUT_FIELD" data-block-id={block.blockId}>
      <BlockInputEditor contextValues={processValues} field={field} widgetName={widgetName} form={form} disabled={isWorking}
        autoFocus={values.autoFocus === true} placeholder={typeof values.placeholder === 'string' ? values.placeholder : undefined}
        possibleValueContext={processField || field.adornments?.some((item) => item.type === 'WIDGET') ? { type: 'process', processName } : { type: 'standalone' }}
        onEnter={submitInput} />
    </div>
  }
  const inputId = `process-block-input-${widgetName}-${field.name}`
  const errorId = `${inputId}-error`
  const message = form.formState.errors[field.name]?.message
  const error = typeof message === 'string' ? message : undefined
  const label = field.label || field.name
  const isBoolean = field.type === 'BOOLEAN'

  /**
   * Enter never submits the step by itself; with `submitOnEnter` it does, and `->code`
   * submits the code instead of the text (Material InputFieldBlock).
   * @param event - The key event.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    submitInput(String(event.currentTarget.value ?? '').trim())
  }

  return (
    <div
      className={cn('flex gap-1', isBoolean ? 'flex-row-reverse items-center justify-end' : 'flex-col')}
      data-qqq-id={blockQqqId('INPUT_FIELD', widgetName)}
      data-block-type="INPUT_FIELD"
      data-block-id={block.blockId}
    >
      <label htmlFor={inputId} className={cn('text-sm font-medium text-foreground', isBoolean && 'pointer-coarse:min-h-11 pointer-coarse:content-center')}>
        {label}
        {field.isRequired && <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>}
      </label>
      <input
        id={inputId}
        type={isBoolean ? 'checkbox' : inputType(field.type)}
        step={field.type === 'DECIMAL' ? 'any' : undefined}
        placeholder={typeof values.placeholder === 'string' ? values.placeholder : undefined}
        autoFocus={values.autoFocus === true}
        data-qqq-autofocus={values.autoFocus === true || undefined}
        disabled={isWorking}
        aria-required={field.isRequired || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...form.register(field.name)}
        onKeyDown={onKeyDown}
        className={isBoolean
          ? 'h-4 w-4 pointer-coarse:h-6 pointer-coarse:w-6'
          : cn('rounded-md border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring', error ? 'border-destructive' : 'border-border')}
        data-qqq-id={`input-block-${field.name}`}
      />
      {error && <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/** Props for {@link ProcessCompositeHost}. */
export interface ProcessCompositeHostProps {
  children: React.ReactNode
}

/**
 * Hosts the composite blocks of one process screen: interpolation and conditional
 * values, form-bound inputs, and the control-code state shared by every widget on
 * the screen (a button in one widget may open a modal composite in another).
 * @param props - The screen's components.
 * @returns The hosted components.
 */
export function ProcessCompositeHost({ children }: ProcessCompositeHostProps) {
  const { values, isWorking, requestSubmit } = useProcessStep()
  const [controlValues, setControlValues] = useState<Record<string, boolean>>({})
  const hostValues = useMemo(() => ({ ...values, ...controlValues }), [values, controlValues])

  /**
   * Apply a `showModal:x`, `hideModal:x` or `toggleModal:x` control code.
   * @param controlCode - The button's control code.
   */
  const applyControlCode = useCallback((controlCode: string) => {
    const [action, target] = controlCode.split(':', 2)
    if (!target) return
    setControlValues((previous) => {
      const current = Boolean(previous[target] ?? values[target])
      const next = action === 'showModal' ? true : action === 'hideModal' ? false : action === 'toggleModal' ? !current : current
      return { ...previous, [target]: next }
    })
  }, [values])

  const actionCallback = useCallback<BlockActionCallback>((block, eventValues) => {
    if (isWorking || !block || block.blockTypeName !== 'BUTTON') return false
    const actionCode = typeof eventValues?.actionCode === 'string' && eventValues.actionCode ? eventValues.actionCode : undefined
    const controlCode = typeof eventValues?.controlCode === 'string' && eventValues.controlCode ? eventValues.controlCode : undefined
    if (actionCode) {
      requestSubmit({ actionCode })
      return true
    }
    if (controlCode) {
      applyControlCode(controlCode)
      return true
    }
    return false
  }, [applyControlCode, isWorking, requestSubmit])

  const host = useMemo<CompositeHost>(() => ({
    values: hostValues,
    isWorking,
    renderInputField: (props) => <ProcessInputField {...props} />,
    isModalOpen: (blockId) => Boolean(hostValues[blockId]),
    closeModal: (blockId) => setControlValues((previous) => ({ ...previous, [blockId]: false })),
  }), [hostValues, isWorking])

  return (
    <CompositeHostContext.Provider value={host}>
      <ProcessBlockActionContext.Provider value={actionCallback}>{children}</ProcessBlockActionContext.Provider>
    </CompositeHostContext.Provider>
  )
}

/** Props for {@link ProcessBlocks}. */
export interface ProcessBlocksProps {
  /** The composite's blocks. */
  blocks: ProcessBlockData[]
  /** Identifier for `data-qqq-id` attributes (the ad hoc widget's name). */
  name: string
  /** The composite's other data (layout, styles), when it declares any. */
  composite?: Record<string, unknown>
}

/**
 * Render an ad hoc composite of a process screen. As in Material, its blocks stack in
 * a column.
 * @param props - {@link ProcessBlocksProps}
 * @returns The rendered blocks.
 */
export function ProcessBlocks({ blocks, name, composite }: ProcessBlocksProps) {
  const actionCallback = useProcessBlockAction()
  const widgetMetaData = useMemo<QWidgetMetaData>(() => ({ name, label: '', hasPermission: true }), [name])
  const data = useMemo<QqqCompositeData>(() => ({
    blockTypeName: 'COMPOSITE',
    layout: 'FLEX_COLUMN',
    ...(composite && typeof composite.styles === 'object' && composite.styles ? { styles: composite.styles as Record<string, unknown> } : {}),
    blocks: normalizeBlocks(blocks),
  }), [blocks, composite])
  return (
    <div className="py-2" data-qqq-id={`process-blocks-${name}`}>
      <QqqComposite widgetMetaData={widgetMetaData} data={data} actionCallback={actionCallback} />
    </div>
  )
}
