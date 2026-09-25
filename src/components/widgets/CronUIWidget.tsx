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
 * @file CronUIWidget — the `cronUI` widget on record views: a record's cron
 * schedule with the backend's human-readable description and its time zone.
 * Record forms edit the schedule with `CronScheduleEditor`.
 */
'use client'

import React from 'react'

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

/**
 * Reads a string default value from the widget metadata.
 *
 * @param meta - Widget metadata.
 * @param key - Default-value key.
 * @returns The non-empty string value, else undefined.
 */
function defaultString(meta: WidgetComponentProps<CronUIWidgetPayload>['widgetMetaData'], key: string): string | undefined {
  const value = meta.defaultValues?.[key]
  return typeof value === 'string' && value ? value : undefined
}

/**
 * Renders the cron schedule of the hosting record: the expression
 * (`defaultValues.cronExpressionFieldName`), the backend description, the time
 * zone (`defaultValues.timeZoneFieldName`) and any description error; with no
 * expression it shows `No schedule set`.
 *
 * @param props - Widget metadata, payload and the hosting record context.
 * @returns The rendered schedule view.
 */
export function CronUIWidget({ widgetMetaData, data, recordContext }: WidgetComponentProps<CronUIWidgetPayload>) {
  const widgetName = widgetMetaData.name
  const expressionFieldName = defaultString(widgetMetaData, 'cronExpressionFieldName')
  const timeZoneFieldName = defaultString(widgetMetaData, 'timeZoneFieldName')
  const fields = recordContext?.tableMetaData?.fields
  const expressionLabel = (expressionFieldName ? fields?.[expressionFieldName]?.label : undefined) ?? 'Cron Expression'
  const timeZoneLabel = (timeZoneFieldName ? fields?.[timeZoneFieldName]?.label : undefined) ?? 'Time Zone'
  const recordExpression = recordValue(recordContext, expressionFieldName)
  const expression = typeof recordExpression === 'string' ? recordExpression : ''

  const hasRecord = Boolean(recordContext?.record)
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
