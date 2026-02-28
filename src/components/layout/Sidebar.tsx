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

'use client'

/** Sidebar — hierarchical navigation panel rendered from the app tree metadata, supporting both desktop static layout and mobile drawer overlay. */

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  X,
  Users,
  User,
  Building2,
  ShoppingCart,
  Upload,
  Mail,
  Package,
  Truck,
  BarChart3,
  FileText,
  ImageIcon,
  Warehouse,
  Info,
  MapPin,
  Settings,
  LayoutDashboard,
  FolderOpen,
  Table,
  Workflow,
  Layers,
  LogOut,
  type LucideIcon,
} from 'lucide-react'

import type { QBrandingMetaData } from '@/types'
import type { SidebarRoute } from '@/lib/hooks/use-routes'
import { cn } from '@/lib/utils/cn'
import { UserPreferencesDialog } from './UserPreferencesDialog'

/**
 * Maps Material Icons name strings (as they appear in QQQ metadata) to the
 * equivalent Lucide icon components used in the sidebar.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  people_alt: Users,
  people: Users,
  person: User,
  business: Building2,
  shopping_cart: ShoppingCart,
  upload_file: Upload,
  email: Mail,
  inventory: Package,
  inventory_2: Package,
  local_shipping: Truck,
  bar_chart: BarChart3,
  notes: FileText,
  image: ImageIcon,
  warehouse: Warehouse,
  info: Info,
  location_on: MapPin,
  settings: Settings,
  dashboard: LayoutDashboard,
  folder: FolderOpen,
  table_chart: Table,
  account_tree: Workflow,
  layers: Layers,
}

/**
 * Renders a Lucide icon component that corresponds to a QQQ metadata icon name.
 *
 * Falls back to `FolderOpen` when the name is absent or unknown.
 *
 * @param iconName - Material Icons name string from QQQ metadata.
 * @param className - Tailwind class string applied to the icon element.
 * @returns An `aria-hidden` Lucide icon element.
 */
function NavIcon({ iconName, className }: { iconName?: string; className?: string }) {
  if (!iconName) {
    return <FolderOpen className={className} aria-hidden="true" />
  }
  const Icon = ICON_MAP[iconName] ?? FolderOpen
  return <Icon className={className} aria-hidden="true" />
}

/**
 * Props for the Sidebar component.
 */
export interface SidebarProps {
  /** Hierarchical navigation routes derived from the QQQ app-tree metadata. */
  routes: SidebarRoute[]
  /** Application branding metadata (logo, app name). */
  branding?: QBrandingMetaData
  /** Called when the mouse enters the sidebar (desktop hover expansion). */
  onMouseEnter?: () => void
  /** Called when the mouse leaves the sidebar (desktop hover collapse). */
  onMouseLeave?: () => void
  /** Logout handler passed to the user footer menu. */
  logout?: () => void
  /** Display name of the logged-in user shown in the footer. */
  userName?: string
  /** Email of the logged-in user shown in the footer. */
  userEmail?: string
  /** When provided the sidebar renders as a mobile drawer overlay; `true` = open. */
  open?: boolean
  /** Called when the mobile drawer overlay should close (backdrop click or close button). */
  onClose?: () => void
}

/**
 * Hierarchical sidebar navigation panel.
 *
 * On desktop (`md+`) the sidebar is rendered as a static column. When `open`
 * is supplied it switches to a mobile drawer overlay with a backdrop. The
 * component auto-expands the collapse group that contains the active route,
 * and closes the mobile drawer on route changes.
 *
 * @param routes - Sidebar routes from the QQQ app-tree metadata.
 * @param branding - Branding metadata for the logo and app name.
 * @param onMouseEnter - Called on mouse-enter (desktop hover expansion).
 * @param onMouseLeave - Called on mouse-leave (desktop hover collapse).
 * @param logout - Logout handler surfaced in the user footer menu.
 * @param userName - Logged-in user display name.
 * @param userEmail - Logged-in user email.
 * @param open - Controls mobile drawer visibility; omit for desktop mode.
 * @param onClose - Called when the mobile drawer should close.
 * @returns The sidebar aside element or a drawer overlay wrapping it.
 */
export default function Sidebar({
  routes,
  branding,
  onMouseEnter,
  onMouseLeave,
  logout,
  userName,
  userEmail,
  open,
  onClose,
}: SidebarProps) {
  const pathname = usePathname()
  const [openCollapses, setOpenCollapses] = React.useState<Record<string, boolean>>({})

  // Auto-expand the collapse group containing the current route
  useEffect(() => {
    const expanded: Record<string, boolean> = {}
    for (const route of routes) {
      if (route.type === 'collapse' && route.children?.length) {
        const isChildActive = route.children.some(
          (child) => pathname === child.path || pathname.startsWith(child.path + '/')
        )
        if (isChildActive) {
          expanded[route.path] = true
        }
      }
    }
    if (Object.keys(expanded).length > 0) {
      setOpenCollapses((prev) => ({ ...prev, ...expanded }))
    }
  }, [pathname, routes])

  // Close mobile drawer on route change
  // intentional: onClose is omitted from deps — we only want this to fire
  // when the route changes, not when the callback reference changes
  useEffect(() => {
    onClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  /**
   * Toggles the open/closed state of a collapsible navigation group.
   *
   * @param path - The route path used as the key for the group's open state.
   */
  const toggleCollapse = (path: string) => {
    setOpenCollapses((prev) => ({
      ...prev,
      [path]: !prev[path],
    }))
  }

  // Determine if we are in mobile drawer mode (open prop provided)
  const isMobileDrawer = open !== undefined

  const asideEl = (
    <aside
      className="flex h-full w-64 flex-col overflow-hidden border-r border-border bg-sidebar text-foreground"
      onMouseEnter={!isMobileDrawer ? onMouseEnter : undefined}
      onMouseLeave={!isMobileDrawer ? onMouseLeave : undefined}
      data-qqq-id="sidebar"
      aria-label="Main navigation"
    >
      {/* Logo / App Branding — height matches header so border lines up */}
      <div className="flex items-center border-b border-border px-4" style={{ height: 'var(--qqq-header-height)' }}>
        {branding?.icon ? (
          <Image
            src={branding.icon}
            alt={branding.appName || 'QQQ'}
            className="h-14 w-auto flex-shrink-0"
            width={112}
            height={56}
            unoptimized
          />
        ) : (
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground"
            aria-hidden="true"
          >
            Q
          </div>
        )}
        {/* Vertical divider + app name */}
        <div className="ml-4 flex items-center border-l border-border/60 pl-4" style={{ height: '60%' }}>
          <span className="text-sm font-semibold uppercase leading-tight tracking-wider text-muted-foreground">
            {(branding?.appName || 'QQQ Admin').split(' ').map((word, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {word}
              </React.Fragment>
            ))}
          </span>
        </div>
        {/* Close button for mobile drawer */}
        {isMobileDrawer && (
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close navigation"
            data-qqq-id="button-sidebar-close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 pt-4 pb-4"
        role="navigation"
        aria-label="App navigation"
      >
        <ul className="space-y-0.5" role="list">
          {routes.map((route) =>
            route.type === 'collapse' && route.children?.length ? (
              <SidebarCollapseItem
                key={route.path}
                route={route}
                isOpen={openCollapses[route.path] ?? false}
                onToggle={() => toggleCollapse(route.path)}
                isActive={pathname.startsWith(route.path)}
                pathname={pathname}
              />
            ) : (
              <SidebarLinkItem
                key={route.path}
                route={route}
                isActive={route.path === '/app' ? pathname === '/app' : pathname === route.path || pathname.startsWith(route.path + '/')}
              />
            )
          )}
        </ul>
      </nav>

      {/* User info footer with menu */}
      {(userName || userEmail || logout) && (
        <UserFooter
          userName={userName}
          userEmail={userEmail}
          logout={logout}
        />
      )}
    </aside>
  )

  // Mobile drawer mode — render as fixed overlay
  if (isMobileDrawer) {
    if (!open) return null
    return (
      <div
        className="fixed inset-0 z-[var(--qqq-z-sidebar,100)] flex"
        data-qqq-id="sidebar-mobile-drawer"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Drawer panel */}
        <div className="relative flex h-full flex-col shadow-lg">
          {asideEl}
        </div>
      </div>
    )
  }

  // Desktop: render as a static sidebar
  return (
    <div className="hidden md:flex h-screen flex-shrink-0" data-qqq-id="sidebar-desktop">
      {asideEl}
    </div>
  )
}

/**
 * Props for the SidebarCollapseItem component.
 */
interface SidebarCollapseItemProps {
  /** The parent route whose children are rendered in the collapsible list. */
  route: SidebarRoute
  /** Whether the collapsible group is currently expanded. */
  isOpen: boolean
  /** Callback to toggle the open/closed state of this group. */
  onToggle: () => void
  /** Whether any path under this route is currently active. */
  isActive: boolean
  /** Current Next.js pathname for computing active state of child routes. */
  pathname: string
}

/**
 * Renders a collapsible sidebar group with a linked app-name header and an
 * expand/collapse chevron button.
 *
 * The header links to the app dashboard; the chevron toggles visibility of
 * the child routes. The active style is applied when any descendant path
 * matches the current route; an exact-match style is applied when on the
 * app dashboard itself.
 *
 * @param route - The parent collapsible route definition.
 * @param isOpen - Whether the child list is currently visible.
 * @param onToggle - Callback to flip the expanded state.
 * @param isActive - Whether any descendant is the current route.
 * @param pathname - The current Next.js pathname.
 * @returns A list item containing the collapsible header and optional child list.
 */
function SidebarCollapseItem({
  route,
  isOpen,
  onToggle,
  isActive,
  pathname,
}: SidebarCollapseItemProps) {
  // Exact match = on the app dashboard itself; gets full highlight like leaf items
  const isExactActive = pathname === route.path || pathname === route.path + '/'

  return (
    <li role="listitem">
      <div className={`flex items-center rounded-lg transition-colors ${
        isExactActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : isActive
            ? 'text-primary'
            : 'text-foreground/70 hover:bg-accent hover:text-foreground'
      }`}>
        {/* App name — links to app dashboard */}
        <Link
          href={route.path}
          className="flex flex-1 items-center gap-3 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-l-lg"
          aria-current={isExactActive ? 'page' : undefined}
          data-qqq-id={`sidebar-collapse-${route.name}`}
        >
          <NavIcon iconName={route.icon} className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate text-left">{route.name}</span>
        </Link>
        {/* Chevron — toggles expand/collapse */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center px-2 py-2 rounded-r-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${route.name}`}
        >
          {isOpen ? (
            <ChevronDown className={`h-4 w-4 flex-shrink-0 ${isExactActive ? 'opacity-70' : 'opacity-50'}`} aria-hidden="true" />
          ) : (
            <ChevronRight className={`h-4 w-4 flex-shrink-0 ${isExactActive ? 'opacity-70' : 'opacity-50'}`} aria-hidden="true" />
          )}
        </button>
      </div>

      {isOpen && route.children && (
        <ul className="mt-0.5 space-y-0.5 pl-3" role="list">
          {route.children.map((child) => (
            <SidebarLinkItem
              key={child.path}
              route={child}
              isActive={pathname === child.path || pathname.startsWith(child.path + '/')}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Props for the SidebarLinkItem component.
 */
interface SidebarLinkItemProps {
  /** The leaf-level route to render as a navigation link. */
  route: SidebarRoute
  /** Whether this route is the currently active page. */
  isActive: boolean
}

/**
 * Renders a single navigable sidebar list item.
 *
 * Applies a primary background highlight when the route is active, and shows
 * the route's icon (mapped from the QQQ metadata icon name) alongside the label.
 *
 * @param route - The leaf-level route definition.
 * @param isActive - Whether this item corresponds to the current page.
 * @returns A `<li>` containing a `<Link>` styled as a sidebar navigation item.
 */
function SidebarLinkItem({ route, isActive }: SidebarLinkItemProps) {
  return (
    <li role="listitem">
      <Link
        href={route.path}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-foreground/70 hover:bg-accent hover:text-foreground'
        }`}
        aria-current={isActive ? 'page' : undefined}
        data-qqq-id={`sidebar-item-${route.name}`}
      >
        <NavIcon iconName={route.icon} className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{route.name}</span>
      </Link>
    </li>
  )
}

// --- User footer with popover menu ---

/**
 * Renders the sticky user-info footer at the bottom of the sidebar.
 *
 * Clicking the footer opens a popover menu with a Preferences entry and,
 * when `logout` is provided, a Log Out entry. The menu closes on outside
 * click, Escape key, or after an item is selected.
 *
 * @param userName - Display name of the authenticated user.
 * @param userEmail - Email of the authenticated user.
 * @param logout - Optional logout callback; menu shows Log Out only when present.
 * @returns The footer element including the popover menu and the UserPreferencesDialog.
 */
function UserFooter({
  userName,
  userEmail,
  logout,
}: {
  userName?: string
  userEmail?: string
  logout?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [menuOpen])

  return (
    <>
      <div className="relative border-t border-border" ref={menuRef}>
        {/* Popover menu — positioned above the user info */}
        {menuOpen && (
          <div
            className={cn(
              'absolute bottom-full left-2 right-2 mb-1 rounded-xl border border-border bg-popover shadow-lg',
              'animate-in fade-in-0 slide-in-from-bottom-2 duration-150'
            )}
            role="menu"
            data-qqq-id="sidebar-user-menu"
          >
            <div className="py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  setPrefsOpen(true)
                }}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground',
                  'hover:bg-accent transition-colors',
                  'focus:outline-none focus:bg-accent'
                )}
                data-qqq-id="menu-item-preferences"
              >
                <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Preferences
              </button>
              {logout && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground',
                    'hover:bg-accent transition-colors',
                    'focus:outline-none focus:bg-accent'
                  )}
                  data-qqq-id="menu-item-logout"
                >
                  <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Log Out
                </button>
              )}
            </div>
          </div>
        )}

        {/* Clickable user info bar */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-4 text-left transition-colors',
            'hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
          )}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-qqq-id="sidebar-user-button"
        >
          {/* Avatar circle */}
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold text-foreground"
            aria-hidden="true"
            data-qqq-id="sidebar-user-avatar"
          >
            {userName ? userName.charAt(0).toUpperCase() : userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            {userName && (
              <span className="truncate text-sm font-medium text-foreground" data-qqq-id="sidebar-user-name">
                {userName}
              </span>
            )}
            {userEmail && (
              <span className="truncate text-xs text-muted-foreground" data-qqq-id="sidebar-user-email">
                {userEmail}
              </span>
            )}
          </div>
          {menuOpen ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Preferences dialog */}
      <UserPreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
  )
}
