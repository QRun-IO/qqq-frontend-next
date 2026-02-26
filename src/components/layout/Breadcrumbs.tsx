'use client'

// Breadcrumbs component — auto-generates from current pathname using pathToLabelMap
// Injects parent app name for flat URLs (e.g. /app/Products → Dashboard / Inventory / Products)

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { ParentAppInfo } from '@/lib/hooks/use-routes'

export interface BreadcrumbsProps {
  pathToLabelMap: Record<string, string>
  /** Maps flat leaf paths to their parent app for breadcrumb injection */
  parentAppMap?: Record<string, ParentAppInfo>
}

interface Breadcrumb {
  path: string
  label: string
}

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
      className="flex items-center gap-2 text-sm"
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
              className="font-semibold text-foreground"
              aria-current="page"
              data-qqq-id={`breadcrumb-current-${index}`}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.path}
              className="text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

/** For dynamic paths like /app/Products/123, find parent by matching /app/Products */
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
