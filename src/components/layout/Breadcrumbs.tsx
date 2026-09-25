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
 * @file Breadcrumbs — breadcrumb trail for the current page, including the full app hierarchy.
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
  /** Maps route paths to their display labels (e.g. `/app/person` → `"Person"`). */
  pathToLabelMap: Record<string, string>
  /** Maps node paths to their enclosing apps, outermost first. */
  ancestorAppMap?: Record<string, ParentAppInfo[]>
}

/**
 * A single breadcrumb entry with its navigable path and display label.
 */
export interface Breadcrumb {
  /** Absolute URL path for this breadcrumb link. */
  path: string
  /** Human-readable label. */
  label: string
}

/** Labels for the fixed sub-page segments under a table or record. */
const SEGMENT_LABELS: Record<string, string> = {
  edit: 'Edit',
  copy: 'Copy',
  dev: 'Developer',
  create: 'Create',
  key: 'View by Key',
}

/**
 * Decodes one URL segment, tolerating malformed escapes.
 *
 * @param segment - Raw path segment.
 * @returns The decoded segment.
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Builds the breadcrumb trail for a dashboard path.
 *
 * URLs are flat (`/app/{name}/...`), so the enclosing apps of `{name}` come from
 * `ancestorAppMap` and are placed first, followed by the node itself and any
 * sub-page segments (record id, `edit`, `create`, ...). The `/app` root yields
 * no crumbs. A saved-view path ends with a single "Saved View" crumb.
 *
 * @param pathname - Current browser path.
 * @param pathToLabelMap - Route path → label.
 * @param ancestorAppMap - Node path → enclosing apps.
 * @returns Breadcrumbs from the outermost app to the current page.
 */
export function buildBreadcrumbs(
  pathname: string,
  pathToLabelMap: Record<string, string>,
  ancestorAppMap: Record<string, ParentAppInfo[]> = {}
): Breadcrumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'app' || segments.length < 2) return []

  const nodePath = `/app/${segments[1]}`
  const crumbs: Breadcrumb[] = (ancestorAppMap[nodePath] ?? []).map(({ label, path }) => ({ label, path }))
  crumbs.push({ path: nodePath, label: pathToLabelMap[nodePath] ?? decodeSegment(segments[1]) })

  let path = nodePath
  const rest = segments.slice(2)
  for (let index = 0; index < rest.length; index++) {
    const segment = rest[index]
    if (segment === 'savedView' && rest[index + 1]) {
      crumbs.push({ path: `${path}/savedView/${rest[index + 1]}`, label: 'Saved View' })
      break
    }
    path = `${path}/${segment}`
    crumbs.push({ path, label: pathToLabelMap[path] ?? SEGMENT_LABELS[segment] ?? decodeSegment(segment) })
  }
  return crumbs
}

/**
 * Builds the document title for the current page, Material Dashboard style:
 * the page title, then each enclosing breadcrumb from nearest to outermost,
 * then the application name, separated by ` | `.
 *
 * @param crumbs - Breadcrumbs for the current page.
 * @param pageTitle - Page header set by the page, used for the current page when present.
 * @param appName - Application name from branding.
 * @returns The document title.
 */
export function buildDocumentTitle(crumbs: Breadcrumb[], pageTitle: string | undefined, appName: string): string {
  const current = pageTitle?.trim() || crumbs[crumbs.length - 1]?.label
  const enclosing = crumbs.slice(0, -1).map((crumb) => crumb.label).reverse()
  return [current, ...enclosing, appName].filter((part): part is string => Boolean(part)).join(' | ')
}

/**
 * Renders a horizontal breadcrumb trail for the current page.
 *
 * @param props - Component properties.
 * @returns A `<nav aria-label="Breadcrumb">` element with slash-separated
 *   `<Link>` crumbs (ancestor pages) followed by a `<span aria-current="page">`
 *   for the current page, or `null` on the dashboard root and before labels load.
 */
export default function Breadcrumbs({ pathToLabelMap, ancestorAppMap = {} }: BreadcrumbsProps) {
  const pathname = usePathname()
  const breadcrumbs = buildBreadcrumbs(pathname, pathToLabelMap, ancestorAppMap)

  // Until metadata supplies labels, raw URL segments would flash in place of labels
  if (breadcrumbs.length === 0 || Object.keys(pathToLabelMap).length === 0) {
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
              className="max-w-[12rem] truncate font-semibold text-foreground"
              aria-current="page"
              data-qqq-id={`breadcrumb-current-${index}`}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.path}
              className="max-w-[10rem] truncate text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
