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

// Tests for Breadcrumbs component and its trail/title builders

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

let currentPathname = '/app/person'
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

import Breadcrumbs, { buildBreadcrumbs, buildDocumentTitle } from './Breadcrumbs'
import type { ParentAppInfo } from '@/lib/hooks/use-routes'

const pathToLabelMap: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/peopleApp': 'People App',
  '/app/greetingsApp': 'Greetings App',
  '/app/person': 'Person',
  '/app/person/create': 'Create Person',
}
const ancestorAppMap: Record<string, ParentAppInfo[]> = {
  '/app/peopleApp': [],
  '/app/greetingsApp': [{ label: 'People App', path: '/app/peopleApp' }],
  '/app/person': [
    { label: 'People App', path: '/app/peopleApp' },
    { label: 'Greetings App', path: '/app/greetingsApp' },
  ],
}

describe('buildBreadcrumbs', () => {
  it('prefixes a flat node path with every enclosing app, outermost first', () => {
    expect(buildBreadcrumbs('/app/person', pathToLabelMap, ancestorAppMap)).toEqual([
      { path: '/app/peopleApp', label: 'People App' },
      { path: '/app/greetingsApp', label: 'Greetings App' },
      { path: '/app/person', label: 'Person' },
    ])
  })

  it('labels record and action segments below a table', () => {
    const crumbs = buildBreadcrumbs('/app/person/7/edit/', pathToLabelMap, ancestorAppMap)
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['People App', 'Greetings App', 'Person', '7', 'Edit'])
    expect(crumbs[3].path).toBe('/app/person/7')
  })

  it('uses the registered create label', () => {
    expect(buildBreadcrumbs('/app/person/create', pathToLabelMap, ancestorAppMap).at(-1)).toEqual({
      path: '/app/person/create',
      label: 'Create Person',
    })
  })

  it('collapses a saved view to a single crumb', () => {
    expect(buildBreadcrumbs('/app/person/savedView/3', pathToLabelMap, ancestorAppMap).slice(-2)).toEqual([
      { path: '/app/person', label: 'Person' },
      { path: '/app/person/savedView/3', label: 'Saved View' },
    ])
  })

  it('returns no crumbs for the dashboard root and for paths outside /app', () => {
    expect(buildBreadcrumbs('/app', pathToLabelMap, ancestorAppMap)).toEqual([])
    expect(buildBreadcrumbs('/login', pathToLabelMap, ancestorAppMap)).toEqual([])
  })

  it('falls back to the decoded segment for unknown names', () => {
    expect(buildBreadcrumbs('/app/no%20such', {}, {})).toEqual([{ path: '/app/no%20such', label: 'no such' }])
  })
})

describe('buildDocumentTitle', () => {
  const crumbs = buildBreadcrumbs('/app/person/1', pathToLabelMap, ancestorAppMap)

  it('orders the page title, then enclosing crumbs nearest first, then the app name', () => {
    expect(buildDocumentTitle(crumbs, 'Avery Sample', 'QQQ Sample')).toBe('Avery Sample | Person | Greetings App | People App | QQQ Sample')
  })

  it('uses the last crumb when the page sets no title', () => {
    expect(buildDocumentTitle(crumbs.slice(0, 3), '', 'QQQ Sample')).toBe('Person | Greetings App | People App | QQQ Sample')
  })

  it('is just the page and app name on the dashboard', () => {
    expect(buildDocumentTitle([], 'Dashboard', 'QQQ Sample')).toBe('Dashboard | QQQ Sample')
  })
})

describe('Breadcrumbs', () => {
  beforeEach(() => {
    currentPathname = '/app/person'
  })

  it('renders the app hierarchy as links and the current page as text', () => {
    render(<Breadcrumbs pathToLabelMap={pathToLabelMap} ancestorAppMap={ancestorAppMap} />)
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(nav).toHaveAttribute('data-qqq-id', 'breadcrumbs')
    expect(screen.getByRole('link', { name: 'People App' })).toHaveAttribute('href', '/app/peopleApp')
    expect(screen.getByRole('link', { name: 'Greetings App' })).toHaveAttribute('href', '/app/greetingsApp')
    expect(screen.getByText('Person')).toHaveAttribute('aria-current', 'page')
  })

  it('renders nothing until metadata supplies labels (no flash of raw URL segments)', () => {
    const { container } = render(<Breadcrumbs pathToLabelMap={{}} ancestorAppMap={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on the dashboard root', () => {
    currentPathname = '/app'
    const { container } = render(<Breadcrumbs pathToLabelMap={pathToLabelMap} ancestorAppMap={ancestorAppMap} />)
    expect(container).toBeEmptyDOMElement()
  })
})
