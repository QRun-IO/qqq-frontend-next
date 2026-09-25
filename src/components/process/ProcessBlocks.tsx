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
 * @file ProcessBlocks — renders composite widget blocks inside a process screen
 * (ad hoc WIDGET components and named composite widgets seeded from process
 * values). Text interpolates `${value}` placeholders, blocks with a false
 * `conditional` value are omitted, input fields join the screen's form, and
 * buttons with an action code submit the screen with `actionCode`.
 */

'use client'

import React, { useState } from 'react'

import type { QFieldMetaData } from '@/types'

import { useProcessStep } from './ProcessStepContext'
import { interpolateProcessValues } from './process-values'

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
 * @param source - Object with a `blocks` array.
 * @returns The blocks.
 */
export function readBlocks(source: unknown): ProcessBlockData[] {
  if (!source || typeof source !== 'object') return []
  const blocks = (source as { blocks?: unknown }).blocks
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

/** Props for {@link ProcessBlocks}. */
export interface ProcessBlocksProps {
  blocks: ProcessBlockData[]
  /** Identifier for `data-qqq-id` attributes. */
  name: string
}

/**
 * Render a list of composite widget blocks.
 * @param props - {@link ProcessBlocksProps}
 * @returns The rendered blocks.
 */
export function ProcessBlocks({ blocks, name }: ProcessBlocksProps) {
  const { values, form, isWorking, requestSubmit } = useProcessStep()
  const [controlValues, setControlValues] = useState<Record<string, boolean>>({})

  const isVisible = (block: ProcessBlockData) => {
    if (!block.conditional) return true
    return Boolean(controlValues[block.conditional] ?? values[block.conditional])
  }

  /**
   * Apply a `showModal:x`, `hideModal:x` or `toggleModal:x` control code.
   * @param controlCode - The button's control code.
   */
  const applyControlCode = (controlCode: string) => {
    const [action, target] = controlCode.split(':', 2)
    if (!target) return
    setControlValues((previous) => {
      const current = Boolean(previous[target] ?? values[target])
      const next = action === 'showModal' ? true : action === 'hideModal' ? false : action === 'toggleModal' ? !current : current
      return { ...previous, [target]: next }
    })
  }

  const renderBlock = (block: ProcessBlockData, key: string): React.ReactNode => {
    if (!isVisible(block)) return null
    const type = blockTypeOf(block)
    const blockValues = block.values ?? {}
    switch (type) {
      case 'COMPOSITE':
        return <div key={key} className="flex flex-col gap-2">{readBlocks(block).map((child, index) => renderBlock(child, `${key}-${index}`))}</div>
      case 'TEXT': {
        const text = typeof blockValues.text === 'string' ? interpolateProcessValues(blockValues.text, values) : ''
        return <p key={key} className="text-sm text-foreground" data-qqq-id={`process-block-text-${key}`}>{text}</p>
      }
      case 'BUTTON': {
        const label = typeof blockValues.label === 'string' ? blockValues.label : 'Continue'
        const actionCode = typeof blockValues.actionCode === 'string' ? blockValues.actionCode : undefined
        const controlCode = typeof blockValues.controlCode === 'string' ? blockValues.controlCode : undefined
        return (
          <button
            key={key}
            type="button"
            disabled={isWorking}
            onClick={() => {
              if (actionCode) requestSubmit({ actionCode })
              else if (controlCode) applyControlCode(controlCode)
            }}
            className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-qqq-id={`button-block-${actionCode ?? controlCode ?? key}`}
          >
            {label}
          </button>
        )
      }
      case 'INPUT_FIELD': {
        const field = blockValues.fieldMetaData as QFieldMetaData | undefined
        if (!field?.name) return null
        const inputId = `process-block-input-${name}-${field.name}`
        return (
          <div key={key} className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-foreground">{field.label ?? field.name}</label>
            <input
              id={inputId}
              type="text"
              placeholder={typeof blockValues.placeholder === 'string' ? blockValues.placeholder : undefined}
              autoFocus={blockValues.autoFocus === true}
              disabled={isWorking}
              aria-required={field.isRequired || undefined}
              {...form.register(field.name)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (blockValues.submitOnEnter === true) requestSubmit()
                }
              }}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-qqq-id={`input-block-${field.name}`}
            />
          </div>
        )
      }
      case 'DIVIDER':
        return <hr key={key} className="border-border" />
      default: {
        const text = typeof blockValues.text === 'string' ? blockValues.text : typeof blockValues.label === 'string' ? blockValues.label : ''
        return text ? <p key={key} className="text-sm text-foreground">{interpolateProcessValues(text, values)}</p> : null
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 py-2" data-qqq-id={`process-blocks-${name}`}>
      {blocks.map((block, index) => renderBlock(block, `${name}-${index}`))}
    </div>
  )
}
