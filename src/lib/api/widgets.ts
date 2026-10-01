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
 * @file Widgets API — Endpoint for fetching runtime data for dashboard and embedded widgets.
 */

import { AxiosError } from 'axios'

import type { WidgetData } from '@/types'
import apiClient from './client'

/**
 * Error raised for a failed widget request, carrying the HTTP status and the
 * backend's `error` message when one was returned.
 */
export class WidgetRequestError extends Error {
  /** HTTP status of the failed response, when there was one. */
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'WidgetRequestError'
    this.status = status
  }
}

/**
 * Fetches runtime data for a named widget from the v1 `POST /widget/{widgetName}` route,
 * with the widget inputs as query parameters (as on the legacy GET route).
 *
 * Widget data is fully dynamic — the shape of the returned object is determined
 * by the widget's backend implementation and described by the `WidgetData` union
 * type. Optional query parameters allow the caller to pass filter values, date
 * ranges, or other widget-specific context to the server.
 *
 * @param widgetName - Backend-registered name of the widget (e.g. `"salesSummary"`).
 * @param params - Optional widget inputs (e.g. the host record `id`, dropdown selections).
 * @returns The widget's runtime data payload.
 * @throws WidgetRequestError with the backend message (e.g. a renderer failure) and status.
 */
export async function fetchWidgetData(
  widgetName: string,
  params?: Record<string, string | number | boolean>
): Promise<WidgetData> {
  let data: WidgetData
  try {
    data = await apiClient.post<WidgetData>(`/widget/${encodeURIComponent(widgetName)}`, {}, { params })
  } catch (error) {
    if (error instanceof AxiosError) {
      const body = error.response?.data as { error?: unknown } | undefined
      const message = typeof body?.error === 'string' && body.error ? body.error : error.message
      throw new WidgetRequestError(message, error.response?.status)
    }
    throw error
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.type !== 'string') {
    throw new Error('Invalid widget data response')
  }
  // Canonical QQQ charts nest labels/datasets; retain the existing demo shapes.
  if (data.chartData && typeof data.chartData === 'object' && !Array.isArray(data.chartData)) {
    return { ...data, ...data.chartData }
  }
  if (data.type === 'statistics' && data.value === undefined && data.statistics === undefined
    && (typeof data.count === 'string' || typeof data.count === 'number')) {
    const percentage = data.percentageAmount
    return {
      ...data,
      statistics: [{
        label: typeof data.title === 'string' ? data.title : '',
        value: data.count,
        description: data.countContext,
        trend: typeof percentage === 'number' ? {
          direction: percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'flat',
          value: Math.abs(percentage),
          label: data.percentageLabel,
        } : undefined,
      }],
    }
  }
  return data
}
