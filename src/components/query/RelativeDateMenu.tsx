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
 * @file RelativeDateMenu — Material's menu of common relative date expressions for a date or
 * date-time criterion ("7 days ago", "start of this month", ...), each shown with what it means
 * right now, plus "Custom" for the full expression editor.
 */

'use client'

import React from 'react'
import { CalendarRange } from 'lucide-react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'

import type { ExpressionTimeUnit, QFieldType } from '@/types'
import { describeExpression, type FilterExpression } from '@/lib/utils/filter-utils'
import { formatEvaluatedExpression } from '@/lib/utils/filter-display-utils'
import { useNow } from './EvaluatedExpression'

/**
 * A "N units ago" expression.
 *
 * @param amount - How many units.
 * @param timeUnit - The unit.
 * @returns The expression.
 */
function ago(amount: number, timeUnit: ExpressionTimeUnit): FilterExpression {
  return { type: 'NowWithOffset', operator: 'MINUS', amount, timeUnit }
}

/**
 * A "this/last period" expression.
 *
 * @param operator - THIS or LAST.
 * @param timeUnit - The period.
 * @returns The expression.
 */
function period(operator: 'THIS' | 'LAST', timeUnit: ExpressionTimeUnit): FilterExpression {
  return { type: 'ThisOrLastPeriod', operator, timeUnit }
}

/**
 * Material's preset expressions: offsets in the first column, periods in the second.
 *
 * @param fieldType - DATE or DATE_TIME.
 * @returns The two columns.
 */
export function relativeDatePresets(fieldType: QFieldType): [FilterExpression[], FilterExpression[]] {
  const days = [ago(7, 'DAYS'), ago(14, 'DAYS'), ago(30, 'DAYS'), ago(90, 'DAYS'), ago(180, 'DAYS'), ago(1, 'YEARS')]
  const periods = (['DAYS', 'WEEKS', 'MONTHS', 'YEARS'] as ExpressionTimeUnit[]).flatMap((unit) => [period('THIS', unit), period('LAST', unit)])
  if (fieldType === 'DATE') return [days, periods]
  return [
    [ago(1, 'HOURS'), ago(12, 'HOURS'), ago(24, 'HOURS'), ...days],
    [{ type: 'Now' }, period('THIS', 'HOURS'), period('LAST', 'HOURS'), ...periods],
  ]
}

/**
 * Props for RelativeDateMenu.
 */
interface RelativeDateMenuProps {
  /** DATE or DATE_TIME. */
  fieldType: QFieldType
  /** Field label (for the button's name). */
  fieldLabel: string
  /** Receives the chosen expression. */
  onSelect: (expression: FilterExpression) => void
  /** Opens the custom expression editor. */
  onCustom: () => void
  /** data-qqq-id prefix. */
  dataId: string
}

/**
 * The menu button and menu of common relative date expressions.
 *
 * @param root0 - Component properties.
 * @returns The button and menu.
 */
export function RelativeDateMenu({ fieldType, fieldLabel, onSelect, onCustom, dataId }: RelativeDateMenuProps) {
  const noun = fieldType === 'DATE' ? 'date' : 'date-time'
  return (
    <DropdownMenuPrimitive.Root modal={false}>
      <DropdownMenuPrimitive.Trigger asChild>
        <button type="button" aria-label={`Common relative ${noun} expressions for ${fieldLabel}`} title={`Choose a common relative ${noun} expression`}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          data-qqq-id={`${dataId}-presets`}>
          <CalendarRange className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content align="start" sideOffset={4} collisionPadding={8}
          className="z-[250] max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-border bg-popover py-1 text-sm shadow-md"
          style={{ maxHeight: 'min(70dvh, var(--radix-dropdown-menu-content-available-height))' }}
          aria-label={`Common relative ${noun} expressions`} data-qqq-id="relative-date-menu">
          <RelativeDateMenuItems fieldType={fieldType} onSelect={onSelect} onCustom={onCustom} />
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}

/**
 * The menu's items, re-rendered every second so each shows its current value.
 *
 * @param root0 - Component properties.
 * @param root0.fieldType - DATE or DATE_TIME.
 * @param root0.onSelect - Receives the chosen expression.
 * @param root0.onCustom - Opens the custom editor.
 * @returns The items.
 */
function RelativeDateMenuItems({ fieldType, onSelect, onCustom }: Pick<RelativeDateMenuProps, 'fieldType' | 'onSelect' | 'onCustom'>) {
  const now = useNow()
  const [offsets, periods] = relativeDatePresets(fieldType)
  const itemClass = 'flex cursor-pointer select-none items-baseline justify-between gap-4 px-3 py-1.5 outline-none data-[highlighted]:bg-accent pointer-coarse:min-h-[44px] pointer-coarse:items-center'
  const item = (expression: FilterExpression, index: number) => (
    <DropdownMenuPrimitive.Item key={index} className={itemClass} onSelect={() => onSelect(expression)} data-qqq-id="relative-date-option">
      <span className="text-foreground">{describeExpression(expression, fieldType)}</span>
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{formatEvaluatedExpression(now, expression, fieldType)}</span>
    </DropdownMenuPrimitive.Item>
  )
  return (
    <>
      {offsets.map(item)}
      <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
      {periods.map((expression, index) => item(expression, offsets.length + index))}
      <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
      <DropdownMenuPrimitive.Item className={itemClass} onSelect={onCustom} data-qqq-id="relative-date-custom">
        <span className="text-foreground">Custom...</span>
      </DropdownMenuPrimitive.Item>
    </>
  )
}
