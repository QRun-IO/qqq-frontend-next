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
 * @file use-widget — TanStack Query hook for fetching widget data.
 */
'use client'

import { useQuery } from '@tanstack/react-query'

import type { WidgetData } from '@/types'
import { fetchWidgetData } from '@/lib/api/widgets'
import { queryKeys } from '@/lib/query-client'

const WIDGET_STALE_TIME = 1000 * 60 * 5 // 5 minutes

/**
 * Fetches runtime data for a named widget via `GET /widget/{widgetName}`.
 *
 * Results are cached for 5 minutes. The query is disabled when `widgetName` is empty.
 *
 * @param widgetName - Backend-registered widget name as declared in the QInstance metadata.
 *   The query is disabled when this is an empty string, so callers may pass an empty string
 *   to safely defer fetching until the widget name is resolved.
 * @param params - Optional key-value pairs forwarded as URL query parameters to the widget
 *   endpoint (e.g. `{ tableName: 'Orders', recordId: 42 }`). Included in the TanStack Query
 *   cache key so different param combinations are cached independently.
 * @returns TanStack Query result for `WidgetData`:
 *   `{ data, isLoading, isError, isFetching, error, refetch }` — `data` is `undefined`
 *   while loading or on error; `isLoading` is true only during the initial fetch;
 *   `isFetching` covers subsequent background refetches after the 5-minute stale window.
 */
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
