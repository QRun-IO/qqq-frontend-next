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
 * @file legacy-paths — opens Material dashboard URLs (bookmarks, links built by backend code)
 * in this dashboard. Material nests every object under its apps (`/{app}/{child app}/{table}/{id}`)
 * and honors the backend's `metaData.redirects`; this dashboard serves objects at `/app/{name}`.
 */

import type { QInstance } from '@/types'

/**
 * Applies the backend's redirect rules (`metaData.redirects`, Material `getRedirectRoutes`): an
 * exact `from` path, or a `from` ending in `/*` that matches the path below it, which is kept
 * after `to` (Material `RedirectRoute`).
 *
 * @param pathname - The requested path.
 * @param redirects - `from` path to `to` path.
 * @returns The redirected path, or the path unchanged when no rule matches.
 */
export function applyRedirects(pathname: string, redirects: Record<string, string> | undefined): string {
  if (!redirects) return pathname
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (typeof redirects[path] === 'string') return redirects[path]
  for (const [from, to] of Object.entries(redirects)) {
    if (!from.endsWith('/*') || typeof to !== 'string') continue
    const prefix = from.slice(0, -2)
    if (path.startsWith(`${prefix}/`)) return `${to.replace(/\/+$/, '')}/${path.slice(prefix.length + 1)}`
  }
  return pathname
}

/**
 * The path of this dashboard that a Material dashboard path names: after the backend's redirect
 * rules, the leading app segments are dropped and the first table, process or report (or the
 * last app, when the path names only apps) opens at `/app/{name}` with the rest of the path.
 *
 * @param pathname - The requested path (not under `/app`).
 * @param metaData - Instance metadata (apps, tables, processes, reports and redirects).
 * @returns The in-app path, or `null` when the path is not a Material path of this instance.
 */
export function legacyMaterialPath(pathname: string, metaData: QInstance | undefined): string | null {
  if (!metaData) return null
  const redirected = applyRedirects(pathname, metaData.redirects)
  const segments = redirected.split('/').filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  })
  const apps = metaData.apps ?? {}
  let index = 0
  while (index < segments.length && apps[segments[index]]) index++
  // a Material path starts with an app (its root app); anything else is not one of its routes
  if (index === 0) return null
  if (index === segments.length) return `/app/${encodeURIComponent(segments[index - 1])}`
  const name = segments[index]
  if (!metaData.tables?.[name] && !metaData.processes?.[name] && !metaData.reports?.[name]) return null
  return ['/app', ...segments.slice(index)].map((segment, position) => (position === 0 ? segment : encodeURIComponent(segment))).join('/')
}
