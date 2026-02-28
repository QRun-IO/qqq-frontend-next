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
