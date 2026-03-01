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
 * @file Breadcrumbs — auto-generates breadcrumb navigation from the current pathname.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { ParentAppInfo } from '@/lib/hooks/use-routes'

/**
 * Props for the Breadcrumbs component.
 */
export interface BreadcrumbsProps {
  /** Maps URL path segments to their display labels (e.g. `/app/Products` → `"Products"`). */
  pathToLabelMap: Record<string, string>
  /** Maps flat leaf paths to their parent app for breadcrumb injection. */
  parentAppMap?: Record<string, ParentAppInfo>
}

/**
 * Represents a single breadcrumb entry with its navigable path and display label.
 */
interface Breadcrumb {
  /** Absolute URL path for this breadcrumb link. */
  path: string
  /** Human-readable label derived from `pathToLabelMap` or the raw path segment. */
  label: string
}

/**
 * Renders a horizontal breadcrumb trail derived from the current URL pathname.
 *
 * Route group segments (e.g. `(dashboard)`) and the `/app` root are filtered
 * out. When a flat leaf path (e.g. `/app/Products`) has an entry in
 * `parentAppMap`, its parent app label is prepended as the first breadcrumb.
 *
 * @param props - Component properties.
 * @returns A `<nav aria-label="Breadcrumb">` element with slash-separated
 *   `<Link>` crumbs (ancestor pages) followed by a `<span aria-current="page">`
 *   for the current page. Returns `null` when the pathname produces no
 *   renderable segments (e.g. the dashboard root).
 */
export default function Breadcrumbs({ pathToLabelMap, parentAppMap = {} }: BreadcrumbsProps) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const rawBreadcrumbs: Breadcrumb[] = segments
    .map((_, index) => {
      const path = '/' + segments.slice(0, index + 1).join('/')
      const rawLabel = pathToLabelMap[path]
      const label = rawLabel ?? segments[index]
      return { path, label }
    })
    // Skip route group segments and the /app root (parent app replaces it)
    .filter(({ path, label }) => !label.startsWith('(') && path !== '/app')

  // Inject parent app at the start if the first crumb is a flat leaf (e.g. /app/Products)
  const breadcrumbs: Breadcrumb[] = []
  if (rawBreadcrumbs.length > 0) {
    const firstPath = rawBreadcrumbs[0].path
    const parentInfo = parentAppMap[firstPath] ?? findParentForDynamicPath(firstPath, parentAppMap)
    if (parentInfo) {
      breadcrumbs.push({ path: parentInfo.path, label: parentInfo.label })
    }
  }
  breadcrumbs.push(...rawBreadcrumbs)

  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm"
      aria-label="Breadcrumb"
      data-qqq-id="breadcrumbs"
    >
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path + index}>
          {index > 0 && (
            <span className="text-muted-foreground/60" aria-hidden="true">/</span>
          )}
          {index === breadcrumbs.length - 1 ? (
            <span
              className="max-w-[10rem] truncate font-semibold text-foreground"
              aria-current="page"
              data-qqq-id={`breadcrumb-current-${index}`}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.path}
              className="max-w-[8rem] truncate text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-qqq-id={`breadcrumb-link-${index}`}
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

/**
 * Finds the parent app info for a dynamic path by matching progressively shorter prefixes.
 *
 * For example, for `/app/Products/123` this will try `/app/Products` and `/app`
 * until a matching entry in `parentAppMap` is found.
 *
 * @param path - The dynamic path to find a parent for (e.g. `/app/Products/123`).
 * @param parentAppMap - Map of static paths to their parent app info.
 * @returns The matching `ParentAppInfo`, or `undefined` when no match is found.
 */
function findParentForDynamicPath(
  path: string,
  parentAppMap: Record<string, ParentAppInfo>
): ParentAppInfo | undefined {
  // Try progressively shorter prefixes
  const parts = path.split('/')
  for (let i = parts.length - 1; i >= 2; i--) {
    const prefix = parts.slice(0, i).join('/')
    if (parentAppMap[prefix]) {
      return parentAppMap[prefix]
    }
  }
  return undefined
}
