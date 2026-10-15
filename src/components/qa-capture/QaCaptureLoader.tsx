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
 * @file Root-level QA capture loader (mounted in the root providers, so it runs on every page).
 * Once signed in, and only when `GET /version` lists the `qa-capture` extension, it loads the
 * capability once. When capture is enabled it restores stashed Jam Recording Link parameters,
 * starts collecting request ids and initializes Jam (see `jam-loader.ts`); otherwise nothing
 * Jam-related is loaded or requested.
 */

'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/use-auth'
import apiClient from '@/lib/api/client'
import { getQaCaptureCapability, QA_CAPTURE_EXTENSION } from '@/lib/api/qa-capture'
import { useUiApiExtensionInstalled } from '@/lib/api/ui-api-extensions'
import { queryClient, queryKeys } from '@/lib/query-client'
import { initializeJam, setJamMetadataProvider } from '@/lib/qa-capture/jam-loader'
import { restoreJamParams, stashJamParams } from '@/lib/qa-capture/jam-params'
import { currentReportReference } from '@/lib/qa-capture/report'
import { installRequestIdInterceptor, recentRequestIds, setRequestIdCollection } from '@/lib/qa-capture/request-ids'
import { buildJamMetadata, resolveRouteContext, type RouteMetaData } from '@/lib/qa-capture/route-context'

// Before any sign-in redirect can drop them: keep this page load's Recording Link parameters.
if (typeof window !== 'undefined') {
  stashJamParams()
  installRequestIdInterceptor(apiClient.getInstance())
}

/**
 * Loads the capability and, when enabled, Jam. Renders nothing.
 *
 * @returns Null.
 */
export function QaCaptureLoader() {
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()
  const installed = useUiApiExtensionInstalled(QA_CAPTURE_EXTENSION, isAuthenticated)
  const { data: capability } = useQuery({
    queryKey: queryKeys.qaCaptureCapability(),
    queryFn: getQaCaptureCapability,
    enabled: isAuthenticated && installed,
    staleTime: Infinity,
    retry: false,
  })
  const enabled = Boolean(isAuthenticated && installed && capability?.enabled)

  useEffect(() => {
    setRequestIdCollection(enabled && capability ? capability.requestIdHeader : null)
  }, [enabled, capability])

  useEffect(() => {
    if (!enabled || !capability) return
    // after sign-in, put a Recording Link's parameters back where the Jam SDK reads them
    restoreJamParams()
    setJamMetadataProvider(() =>
      buildJamMetadata({
        capability,
        route: resolveRouteContext(window.location.pathname, queryClient.getQueryData<RouteMetaData>(queryKeys.metadataAll())),
        href: window.location.href,
        requestIds: recentRequestIds(),
        reportReference: currentReportReference(),
      })
    )
    initializeJam(capability)?.catch(() => {
      // the Jam chunk failed to load; capture stays off on this page and the next attempt retries
    })
  }, [enabled, capability, pathname])

  return null
}
