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
 * @file LegacyPathRedirect — on the not-found page, opens a Material dashboard URL (nested under
 * its apps, or covered by a backend redirect rule) at the path this dashboard serves it from.
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/lib/auth/use-auth'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { legacyMaterialPath } from '@/lib/utils/legacy-paths'

/** Paths this dashboard serves itself; a miss under them is a real not-found. */
const OWN_PATHS = /^\/(app|login|token|callback)(\/|$)/

/**
 * Resolves the requested path as a Material dashboard URL once the user's metadata is known:
 * a match replaces the location with the in-app path (keeping the query string and hash); no
 * match shows `children` (the not-found page). A signed-out visitor signs in first and returns
 * here. While resolving, a status replaces the not-found page so it does not flash.
 *
 * @param props - Component properties.
 * @param props.children - The not-found content.
 * @returns The not-found content, or a status while resolving or redirecting.
 */
export function LegacyPathRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const [pathname, setPathname] = useState<string | null>(null)
  useEffect(() => setPathname(window.location.pathname), [])
  const candidate = pathname !== null && pathname !== '/' && !OWN_PATHS.test(pathname)

  const { data: metaData, isError } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
    enabled: candidate && isAuthenticated,
  })
  const target = candidate && metaData ? legacyMaterialPath(pathname, metaData) : null

  useEffect(() => {
    if (!candidate || isLoading) return
    if (!isAuthenticated) {
      window.location.replace(`/login?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`)}`)
    } else if (target) {
      window.location.replace(`${target}${window.location.search}${window.location.hash}`)
    }
  }, [candidate, isLoading, isAuthenticated, target])

  const resolving = pathname === null || (candidate && (isLoading || !isAuthenticated || (!metaData && !isError) || target !== null))
  if (resolving) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted" role="status" aria-live="polite" data-qqq-id="legacy-path-redirect">
        <p className="text-sm text-muted-foreground">Opening page...</p>
      </div>
    )
  }
  return <>{children}</>
}
