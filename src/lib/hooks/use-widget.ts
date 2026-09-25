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

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { WidgetData } from '@/types'
import { fetchWidgetData } from '@/lib/api/widgets'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'

const WIDGET_STALE_TIME = 1000 * 60 * 5 // 5 minutes

/** Options for {@link useWidget}. */
export interface UseWidgetOptions {
  /** When false the query does not run (e.g. a denied widget). Defaults to true. */
  enabled?: boolean
}

/**
 * Fetches runtime data for a named widget via `GET /widget/{widgetName}`.
 *
 * Results are cached for 5 minutes. When the parameters change (for example a
 * dropdown selection), the previous payload stays visible until the new one
 * arrives, so header controls derived from it do not disappear. Failures are not
 * retried and do not raise the global error toast: widgets render their own
 * error state with a retry button, as the Material dashboard does.
 *
 * @param widgetName - Backend-registered widget name as declared in the QInstance metadata.
 *   The query is disabled when this is an empty string.
 * @param params - Optional key-value pairs forwarded as URL query parameters to the widget
 *   endpoint (e.g. `{ tableName: 'Orders', id: 42 }`). Included in the cache key.
 * @param options - See {@link UseWidgetOptions}.
 * @returns TanStack Query result for `WidgetData`.
 */
export function useWidget(
  widgetName: string,
  params?: Record<string, string | number | boolean>,
  options: UseWidgetOptions = {}
) {
  return useQuery<WidgetData, Error>({
    queryKey: queryKeys.widgetData(widgetName, params),
    queryFn: () => fetchWidgetData(widgetName, params),
    staleTime: WIDGET_STALE_TIME,
    enabled: Boolean(widgetName) && options.enabled !== false,
    placeholderData: keepPreviousData,
    retry: false,
    meta: HANDLES_OWN_ERRORS,
  })
}
