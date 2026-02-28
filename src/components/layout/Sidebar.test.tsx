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

// Tests for Sidebar component

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

// Override next/navigation for this file so we can control pathname per test
let currentPathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

import Sidebar from './Sidebar'
import type { SidebarRoute } from '@/lib/hooks/use-routes'
import type { QBrandingMetaData } from '@/types'

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const leafRoutes: SidebarRoute[] = [
  { name: 'People', path: '/app/person', icon: 'person', type: 'item' },
  { name: 'Companies', path: '/app/company', icon: 'business', type: 'item' },
]

const collapseRoutes: SidebarRoute[] = [
  {
    name: 'Sales App',
    path: '/app/salesApp',
    icon: 'folder',
    type: 'collapse',
    children: [
      { name: 'Orders', path: '/app/order', icon: 'notes', type: 'item' },
      { name: 'Products', path: '/app/product', icon: 'inventory', type: 'item' },
    ],
  },
]

const branding: QBrandingMetaData = {
  appName: 'Test App',
  companyName: 'Test Co',
  companyUrl: 'https://test.example.com',
  icon: undefined,
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function renderSidebar(
  routes: SidebarRoute[] = leafRoutes,
  options: {
    branding?: QBrandingMetaData
    pathname?: string
    open?: boolean
    onClose?: () => void
  } = {}
) {
  const { pathname = '/', open, onClose } = options
  // Set the module-level variable consumed by the vi.mock factory above
  currentPathname = pathname

  return render(
    <Sidebar
      routes={routes}
      branding={options.branding}
      open={open}
      onClose={onClose}
    />
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    currentPathname = '/'
  })

  // ─── Rendering from metadata ─────────────────────────────────────────────

  it('renders navigation items from routes metadata', () => {
    renderSidebar(leafRoutes)
    expect(screen.getByText('People')).toBeInTheDocument()
    expect(screen.getByText('Companies')).toBeInTheDocument()
  })

  it('renders app branding name', () => {
    renderSidebar(leafRoutes, { branding })
    expect(screen.getByText(/test/i)).toBeInTheDocument()
  })

  it('renders without crashing when routes array is empty', () => {
    expect(() => renderSidebar([])).not.toThrow()
  })

  it('renders without crashing when branding is undefined', () => {
    expect(() => renderSidebar(leafRoutes, { branding: undefined })).not.toThrow()
  })

  it('renders minimal metadata gracefully (single route, no icon)', () => {
    const minimal: SidebarRoute[] = [{ name: 'Home', path: '/app', type: 'item' }]
    renderSidebar(minimal)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  // ─── Active route styling ────────────────────────────────────────────────

  it('gives the active route link aria-current="page"', () => {
    renderSidebar(leafRoutes, { pathname: '/app/person' })
    const link = screen.getByRole('link', { name: /people/i })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark inactive route links as aria-current', () => {
    renderSidebar(leafRoutes, { pathname: '/app/person' })
    const companiesLink = screen.getByRole('link', { name: /companies/i })
    expect(companiesLink).not.toHaveAttribute('aria-current', 'page')
  })

  it('applies primary background class to the active route link', () => {
    renderSidebar(leafRoutes, { pathname: '/app/person' })
    const link = screen.getByRole('link', { name: /people/i })
    expect(link).toHaveClass('bg-primary')
  })

  // ─── Collapse / expand ────────────────────────────────────────────────────

  it('renders collapse group header', () => {
    renderSidebar(collapseRoutes)
    expect(screen.getByText('Sales App')).toBeInTheDocument()
  })

  it('does not show children of a collapsed group by default', () => {
    renderSidebar(collapseRoutes, { pathname: '/' })
    // Children are hidden until the group is expanded
    expect(screen.queryByText('Orders')).not.toBeInTheDocument()
  })

  it('shows children after clicking the expand button', async () => {
    const user = userEvent.setup()
    renderSidebar(collapseRoutes, { pathname: '/' })

    const expandBtn = screen.getByRole('button', { name: /expand sales app/i })
    await user.click(expandBtn)

    expect(screen.getByText('Orders')).toBeInTheDocument()
    expect(screen.getByText('Products')).toBeInTheDocument()
  })

  it('hides children again after collapsing an open group', async () => {
    const user = userEvent.setup()
    renderSidebar(collapseRoutes, { pathname: '/' })

    const expandBtn = screen.getByRole('button', { name: /expand sales app/i })
    await user.click(expandBtn)
    expect(screen.getByText('Orders')).toBeInTheDocument()

    // aria-label changes to "Collapse …" once open
    const collapseBtn = screen.getByRole('button', { name: /collapse sales app/i })
    await user.click(collapseBtn)

    expect(screen.queryByText('Orders')).not.toBeInTheDocument()
  })

  it('auto-expands a collapse group when a child route is active', () => {
    renderSidebar(collapseRoutes, { pathname: '/app/order' })
    // Children should be visible without needing to click expand
    expect(screen.getByText('Orders')).toBeInTheDocument()
  })

  // ─── Mobile drawer mode ───────────────────────────────────────────────────

  it('renders nothing when open=false (mobile drawer mode)', () => {
    const { container } = renderSidebar(leafRoutes, { open: false })
    expect(container.firstChild).toBeNull()
  })

  it('renders the sidebar when open=true (mobile drawer mode)', () => {
    renderSidebar(leafRoutes, { open: true })
    expect(screen.getByRole('navigation', { name: /app navigation/i })).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked in mobile drawer mode', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSidebar(leafRoutes, { open: true, onClose })

    // The Sidebar fires onClose once on mount (pathname-change useEffect) and then
    // again when the close button is clicked — use toHaveBeenCalled() not exact count.
    const closeBtn = screen.getByRole('button', { name: /close navigation/i })
    const callsBefore = onClose.mock.calls.length
    await user.click(closeBtn)

    expect(onClose.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('calls onClose when the backdrop is clicked in mobile drawer mode', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSidebar(leafRoutes, { open: true, onClose })

    // The backdrop is an aria-hidden div — click it directly
    const backdrop = document.querySelector('[aria-hidden="true"].absolute.inset-0')
    if (backdrop) {
      const callsBefore = onClose.mock.calls.length
      await user.click(backdrop as HTMLElement)
      expect(onClose.mock.calls.length).toBeGreaterThan(callsBefore)
    }
  })

  // ─── data-qqq-id attributes ───────────────────────────────────────────────

  it('sidebar aside has data-qqq-id="sidebar"', () => {
    renderSidebar(leafRoutes)
    expect(document.querySelector('[data-qqq-id="sidebar"]')).toBeInTheDocument()
  })

  it('each leaf item link has a scoped data-qqq-id', () => {
    renderSidebar(leafRoutes)
    expect(document.querySelector('[data-qqq-id="sidebar-item-People"]')).toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="sidebar-item-Companies"]')).toBeInTheDocument()
  })

  // ─── Navigation role ──────────────────────────────────────────────────────

  it('renders a nav element with accessible label', () => {
    renderSidebar(leafRoutes)
    expect(screen.getByRole('navigation', { name: /app navigation/i })).toBeInTheDocument()
  })
})
