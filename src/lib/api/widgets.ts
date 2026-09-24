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

import type { WidgetData } from '@/types'
import apiClient from './client'

/**
 * Fetches runtime data for a named widget from `GET /widget/{widgetName}`.
 *
 * Widget data is fully dynamic — the shape of the returned object is determined
 * by the widget's backend implementation and described by the `WidgetData` union
 * type. Optional query parameters allow the caller to pass filter values, date
 * ranges, or other widget-specific context to the server.
 *
 * @param widgetName - Backend-registered name of the widget (e.g. `"salesSummary"`).
 * @param params - Optional key-value pairs forwarded as query parameters to the widget endpoint.
 * @returns The widget's runtime data payload.
 */
export async function fetchWidgetData(
  widgetName: string,
  params?: Record<string, string | number | boolean>
): Promise<WidgetData> {
  const data = await apiClient.get<WidgetData>(`/widget/${encodeURIComponent(widgetName)}`, {
    params,
    baseURL: apiClient.getInstance().defaults.baseURL?.replace(/\/qqq\/v1\/?$/, ''),
  })
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
