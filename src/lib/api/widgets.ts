/** Widgets API — Endpoint for fetching runtime data for dashboard and embedded widgets. */

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
  return apiClient.get<WidgetData>(`/widget/${encodeURIComponent(widgetName)}`, {
    params,
  })
}
