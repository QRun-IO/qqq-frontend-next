// Widget data API functions

import type { WidgetData } from '@/types'
import apiClient from './client'

export async function fetchWidgetData(
  widgetName: string,
  params?: Record<string, string | number | boolean>
): Promise<WidgetData> {
  return apiClient.get<WidgetData>(`/widget/${encodeURIComponent(widgetName)}`, {
    params,
  })
}
