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
 * @file CronUIWidget — the `cronUI` widget: shows a record's cron schedule with
 * the backend's human-readable description, and (in editable mode) lets a form
 * edit the expression with a live description.
 */
'use client'

import React, { useEffect, useRef, useState } from 'react'

import { fetchWidgetData } from '@/lib/api/widgets'
import { formatPlainValue, recordDisplayValue, recordValue } from './record-widget-utils'
import type { WidgetComponentProps } from './widget-types'

/** Payload of the `cronUI` widget (`CronUIWidgetData`). */
export interface CronUIWidgetPayload {
  type?: string
  label?: string
  /** Human-readable description of the expression, from the backend. */
  cronDescription?: string
  /** Why the expression could not be described (invalid syntax). */
  error?: string
}

/** Editable values of the cron widget. */
export interface CronUIValue {
  cronExpression: string
  timeZone: string
}

/** Props accepted by {@link CronUIWidget}. */
export interface CronUIWidgetProps extends WidgetComponentProps<CronUIWidgetPayload> {
  /** When true, renders inputs for the expression (and time zone) instead of the read-only view. */
  editable?: boolean
  /** Controlled values in editable mode; when omitted the record's values seed internal state. */
  value?: Partial<CronUIValue>
  /** Called with the new values whenever an input changes in editable mode. */
  onChange?: (value: CronUIValue) => void
}

/** Debounce before asking the backend to describe an edited expression. */
const DESCRIBE_DELAY_MS = 300

/** A described expression (or the reason it could not be described). */
interface Description {
  expression: string
  description?: string
  error?: string
}

/**
 * Reads a string default value from the widget metadata.
 *
 * @param meta - Widget metadata.
 * @param key - Default-value key.
 * @returns The non-empty string value, else undefined.
 */
function defaultString(meta: CronUIWidgetProps['widgetMetaData'], key: string): string | undefined {
  const value = meta.defaultValues?.[key]
  return typeof value === 'string' && value ? value : undefined
}

/**
 * Renders the cron schedule of the hosting record.
 *
 * View mode shows the expression (`defaultValues.cronExpressionFieldName`), the
 * backend description, the time zone (`defaultValues.timeZoneFieldName`) and any
 * description error; with no expression it shows `No schedule set`. Editable
 * mode renders labeled inputs and refreshes the description from
 * `GET /widget/{name}?cronExpression=…` after typing pauses.
 *
 * @param props - See {@link CronUIWidgetProps}.
 * @returns The rendered schedule view or editor.
 */
export function CronUIWidget({ widgetMetaData, data, recordContext, editable = false, value, onChange }: CronUIWidgetProps) {
  const widgetName = widgetMetaData.name
  const expressionFieldName = defaultString(widgetMetaData, 'cronExpressionFieldName')
  const timeZoneFieldName = defaultString(widgetMetaData, 'timeZoneFieldName')
  const fields = recordContext?.tableMetaData?.fields
  const expressionField = expressionFieldName ? fields?.[expressionFieldName] : undefined
  const timeZoneField = timeZoneFieldName ? fields?.[timeZoneFieldName] : undefined
  const expressionLabel = expressionField?.label ?? 'Cron Expression'
  const timeZoneLabel = timeZoneField?.label ?? 'Time Zone'

  const recordExpression = recordValue(recordContext, expressionFieldName)
  const initialExpression = typeof recordExpression === 'string' ? recordExpression : ''
  const recordTimeZone = recordValue(recordContext, timeZoneFieldName)
  const initialTimeZone = typeof recordTimeZone === 'string' ? recordTimeZone : ''

  const [localValue, setLocalValue] = useState<CronUIValue>({ cronExpression: initialExpression, timeZone: initialTimeZone })
  const current: CronUIValue = {
    cronExpression: value?.cronExpression ?? localValue.cronExpression,
    timeZone: value?.timeZone ?? localValue.timeZone,
  }
  const [described, setDescribed] = useState<Description>({
    expression: initialExpression,
    description: data?.cronDescription,
    error: data?.error,
  })
  const [isDescribing, setIsDescribing] = useState(false)
  const latestExpression = useRef(current.cronExpression)
  latestExpression.current = current.cronExpression

  useEffect(() => {
    if (!editable) return
    const expression = current.cronExpression.trim()
    if (expression === described.expression.trim()) {
      setIsDescribing(false)
      return
    }
    if (!expression) {
      setDescribed({ expression: '' })
      setIsDescribing(false)
      return
    }
    setIsDescribing(true)
    let cancelled = false
    const timer = setTimeout(() => {
      fetchWidgetData(widgetName, { cronExpression: expression })
        .then((response) => {
          if (cancelled || latestExpression.current.trim() !== expression) return
          const payload = response as CronUIWidgetPayload
          setDescribed({ expression, description: payload.cronDescription, error: payload.error })
        })
        .catch(() => {
          if (!cancelled) setDescribed({ expression, error: 'The schedule could not be described.' })
        })
        .finally(() => {
          if (!cancelled) setIsDescribing(false)
        })
    }, DESCRIBE_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // described is intentionally excluded: it is the effect's own output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, current.cronExpression, widgetName])

  const update = (next: Partial<CronUIValue>) => {
    const merged = { ...current, ...next }
    setLocalValue(merged)
    onChange?.(merged)
  }

  if (editable) {
    const expressionInputId = `cron-expression-input-${widgetName}`
    const timeZoneInputId = `cron-time-zone-input-${widgetName}`
    const showDescription = current.cronExpression.trim() !== '' && described.expression.trim() === current.cronExpression.trim()
    return (
      <div className="space-y-3" data-qqq-id={`widget-cronUI-${widgetName}`}>
        <div className="space-y-1">
          <label htmlFor={expressionInputId} className="block text-sm font-medium text-foreground">
            {expressionLabel}{expressionField?.isRequired ? ' *' : ''}
          </label>
          <input
            id={expressionInputId}
            type="text"
            value={current.cronExpression}
            onChange={(event) => update({ cronExpression: event.target.value })}
            aria-required={expressionField?.isRequired ? true : undefined}
            aria-invalid={showDescription && Boolean(described.error) ? true : undefined}
            aria-describedby={`cron-description-${widgetName}`}
            spellCheck={false}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id={expressionInputId}
          />
        </div>
        <p id={`cron-description-${widgetName}`} className="text-sm text-muted-foreground" aria-live="polite" data-qqq-id={`cron-description-${widgetName}`}>
          {isDescribing ? 'Describing…' : showDescription && !described.error ? (described.description ?? '') : ''}
        </p>
        {!isDescribing && showDescription && described.error && (
          <p role="alert" className="text-sm text-destructive" data-qqq-id={`cron-error-${widgetName}`}>{described.error}</p>
        )}
        {timeZoneFieldName && (
          <div className="space-y-1">
            <label htmlFor={timeZoneInputId} className="block text-sm font-medium text-foreground">
              {timeZoneLabel}{timeZoneField?.isRequired ? ' *' : ''}
            </label>
            <input
              id={timeZoneInputId}
              type="text"
              value={current.timeZone}
              onChange={(event) => update({ timeZone: event.target.value })}
              aria-required={timeZoneField?.isRequired ? true : undefined}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={timeZoneInputId}
            />
          </div>
        )}
      </div>
    )
  }

  const hasRecord = Boolean(recordContext?.record)
  const expression = initialExpression
  if (!expression && (hasRecord || !data?.cronDescription)) {
    return (
      <p className="text-sm text-muted-foreground" data-qqq-id={`widget-cronUI-${widgetName}`}>
        <span data-qqq-id={`cron-empty-${widgetName}`}>No schedule set</span>
      </p>
    )
  }
  return (
    <div className="space-y-2" data-qqq-id={`widget-cronUI-${widgetName}`}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        {expression && (
          <>
            <dt className="text-sm text-muted-foreground">{expressionLabel}</dt>
            <dd className="text-sm font-medium text-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono" data-qqq-id={`cron-expression-${widgetName}`}>{expression}</code>
            </dd>
          </>
        )}
        {data?.cronDescription && (
          <>
            <dt className="text-sm text-muted-foreground">Description</dt>
            <dd className="text-sm font-medium text-foreground" data-qqq-id={`cron-description-${widgetName}`}>{data.cronDescription}</dd>
          </>
        )}
        {timeZoneFieldName && (
          <>
            <dt className="text-sm text-muted-foreground">{timeZoneLabel}</dt>
            <dd className="text-sm font-medium text-foreground" data-qqq-id={`cron-time-zone-${widgetName}`}>
              {formatPlainValue(recordDisplayValue(recordContext, timeZoneFieldName))}
            </dd>
          </>
        )}
      </dl>
      {data?.error && (
        <p role="alert" className="text-sm text-destructive" data-qqq-id={`cron-error-${widgetName}`}>{data.error}</p>
      )}
    </div>
  )
}
