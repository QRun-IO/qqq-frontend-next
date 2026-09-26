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
 * @file EvaluatedExpression — the current value of a relative date expression, updated every
 * second (Material's `EvaluatedExpression`), shown in the expression tooltip and the relative
 * date menu.
 */

'use client'

import React, { useEffect, useState } from 'react'

import type { QFieldType } from '@/types'
import { formatEvaluatedExpression } from '@/lib/utils/filter-display-utils'
import type { FilterExpression } from '@/lib/utils/filter-utils'

/**
 * The current time, refreshed on an interval.
 *
 * @param intervalMs - Refresh interval in milliseconds.
 * @returns The current time.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/**
 * Props for EvaluatedExpression.
 */
interface EvaluatedExpressionProps {
  /** The relative expression. */
  expression: FilterExpression
  /** DATE or DATE_TIME. */
  fieldType: QFieldType
  /** data-qqq-id of the value. */
  'data-qqq-id'?: string
}

/**
 * Shows what a relative date expression means right now, ticking every second.
 *
 * @param root0 - Component properties.
 * @returns The evaluated value.
 */
export function EvaluatedExpression({ expression, fieldType, 'data-qqq-id': dataId }: EvaluatedExpressionProps) {
  const now = useNow()
  return <span className="tabular-nums" data-qqq-id={dataId}>{formatEvaluatedExpression(now, expression, fieldType)}</span>
}
