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
 * @file Leaf QQQ composite blocks (TEXT, NUMBER_ICON_BADGE, UP_OR_DOWN_NUMBER,
 * TABLE_SUB_ROW_DETAIL_ROW, PROGRESS_BAR, DIVIDER, BIG_NUMBER, INPUT_FIELD, BUTTON,
 * AUDIO, IMAGE, ICON), rendered from the values/styles serialized by the backend
 * block data classes, with Material dashboard parity.
 */
'use client'

import React, { useState } from 'react'

import type { BlockActionCallback, QqqBlockData } from '../widget-types'
import { isPlainObject } from '../widget-types'
import { cn } from '@/lib/utils/cn'
import { WidgetIcon } from '../WidgetIcon'
import { BlockSlot } from './BlockSlot'
import { blockColor, blockQqqId, blockStyles, blockValues, iconName, numeric, text, tint } from './block-utils'

/** Props shared by every leaf block component. */
export interface LeafBlockProps {
  /** The block payload. */
  block: QqqBlockData
  /** Name of the owning widget, for `data-qqq-id` scoping. */
  widgetName: string
  /** Callback for interactive blocks. */
  actionCallback?: BlockActionCallback
}

/**
 * Common attributes for a block's root element.
 *
 * @param block - The block.
 * @param widgetName - The owning widget's name.
 * @returns `data-qqq-id`, `data-block-type` and `data-block-id` attributes.
 */
function rootAttributes(block: QqqBlockData, widgetName: string) {
  const type = block.blockTypeName ?? 'UNKNOWN'
  return {
    'data-qqq-id': blockQqqId(type, widgetName),
    'data-block-type': type,
    'data-block-id': block.blockId,
  }
}

/**
 * Font size for a TEXT block `size` style (Material parity).
 *
 * @param size - The style value (a named size or a pixel count).
 * @returns A CSS font size.
 */
function textSize(size: unknown): string {
  if (typeof size !== 'string') return '1rem'
  switch (size.toLowerCase()) {
    case 'largest': return '3rem'
    case 'headline': return '2rem'
    case 'title': return '1.5rem'
    case 'body': return '1rem'
    case 'smallest': return '0.75rem'
    default: return /^\d+$/.test(size) ? `${size}px` : '1rem'
  }
}

/**
 * Font weight for a TEXT block `weight` style (Material parity).
 *
 * @param weight - The style value (a weight name or number).
 * @returns A numeric CSS font weight.
 */
function textWeight(weight: unknown): number {
  const names: Record<string, number> = {
    thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900,
  }
  if (typeof weight !== 'string') return 400
  const key = weight.toLowerCase()
  if (names[key]) return names[key]
  return /^[1-9]00$/.test(key) ? Number(key) : 400
}

/**
 * TEXT: one line per `\n` in `interpolatedText ?? text`, with optional start/end
 * icons and color, alert/banner format, size and weight styles.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered text block.
 */
export function TextBlock({ block, widgetName }: LeafBlockProps) {
  const values = blockValues(block)
  const styles = blockStyles(block)
  const color = blockColor(styles.color)
  const format = typeof styles.format === 'string' ? styles.format.toLowerCase() : ''
  const boxStyle: React.CSSProperties = {}
  if (format === 'alert') {
    Object.assign(boxStyle, { border: `1px solid ${color ?? 'currentColor'}`, background: color ? tint(color) : undefined, padding: '0.5rem', borderRadius: '0.5rem' })
  } else if (format === 'banner') {
    Object.assign(boxStyle, { background: color ? tint(color) : undefined, padding: '0.5rem' })
  }
  const lines = (text(values.interpolatedText) ?? text(values.text) ?? '').split('\n')
  const start = iconName(values.startIcon)
  const end = iconName(values.endIcon)
  return (
    <div {...rootAttributes(block, widgetName)} className="inline-block leading-tight" style={boxStyle} data-format={format || undefined}>
      <BlockSlot block={block} slot="">
        <span className={color ? undefined : 'text-foreground'} style={{ fontSize: textSize(styles.size), fontWeight: textWeight(styles.weight), color }}>
          {lines.map((line, index) => (
            <div key={index} className="flex items-center gap-1">
              {index === 0 && start && <WidgetIcon name={start} />}
              <span>{line}</span>
              {index === lines.length - 1 && end && <WidgetIcon name={end} />}
            </div>
          ))}
        </span>
      </BlockSlot>
    </div>
  )
}

/**
 * NUMBER_ICON_BADGE: a number and an icon, like a badge.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered badge.
 */
export function NumberIconBadgeBlock({ block, widgetName }: LeafBlockProps) {
  const values = blockValues(block)
  const color = blockColor(blockStyles(block).color)
  const number = text(values.number)
  const icon = iconName(values.iconName)
  return (
    <div {...rootAttributes(block, widgetName)} className="inline-flex items-center whitespace-nowrap" style={{ color }}>
      {number !== undefined && number !== '' && (
        <BlockSlot block={block} slot="number"><span className="text-sm" style={{ color }}>{number}</span></BlockSlot>
      )}
      {icon && (
        <BlockSlot block={block} slot="icon"><WidgetIcon name={icon} color={color} className="ml-0.5 text-base" /></BlockSlot>
      )}
    </div>
  )
}

/**
 * UP_OR_DOWN_NUMBER: an up/down arrow and number (green when good, red when bad,
 * or `colorOverride`) and a context line, side by side or stacked.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered up/down number.
 */
export function UpOrDownNumberBlock({ block, widgetName }: LeafBlockProps) {
  const values = blockValues(block)
  const styles = blockStyles(block)
  const color = blockColor(styles.colorOverride) ?? (values.isGood === true ? '#2BA83F' : '#FB4141')
  const isUp = values.isUp === true
  const stacked = styles.isStacked === true
  return (
    <div
      {...rootAttributes(block, widgetName)}
      data-direction={isUp ? 'up' : 'down'}
      className={cn('ml-auto flex', stacked ? 'flex-col items-end' : 'flex-row items-baseline')}
    >
      <div className="flex items-baseline text-sm font-bold">
        <BlockSlot block={block} slot="number">
          <span className="inline-flex items-baseline" style={{ color }}>
            <WidgetIcon name={isUp ? 'arrow_drop_up' : 'arrow_drop_down'} color={color} className="mr-0.5 self-end" />
            <span>{text(values.number)}</span>
            <span className="sr-only">{isUp ? ' (up)' : ' (down)'}</span>
          </span>
        </BlockSlot>
      </div>
      {text(values.context) && (
        <div className="ml-1 text-sm font-medium text-muted-foreground">
          <BlockSlot block={block} slot="context"><span>{text(values.context)}</span></BlockSlot>
        </div>
      )}
    </div>
  )
}

/**
 * TABLE_SUB_ROW_DETAIL_ROW: a label and value pair for table sub-row details.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered detail row.
 */
export function TableSubRowDetailRowBlock({ block, widgetName }: LeafBlockProps) {
  const values = blockValues(block)
  const styles = blockStyles(block)
  const label = text(values.label)
  const value = text(values.value)
  return (
    <div {...rootAttributes(block, widgetName)} className="flex max-w-[calc(100%-24px)] justify-between gap-2">
      {label && (
        <div className="truncate">
          <BlockSlot block={block} slot="label"><span style={{ color: blockColor(styles.labelColor) }}>{label}</span></BlockSlot>
        </div>
      )}
      {value !== undefined && value !== '' && (
        <BlockSlot block={block} slot="value"><span style={{ color: blockColor(styles.valueColor) }}>{value}</span></BlockSlot>
      )}
    </div>
  )
}

/**
 * PROGRESS_BAR: optional heading, a bar filled to `percent`, and the value text
 * (`value`, else the percent to one decimal place).
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered progress bar.
 */
export function ProgressBarBlock({ block, widgetName }: LeafBlockProps) {
  const values = blockValues(block)
  const styles = blockStyles(block)
  const percent = numeric(values.percent) ?? 0
  const heading = text(values.heading)
  const valueText = text(values.value) ?? `${percent.toFixed(1)}%`
  const bounded = Math.max(0, Math.min(100, percent))
  return (
    <div {...rootAttributes(block, widgetName)} className="w-full text-sm">
      {heading && (
        <div className="mb-1 font-medium text-foreground">
          <BlockSlot block={block} slot="heading"><span>{heading}</span></BlockSlot>
        </div>
      )}
      <div className="mb-3 flex items-center">
        <BlockSlot block={block} slot="bar" linkClassName="w-full">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={bounded}
            aria-label={heading ?? 'Progress'}
            className="h-4 w-full min-w-[4rem] rounded-lg bg-[#E0E0E0]"
          >
            {percent > 0 && (
              <div data-block-part="bar-fill" className="h-4 min-w-4 rounded-lg" style={{ width: `${bounded}%`, background: blockColor(styles.barColor) ?? '#0062ff' }} />
            )}
          </div>
        </BlockSlot>
        <div className="w-[60px] text-right font-semibold text-foreground">
          <BlockSlot block={block} slot="value"><span>{valueText}</span></BlockSlot>
        </div>
      </div>
    </div>
  )
}

/**
 * DIVIDER: a horizontal rule spanning the card padding.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered divider.
 */
export function DividerBlock({ block, widgetName }: LeafBlockProps) {
  return <hr {...rootAttributes(block, widgetName)} className="-mx-4 my-4 w-[calc(100%+2rem)] border-0 border-b border-[#E0E0E0]" />
}

/**
 * BIG_NUMBER: a heading, a large number (optional `numberColor`) and a context.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered big number.
 */
export function BigNumberBlock({ block, widgetName }: LeafBlockProps) {
  const values = blockValues(block)
  const styles = blockStyles(block)
  const width = text(styles.width)
  return (
    <div {...rootAttributes(block, widgetName)} style={{ width: width ?? 'auto' }}>
      {text(values.heading) && (
        <div className="-mb-2 text-sm font-bold text-foreground">
          <BlockSlot block={block} slot="heading"><span>{text(values.heading)}</span></BlockSlot>
        </div>
      )}
      <div className="flex items-baseline">
        <div className="mr-1 text-[2rem] font-bold">
          <BlockSlot block={block} slot="number"><span style={{ color: blockColor(styles.numberColor) }}>{text(values.number)}</span></BlockSlot>
        </div>
        {text(values.context) && (
          <div className="text-sm font-medium text-muted-foreground">
            <BlockSlot block={block} slot="context"><span>{text(values.context)}</span></BlockSlot>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * HTML input type for a QQQ field type.
 *
 * @param fieldType - The field's QQQ type.
 * @returns The input `type` attribute.
 */
function inputType(fieldType: unknown): string {
  switch (fieldType) {
    case 'INTEGER':
    case 'LONG':
    case 'DECIMAL':
      return 'number'
    case 'DATE':
      return 'date'
    case 'PASSWORD':
      return 'password'
    default:
      return 'text'
  }
}

/**
 * INPUT_FIELD: a labeled text input for `values.fieldMetaData`. With
 * `submitOnEnter`, Enter calls the action callback with `{ [fieldName]: value }`
 * (not when the field is required and blank); an input of `->code` calls it with
 * `{ actionCode: code }` instead.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered input block.
 */
export function InputFieldBlock({ block, widgetName, actionCallback }: LeafBlockProps) {
  const values = blockValues(block)
  const field = isPlainObject(values.fieldMetaData) ? values.fieldMetaData : {}
  const fieldName = text(field.name) ?? 'input'
  const label = text(field.label) ?? fieldName
  const required = field.isRequired === true
  const [value, setValue] = useState(text(values.value) ?? '')
  const inputId = `block-input-${widgetName}-${fieldName}`

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || values.submitOnEnter !== true) return
    event.preventDefault()
    const entered = event.currentTarget.value.trim()
    if (entered.startsWith('->') && actionCallback) {
      actionCallback(block, { actionCode: entered.substring(2), _fieldToClearIfError: fieldName })
      return
    }
    if (required && entered === '') return
    actionCallback?.(block, { [fieldName]: entered })
  }

  return (
    <div {...rootAttributes(block, widgetName)} className="mt-2">
      <BlockSlot block={block} slot="">
        <span className="block">
          <span className="mb-1 flex text-base font-medium text-foreground">
            <label htmlFor={inputId}>{label}</label>
            {required && <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>}
          </span>
          <input
            id={inputId}
            name={fieldName}
            type={inputType(field.type)}
            value={value}
            placeholder={text(values.placeholder)}
            autoFocus={values.autoFocus === true}
            aria-required={required}
            required={required}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id={`block-input-field-${widgetName}-${fieldName}`}
          />
        </span>
      </BlockSlot>
    </div>
  )
}

/**
 * BUTTON: a button whose click calls the action callback with the block's values
 * (label, actionCode, controlCode). `styles.format` selects outlined, text or filled.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered button block.
 */
export function ButtonBlock({ block, widgetName, actionCallback }: LeafBlockProps) {
  const values = blockValues(block)
  const styles = blockStyles(block)
  const format = typeof styles.format === 'string' ? styles.format.toLowerCase() : 'filled'
  const color = blockColor(styles.color)
  const start = iconName(values.startIcon)
  const end = iconName(values.endIcon)
  const variant = format === 'outlined' ? 'border bg-transparent' : format === 'text' ? 'border-0 bg-transparent' : 'border-0 text-white'
  const variantStyle: React.CSSProperties = format === 'outlined'
    ? { borderColor: color ?? 'currentColor', color }
    : format === 'text' ? { color } : { background: color ?? '#344767' }
  return (
    <div {...rootAttributes(block, widgetName)} className="m-2 min-w-[8rem]">
      <BlockSlot block={block} slot="">
        <button
          type="button"
          data-format={format}
          onClick={() => actionCallback?.(block, { ...values })}
          className={cn('inline-flex w-full items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring', variant)}
          style={variantStyle}
          data-qqq-id={`button-block-${widgetName}${text(values.actionCode) ? `-${text(values.actionCode)}` : ''}`}
        >
          {start && <WidgetIcon name={start} />}
          {text(values.label) ?? 'Button'}
          {end && <WidgetIcon name={end} />}
        </button>
      </BlockSlot>
    </div>
  )
}

/**
 * AUDIO: an audio element for `path`, with `showControls` and `autoPlay`.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered audio block.
 */
export function AudioBlock({ block, widgetName }: LeafBlockProps) {
  const values = blockValues(block)
  return (
    <div {...rootAttributes(block, widgetName)}>
      <BlockSlot block={block} slot="">
        <audio src={text(values.path)} controls={values.showControls === true} autoPlay={values.autoPlay === true} />
      </BlockSlot>
    </div>
  )
}

/**
 * IMAGE: an image for `path` with `alt`, optional width/height and border.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered image block.
 */
export function ImageBlock({ block, widgetName }: LeafBlockProps) {
  const values = blockValues(block)
  const styles = blockStyles(block)
  const style: React.CSSProperties = { width: text(styles.width), height: text(styles.height) }
  if (styles.bordered === true) Object.assign(style, { border: '1px solid #C0C0C0', borderRadius: '0.5rem' })
  return (
    <div {...rootAttributes(block, widgetName)}>
      <BlockSlot block={block} slot="">
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary backend-supplied URL, static export */}
        <img src={text(values.path)} alt={text(values.alt) ?? ''} style={style} />
      </BlockSlot>
    </div>
  )
}

/**
 * ICON: the named icon with optional color and font size.
 *
 * @param props - See {@link LeafBlockProps}.
 * @returns The rendered icon block.
 */
export function IconBlock({ block, widgetName }: LeafBlockProps) {
  const values = blockValues(block)
  const styles = blockStyles(block)
  const name = iconName(values.name) ?? ''
  return (
    <div {...rootAttributes(block, widgetName)} className="inline-flex">
      <BlockSlot block={block} slot="">
        <WidgetIcon name={name} color={blockColor(styles.color)} style={{ fontSize: text(styles.fontSize) ?? '1.5rem', lineHeight: 0 }} />
      </BlockSlot>
    </div>
  )
}
