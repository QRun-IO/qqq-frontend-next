/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * @file Route parameters that also work in the Javalin-served static export.
 *
 * The static export prerenders each dynamic route once with the placeholder
 * segment `_`; the server returns that page for every concrete path of the same
 * shape. Params equal to the placeholder are therefore read from the browser path.
 */

import { useParams, usePathname } from 'next/navigation'

import { EXPORT_PLACEHOLDER } from '@/lib/utils/export-placeholder'

export { EXPORT_PLACEHOLDER }

/** Position of each dynamic segment within `/app/[slug]/[recordId]` and `/app/[slug]/savedView/[viewId]`. */
const SEGMENT_INDEX: Record<string, number> = { slug: 1, recordId: 2, viewId: 3 }

/**
 * Replaces placeholder params with the matching segment of `pathname`.
 *
 * @param params - Params reported by the router.
 * @param pathname - Current browser path.
 * @returns Params with placeholders resolved.
 */
export function resolveRouteParams<T extends Record<string, string>>(params: T, pathname: string | null): T {
  const segments = (pathname ?? '').split('/').filter(Boolean)
  const resolved: Record<string, string> = { ...params }
  for (const [key, value] of Object.entries(params)) {
    const index = SEGMENT_INDEX[key]
    if (value === EXPORT_PLACEHOLDER && index !== undefined && segments[0] === 'app' && segments[index]) {
      resolved[key] = decodeURIComponent(segments[index])
    }
  }
  return resolved as T
}

/**
 * Drop-in replacement for `useParams` on the `/app` dynamic routes.
 *
 * @returns Route params for the current browser location.
 */
export function useRouteParams<T extends Record<string, string>>(): T {
  const params = useParams<T>()
  const pathname = usePathname()
  return resolveRouteParams(params, pathname)
}
