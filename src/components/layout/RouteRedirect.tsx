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
 * @file RouteRedirect — replaces the current history entry with another in-app route
 * (Material Dashboard URL shapes that Next serves from a different path).
 */

'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { withTrailingSlash } from '@/lib/utils/material-links'

/**
 * Props for {@link RouteRedirect}.
 */
interface RouteRedirectProps {
  /** In-app URL to open instead of the current one. */
  href: string
  /** What is being opened, for the status text (a metadata label). */
  label: string
}

/**
 * Navigates to `href` with `router.replace`, so Back skips the Material-style URL.
 *
 * @param props - See {@link RouteRedirectProps}.
 * @returns A busy status while the navigation happens.
 */
export function RouteRedirect({ href, label }: RouteRedirectProps) {
  const router = useRouter()
  useEffect(() => {
    router.replace(withTrailingSlash(href))
  }, [router, href])
  return (
    <div role="status" aria-busy="true" className="py-12 text-center text-sm text-muted-foreground" data-qqq-id="route-redirect">
      Opening {label}...
    </div>
  )
}
