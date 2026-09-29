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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import { md5Hex } from '@/lib/utils/gravatar'

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const leafRoutes: SidebarRoute[] = [
  { name: 'People', key: 'person', path: '/app/person', icon: { name: 'person' }, nodeType: 'TABLE', type: 'item' },
  { name: 'Companies', key: 'company', path: '/app/company', icon: { name: 'business' }, nodeType: 'TABLE', type: 'item' },
]

const collapseRoutes: SidebarRoute[] = [
  {
    name: 'Sales App',
    key: 'salesApp',
    path: '/app/salesApp',
    icon: { name: 'folder' },
    nodeType: 'APP',
    type: 'collapse',
    children: [
      { name: 'Orders', key: 'order', path: '/app/order', icon: { name: 'notes' }, nodeType: 'TABLE', type: 'item' },
      { name: 'Products', key: 'product', path: '/app/product', icon: { name: 'inventory' }, nodeType: 'TABLE', type: 'item' },
    ],
  },
]

const nestedRoutes: SidebarRoute[] = [
  {
    name: 'Level One',
    key: 'levelOne',
    path: '/app/levelOne',
    icon: { path: '/level-one.png' },
    nodeType: 'APP',
    type: 'collapse',
    children: [
      {
        name: 'Level Two',
        key: 'levelTwo',
        path: '/app/levelTwo',
        icon: { name: 'folder', color: '#b91c1c' },
        nodeType: 'APP',
        type: 'collapse',
        children: [
          {
            name: 'Level Three',
            key: 'levelThree',
            path: '/app/levelThree',
            nodeType: 'APP',
            type: 'collapse',
            children: [{ name: 'Deep Item', key: 'deepItem', path: '/app/deepItem', icon: { name: 'no_such_icon' }, nodeType: 'TABLE', type: 'item' }],
          },
        ],
      },
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
    const minimal: SidebarRoute[] = [{ name: 'Home', key: 'home', path: '/app', type: 'item' }]
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

    const backdrop = document.querySelector('[data-qqq-id="sidebar-mobile-backdrop"]')
    expect(backdrop).not.toBeNull()
    const callsBefore = onClose.mock.calls.length
    await user.click(backdrop as HTMLElement)
    expect(onClose.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  describe('mobile drawer keyboard use', () => {
    /** A page with the header menu button, content behind the drawer, and the drawer. */
    function DrawerPage({ onClose }: { onClose?: () => void }) {
      const [open, setOpen] = React.useState(false)
      const menuButtonRef = React.useRef<HTMLButtonElement>(null)
      return (
        <>
          <button ref={menuButtonRef} type="button" onClick={() => setOpen(true)}>Open navigation menu</button>
          <a href="#behind">Behind the drawer</a>
          <Sidebar
            routes={leafRoutes}
            userName="Avery"
            logout={() => {}}
            open={open}
            onClose={() => { onClose?.(); setOpen(false) }}
            returnFocusRef={menuButtonRef}
          />
        </>
      )
    }

    async function openFromKeyboard() {
      const user = userEvent.setup()
      currentPathname = '/'
      render(<DrawerPage />)
      screen.getByRole('button', { name: 'Open navigation menu' }).focus()
      await user.keyboard('{Enter}')
      const drawer = document.querySelector('[data-qqq-id="sidebar-mobile-drawer"]') as HTMLElement
      expect(drawer).not.toBeNull()
      return { user, drawer }
    }

    it('is a labelled modal dialog that takes focus on open', async () => {
      const { drawer } = await openFromKeyboard()
      expect(drawer).toHaveAttribute('role', 'dialog')
      expect(drawer).toHaveAccessibleName('Navigation')
      expect(drawer.contains(document.activeElement)).toBe(true)
    })

    it('keeps Tab and Shift+Tab inside the drawer', async () => {
      const { user, drawer } = await openFromKeyboard()
      const stops = drawer.querySelectorAll('a[href], button').length
      for (let press = 0; press < stops + 2; press++) {
        await user.tab()
        expect(drawer.contains(document.activeElement)).toBe(true)
      }
      for (let press = 0; press < stops + 2; press++) {
        await user.tab({ shift: true })
        expect(drawer.contains(document.activeElement)).toBe(true)
      }
      expect(screen.queryByRole('link', { name: 'Behind the drawer' })).toBeNull() // hidden from assistive technology
    })

    it('closes on Escape and returns focus to the menu button', async () => {
      const { user } = await openFromKeyboard()
      await user.keyboard('{Escape}')
      expect(document.querySelector('[data-qqq-id="sidebar-mobile-drawer"]')).toBeNull()
      expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveFocus()
    })

    it('returns focus to the menu button when closed by its close button', async () => {
      const { user } = await openFromKeyboard()
      await user.click(screen.getByRole('button', { name: 'Close navigation' }))
      expect(document.querySelector('[data-qqq-id="sidebar-mobile-drawer"]')).toBeNull()
      expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveFocus()
    })

    it('closes when a link is chosen and returns focus to the menu button', async () => {
      const { user } = await openFromKeyboard()
      await user.click(screen.getByRole('link', { name: /Companies/ }))
      expect(document.querySelector('[data-qqq-id="sidebar-mobile-drawer"]')).toBeNull()
      expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveFocus()
    })

    it('lets Escape close an open user menu first and keeps the drawer open', async () => {
      const { user, drawer } = await openFromKeyboard()
      await user.click(screen.getByRole('button', { name: /Avery/ }))
      expect(screen.getByRole('menu')).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).toBeNull()
      expect(drawer.isConnected).toBe(true)
      await user.keyboard('{Escape}')
      expect(document.querySelector('[data-qqq-id="sidebar-mobile-drawer"]')).toBeNull()
    })
  })

  // ─── data-qqq-id attributes ───────────────────────────────────────────────

  it('sidebar aside has data-qqq-id="sidebar"', () => {
    renderSidebar(leafRoutes)
    expect(document.querySelector('[data-qqq-id="sidebar"]')).toBeInTheDocument()
  })

  it('each leaf item link has a scoped data-qqq-id', () => {
    renderSidebar(leafRoutes)
    expect(document.querySelector('[data-qqq-id="sidebar-item-person"]')).toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="sidebar-item-company"]')).toBeInTheDocument()
  })

  // ─── Nesting, icons and branding (#538, #539) ─────────────────────────────

  it('renders app groups nested deeper than two levels and expands every ancestor of the active page', () => {
    renderSidebar(nestedRoutes, { pathname: '/app/deepItem/3' })
    expect(screen.getByRole('link', { name: 'Level Two' })).toHaveAttribute('href', '/app/levelTwo')
    expect(screen.getByRole('link', { name: 'Level Three' })).toHaveAttribute('href', '/app/levelThree')
    expect(screen.getByRole('link', { name: 'Deep Item' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Collapse Level One' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Collapse Level Three' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('expands an app group on its own home page', () => {
    renderSidebar(collapseRoutes, { pathname: '/app/salesApp/' })
    expect(screen.getByRole('link', { name: 'Sales App' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Orders' })).toBeInTheDocument()
  })

  it('renders declared icons: named glyph, colored glyph, image path, and a fallback for unknown names', () => {
    renderSidebar(nestedRoutes, { pathname: '/app/deepItem' })
    const one = document.querySelector('[data-qqq-id="sidebar-collapse-levelOne"] img[data-qqq-icon="path"]')
    expect(one).toHaveAttribute('src', '/level-one.png')
    const two = document.querySelector('[data-qqq-id="sidebar-collapse-levelTwo"] svg[data-qqq-icon="folder"]')
    expect(two).toHaveClass('lucide-folder')
    expect((two as SVGElement).style.color).toBe('rgb(185, 28, 28)')
    const deep = document.querySelector('[data-qqq-id="sidebar-item-deepItem"] svg')
    expect(deep).toHaveAttribute('data-qqq-icon', 'no_such_icon')
    expect(deep).toHaveAttribute('data-qqq-icon-fallback', 'true')
    renderSidebar(leafRoutes)
    expect(document.querySelector('[data-qqq-id="sidebar-item-person"] svg[data-qqq-icon="person"]')).toHaveClass('lucide-user')
  })

  it('shows the branding logo instead of the icon and name when a logo is declared', () => {
    renderSidebar(leafRoutes, { branding: { appName: 'QQQ Sample', logo: '/samples-logo.png', icon: '/kr-icon.png' } })
    const logo = screen.getByRole('img', { name: 'QQQ Sample' })
    expect(logo).toHaveAttribute('src', '/samples-logo.png')
    expect(logo.closest('a')).toHaveAttribute('href', '/app')
    expect(document.querySelector('[data-qqq-id="sidebar-icon"]')).not.toBeInTheDocument()
  })

  it('shows the icon and app name when no logo is declared', () => {
    renderSidebar(leafRoutes, { branding: { appName: 'Plain App', icon: '/icon.png' } })
    expect(document.querySelector('[data-qqq-id="sidebar-icon"]')).toHaveAttribute('src', '/icon.png')
    expect(screen.getByText('Plain App')).toBeInTheDocument()
  })

  it('renders the side-nav banner under the logo', () => {
    renderSidebar(leafRoutes, { branding: { appName: 'A', banners: { QFMD_SIDE_NAV_UNDER_LOGO: { severity: 'INFO', messageText: 'Under logo' } } } })
    expect(screen.getByRole('region', { name: 'Navigation banner' })).toHaveTextContent('Under logo')
  })

  // ─── Navigation role ──────────────────────────────────────────────────────

  it('renders a nav element with accessible label', () => {
    renderSidebar(leafRoutes)
    expect(screen.getByRole('navigation', { name: /app navigation/i })).toBeInTheDocument()
  })

  // ─── Material CSS hooks (QRun-IO/qqq#731) ─────────────────────────────────

  describe('Material CSS hooks', () => {
    it('marks the root, logo area and menu list as Material does', () => {
      renderSidebar(leafRoutes, { branding: { appName: 'Test App', logo: '/logo.png' } })
      const root = document.querySelector('[data-qqq-id="sidenav-root"]')
      expect(root?.closest('[data-qqq-id="sidebar"]')).not.toBeNull()
      expect(root?.querySelector('[data-qqq-id="sidenav-logo-area"] img[src="/logo.png"]')).not.toBeNull()
      const list = document.querySelector('[data-qqq-id="sidenav-menu-list"]')
      expect(list?.tagName).toBe('UL')
      expect(list?.parentElement?.tagName).toBe('NAV')
      // only the top-level list carries the menu-list hook
      expect(document.querySelectorAll('[data-qqq-id="sidenav-menu-list"]')).toHaveLength(1)
    })

    it('gives each navigation item sidenav-{sanitized label}', () => {
      renderSidebar(collapseRoutes, { pathname: '/app/order' })
      expect(document.querySelector('li[data-qqq-id="sidenav-sales-app"]')).toContainElement(screen.getByRole('link', { name: 'Sales App' }))
      expect(document.querySelector('li[data-qqq-id="sidenav-orders"]')).toContainElement(screen.getByRole('link', { name: 'Orders' }))
    })

    it('puts qqq-sidebar-active on the highlighted item only', () => {
      renderSidebar(collapseRoutes, { pathname: '/app/order' })
      const active = document.querySelectorAll('.qqq-sidebar-active')
      expect(active).toHaveLength(1)
      expect(active[0]).toBe(screen.getByRole('link', { name: 'Orders' }))

      renderSidebar(collapseRoutes, { pathname: '/app/salesApp' })
      const exact = document.querySelector('li[data-qqq-id="sidenav-sales-app"] > .qqq-sidebar-active')
      expect(exact).toContainElement(screen.getAllByRole('link', { name: 'Sales App' }).at(-1)!)
    })

    it('marks top-level parent apps with data-qqq-sidenav-item-type', () => {
      renderSidebar(nestedRoutes, { pathname: '/app/deepItem' })
      const typed = document.querySelectorAll('[data-qqq-sidenav-item-type="top-level-parent-app"]')
      expect(typed).toHaveLength(1)
      expect(typed[0]).toContainElement(screen.getByRole('link', { name: 'Level One' }))
    })

    it('marks the user profile and the logout entry', async () => {
      currentPathname = '/'
      render(<Sidebar routes={leafRoutes} userName="Alice" userEmail="alice@example.com" logout={vi.fn()} />)
      const profile = document.querySelector('[data-qqq-sidenav-item-type="user-profile"]')
      expect(profile).toHaveAttribute('data-qqq-id', 'sidebar-user-button')
      await userEvent.setup().click(profile as HTMLElement)
      expect(screen.getByRole('menuitem', { name: 'Log Out' })).toHaveAttribute('data-qqq-id', 'sidenav-logout-button')
    })
  })

  // ─── User entry (Material: Gravatar with gravatarDefault, "Anonymous") ──────

  it('returns preferences focus to the user menu button after the menu item unmounts', async () => {
    const user = userEvent.setup()
    render(<Sidebar routes={leafRoutes} userName="Alice" />)
    const trigger = screen.getByRole('button', { name: 'Alice' })
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Preferences' }))
    expect(screen.getByRole('dialog', { name: 'Preferences' })).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('names a user without a name "Anonymous" and shows the initial without a Gravatar setting', () => {
    render(<Sidebar routes={leafRoutes} branding={{ companyName: '', companyUrl: '', appName: 'QQQ' }} userEmail="ann@example.com" logout={vi.fn()} />)
    expect(document.querySelector('[data-qqq-id="sidebar-user-name"]')).toHaveTextContent('Anonymous')
    expect(document.querySelector('[data-qqq-id="sidebar-user-email"]')).toHaveTextContent('ann@example.com')
    expect(document.querySelector('[data-qqq-id="sidebar-user-avatar"]')?.tagName).toBe('DIV')
    expect(document.querySelector('img[data-qqq-id="sidebar-user-avatar"]')).toBeNull()
  })

  it('shows the Gravatar when the branding declares gravatarDefault, and the initial if it fails', () => {
    const branding: QBrandingMetaData = { companyName: '', companyUrl: '', appName: 'QQQ', gravatarDefault: 'identicon' }
    render(<Sidebar routes={leafRoutes} branding={branding} userName="Avery" userEmail="avery@example.com" logout={vi.fn()} />)
    const avatar = document.querySelector('img[data-qqq-id="sidebar-user-avatar"]')!
    expect(avatar).toHaveAttribute('src', `https://www.gravatar.com/avatar/${md5Hex('avery@example.com')}?d=identicon`)
    fireEvent.error(avatar)
    expect(document.querySelector('[data-qqq-id="sidebar-user-avatar"]')).toHaveTextContent('A')
  })
})
