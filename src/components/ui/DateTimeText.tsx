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
 * @file DateTimeText — the one way a DATE or DATE_TIME value is shown on screen: compact,
 * on one line, with the full value in a tooltip (see `compactDateTime` / `compactDate`).
 */
'use client'

import React from 'react'

import { compactDate, compactDateTime, relativeDateTime } from '@/lib/utils/datetime-utils'
import { cn } from '@/lib/utils/cn'

/** Props for {@link DateTimeText}. */
export interface DateTimeTextProps {
  /** Raw value: an ISO-8601 instant (DATE_TIME) or `yyyy-MM-dd` (DATE). */
  value: unknown
  /** Backend display value, used for zoned display values and unreadable raw values. */
  displayValue?: unknown
  /** The field type; DATE never shows a time. */
  type: 'DATE' | 'DATE_TIME'
  /** Show recent DATE_TIME values as relative time (`3h ago`), e.g. in activity lists. */
  relative?: boolean
  /** `data-qqq-id` of the element. */
  dataQqqId?: string
  /** Extra classes. */
  className?: string
  /** Shown when the value is empty (default: an em dash). */
  empty?: React.ReactNode
}

/**
 * Renders a date or timestamp compactly and without wrapping: `6:33 PM` today,
 * `Jul 5, 6:33 PM` this year, `Jul 5, 2025` before (DATE: `Jul 5` / `Jul 5, 2025`), in the
 * viewer's zone and locale, with the full value as the tooltip and a machine-readable
 * `<time dateTime>`.
 *
 * @param props - See {@link DateTimeTextProps}.
 * @returns The `<time>` element, or the empty placeholder.
 */
export function DateTimeText({ value, displayValue, type, relative = false, dataQqqId, className, empty }: DateTimeTextProps) {
  const display = type === 'DATE' ? compactDate(value, displayValue) : compactDateTime(value, displayValue)
  if (!display) {
    return empty !== undefined ? <>{empty}</> : <span className={cn('text-sm text-muted-foreground', className)} data-qqq-id={dataQqqId}>—</span>
  }
  const text = (relative && type === 'DATE_TIME' && relativeDateTime(value)) || display.text
  return (
    <time
      dateTime={display.dateTime}
      title={display.title}
      className={cn('whitespace-nowrap text-sm tabular-nums text-foreground', className)}
      data-qqq-id={dataQqqId}
    >
      {text}
    </time>
  )
}
