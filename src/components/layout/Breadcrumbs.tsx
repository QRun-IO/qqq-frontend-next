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

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home } from 'lucide-react'
import * as Menu from '@radix-ui/react-dropdown-menu'

import type { ParentAppInfo } from '@/lib/hooks/use-routes'

/**
 * Props for the Breadcrumbs component.
 */
export interface BreadcrumbsProps {
  /** Maps route paths to their display labels (e.g. `/app/person` → `"Person"`). */
  pathToLabelMap: Record<string, string>
  /** Maps node paths to their enclosing apps, outermost first. */
  ancestorAppMap?: Record<string, ParentAppInfo[]>
  /** Where the home crumb links: the instance's home app, or the `/app` overview (default). */
  homePath?: string
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
 * Turns a URL segment without a metadata label into a readable one, as Material's
 * `routeToLabel` does: the first `.`, `-` and `_` become spaces, camelCase words are split
 * (`personUSA` becomes `person USA`, `USAPerson` becomes `USA Person`) and the first letter
 * is capitalized.
 *
 * @param segment - A decoded URL segment.
 * @returns The humanized label.
 */
export function humanizeSegment(segment: string): string {
  const label = segment
    .replace('.', ' ')
    .replace('-', ' ')
    .replace('_', ' ')
    .replace(/([a-z])([A-Z]+)/g, '$1 $2')
    .replace(/^([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : label
}

/**
 * Builds the breadcrumb trail for a dashboard path.
 *
 * URLs are flat (`/app/{name}/...`), so the enclosing apps of `{name}` come from
 * `ancestorAppMap` and are placed first, followed by the node itself and any
 * sub-page segments (record id, `edit`, `create`, ...). The `/app` root yields
 * no crumbs. A saved-view path ends with a single "Saved View" crumb. A segment
 * naming a process or report under a table (Material's `/app/{table}/{process}`
 * and `/app/{table}/{id}/{process}` URLs) takes that object's label; other
 * segments without a label are humanized, except a record id, which stays as is.
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
  crumbs.push({ path: nodePath, label: pathToLabelMap[nodePath] ?? humanizeSegment(decodeSegment(segments[1])) })

  let path = nodePath
  const rest = segments.slice(2)
  for (let index = 0; index < rest.length; index++) {
    const segment = rest[index]
    if (segment === 'savedView' && rest[index + 1]) {
      crumbs.push({ path: `${path}/savedView/${rest[index + 1]}`, label: 'Saved View' })
      break
    }
    path = `${path}/${segment}`
    const decoded = decodeSegment(segment)
    const label = pathToLabelMap[path] ?? SEGMENT_LABELS[segment] ?? pathToLabelMap[`/app/${encodeURIComponent(decoded)}`]
      ?? (index === 0 ? decoded : humanizeSegment(decoded))
    crumbs.push({ path, label })
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
 * Selects middle crumbs for the menu when the trail exceeds its visible budget.
 * @param crumbs - Complete trail, excluding the home icon.
 * @param maxVisible - Number of crumbs that fit in the available header space.
 * @returns Hidden middle crumbs, preserving their original order.
 */
export function getHiddenBreadcrumbs(crumbs: Breadcrumb[], maxVisible: number): Breadcrumb[] {
  return crumbs.length > Math.max(2, maxVisible) ? crumbs.slice(1, -1) : []
}

/**
 * Renders a horizontal breadcrumb trail for the current page.
 *
 * @param props - Component properties.
 * @returns A `<nav aria-label="Breadcrumb">` element with slash-separated
 *   `<Link>` crumbs (ancestor pages) followed by a `<span aria-current="page">`
 *   for the current page, or `null` on the dashboard root and before labels load.
 */
export default function Breadcrumbs({ pathToLabelMap, ancestorAppMap = {}, homePath = '/app' }: BreadcrumbsProps) {
  const pathname = usePathname()
  const breadcrumbs = buildBreadcrumbs(pathname, pathToLabelMap, ancestorAppMap)
  const trailRef = useRef<HTMLElement>(null)
  const hasLabels = Object.keys(pathToLabelMap).length > 0

  const [availableWidth, setAvailableWidth] = useState(0)
  // Use the actual space left by header controls, including on tablets with a sidebar.
  useEffect(() => {
    const trail = trailRef.current
    if (!trail) return
    const measure = () => setAvailableWidth(trail.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(trail)
    return () => observer.disconnect()
  }, [hasLabels, breadcrumbs.length])

  const hiddenCrumbs = getHiddenBreadcrumbs(breadcrumbs, Math.max(2, Math.floor(availableWidth / 120)))

  // Until metadata supplies labels, raw URL segments would flash in place of labels
  if (breadcrumbs.length === 0 || !hasLabels) {
    return null
  }

  return (
    <nav
      ref={trailRef}
      className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 whitespace-nowrap text-sm"
      aria-label="Breadcrumb"
      data-qqq-id="breadcrumbs"
    >
      {/* Home crumb (Material's home icon), back to the home page (the home app, or the overview) */}
      <Link
        href={homePath}
        aria-label="Home"
        className="inline-flex shrink-0 items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
        data-qqq-id="breadcrumb-home"
      >
        <Home className="h-4 w-4" aria-hidden="true" />
      </Link>
      {breadcrumbs.map((crumb, index) => hiddenCrumbs.includes(crumb) ? (
        index === 1 ? (
          <React.Fragment key="collapsed">
            <span className="shrink-0 text-muted-foreground/60" aria-hidden="true">/</span>
            <Menu.Root>
              <Menu.Trigger
                aria-label="Show hidden breadcrumbs"
                className="shrink-0 rounded px-1 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                data-qqq-id="breadcrumb-ellipsis"
              >
                …
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content align="start" sideOffset={4} collisionPadding={8} className="z-50 max-w-[calc(100vw-1rem)] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                  {hiddenCrumbs.map((hidden, hiddenIndex) => (
                    <Menu.Item key={hidden.path + hiddenIndex} asChild>
                      <Link href={hidden.path} data-qqq-id={`breadcrumb-link-${hiddenIndex + 1}`} className="block rounded px-3 py-2 text-sm break-words outline-none focus:bg-accent">
                        {hidden.label}
                      </Link>
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          </React.Fragment>
        ) : null
      ) : (
        <React.Fragment key={crumb.path + index}>
          <span className="shrink-0 text-muted-foreground/60" aria-hidden="true">/</span>
          {index === breadcrumbs.length - 1 ? (
            <span
              className="min-w-0 truncate font-semibold text-foreground"
              title={crumb.label}
              aria-current="page"
              data-qqq-id={`breadcrumb-current-${index}`}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              title={crumb.label}
              href={crumb.path}
              className="min-w-0 max-w-[10rem] truncate text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:py-3"
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
