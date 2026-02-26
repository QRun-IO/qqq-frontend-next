'use client'

// Breadcrumbs component — auto-generates from current pathname using pathToLabelMap

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbsProps {
  pathToLabelMap: Record<string, string>
  separator?: string
}

interface Breadcrumb {
  path: string
  label: string
}

export default function Breadcrumbs({ pathToLabelMap }: BreadcrumbsProps) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const breadcrumbs: Breadcrumb[] = segments
    .map((_, index) => {
      const path = '/' + segments.slice(0, index + 1).join('/')
      const rawLabel = pathToLabelMap[path]
      const label = rawLabel ?? segments[index]
      return { path, label }
    })
    // Skip route group segments like (dashboard), (auth)
    .filter(({ path, label }) => !label.startsWith('(') && path !== '/(dashboard)')

  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav
      className="flex items-center gap-1 text-sm"
      aria-label="Breadcrumb"
      data-qqq-id="breadcrumbs"
    >
      <Link
        href="/"
        className="flex items-center gap-1 text-gray-500 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Home"
        data-qqq-id="breadcrumb-link-home"
      >
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Home</span>
      </Link>

      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          <ChevronRight
            className="h-3.5 w-3.5 flex-shrink-0 text-gray-400"
            aria-hidden="true"
          />
          {index === breadcrumbs.length - 1 ? (
            <span
              className="font-medium text-gray-900 dark:text-gray-100"
              aria-current="page"
              data-qqq-id={`breadcrumb-current-${index}`}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.path}
              className="text-gray-500 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
