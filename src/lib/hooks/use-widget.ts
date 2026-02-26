'use client'

// use-widget — TanStack Query hook for fetching widget data

import { useQuery } from '@tanstack/react-query'

import type { WidgetData } from '@/types'
import { fetchWidgetData } from '@/lib/api/widgets'
import { queryKeys } from '@/lib/query-client'

const WIDGET_STALE_TIME = 1000 * 60 * 5 // 5 minutes

export function useWidget(
  widgetName: string,
  params?: Record<string, string | number | boolean>
) {
  return useQuery<WidgetData, Error>({
    queryKey: queryKeys.widgetData(widgetName, params),
    queryFn: () => fetchWidgetData(widgetName, params),
    staleTime: WIDGET_STALE_TIME,
    enabled: Boolean(widgetName),
  })
}
