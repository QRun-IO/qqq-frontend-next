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

/** @file Resolves app-prefixed URLs before route content or a 404 is rendered. */

'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/lib/auth/use-auth'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { nestedAppUrl } from '@/lib/utils/nested-app-url'
import { RouteRedirect } from '@/components/layout/RouteRedirect'

/**
 * Resolves only nested /app URLs using the shared instance metadata cache.
 * Reads the browser location after mount because static exports can serve a
 * placeholder route or the exported 404 document at the requested URL.
 *
 * @param props - Content to render when no redirect applies.
 * @returns A client-side replacement, loading status, or the original content.
 */
export function NestedAppRedirect({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const { isAuthenticated } = useAuth()
  useEffect(() => setMounted(true), [])
  const browserPath = mounted ? window.location.pathname : pathname
  const candidate = mounted && browserPath !== null && /^\/app\/[^/]+\/[^/]+/.test(browserPath)
  const { data: metadata, isError } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
    enabled: candidate && isAuthenticated,
  })
  const target = candidate && isAuthenticated && metadata
    ? nestedAppUrl(`${browserPath}${window.location.search}${window.location.hash}`, metadata)
    : null

  if (target) return <RouteRedirect href={target} label="page" />
  if (!mounted || (candidate && isAuthenticated && !metadata && !isError)) {
    return <div role="status" className="py-12 text-center text-muted-foreground">Opening page...</div>
  }
  return children
}
