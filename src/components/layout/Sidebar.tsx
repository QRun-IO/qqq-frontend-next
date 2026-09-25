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
 * @file Sidebar — hierarchical navigation panel rendered from app-tree metadata, supporting desktop and mobile drawer layouts.
 */

'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  X,
  Settings,
  LogOut,
} from 'lucide-react'

import type { QBrandingMetaData } from '@/types'
import type { SidebarRoute } from '@/lib/hooks/use-routes'
import { cn } from '@/lib/utils/cn'
import { UserPreferencesDialog } from './UserPreferencesDialog'
import BannerComponent from './Banner'
import { MetadataIcon, type MetadataIconKind } from './MetadataIcon'

/** Fallback icon kind for each app-tree node type. */
const ICON_KIND: Record<string, MetadataIconKind> = { APP: 'app', TABLE: 'table', PROCESS: 'process', REPORT: 'report' }

/**
 * Renders the metadata icon of a sidebar route.
 *
 * @param props - Component properties.
 * @param props.route - Route whose icon to render.
 * @returns The route's icon element.
 */
function NavIcon({ route }: { route: SidebarRoute }) {
  return <MetadataIcon icon={route.icon} kind={route.nodeType ? ICON_KIND[route.nodeType] : 'app'} />
}

/**
 * Whether `pathname` is `path` or one of its sub-pages.
 *
 * @param pathname - Current browser path.
 * @param path - Route path.
 * @returns `true` when the route is active.
 */
function matchesPath(pathname: string, path: string): boolean {
  const current = pathname.replace(/\/+$/, '') || '/'
  return current === path || current.startsWith(path + '/')
}

/**
 * Whether a route or any descendant matches `pathname`.
 *
 * @param route - Sidebar route.
 * @param pathname - Current browser path.
 * @returns `true` when the route subtree contains the active page.
 */
function containsActive(route: SidebarRoute, pathname: string): boolean {
  return matchesPath(pathname, route.path) || (route.children ?? []).some((child) => containsActive(child, pathname))
}

/**
 * Collects the paths of every app group that is, or contains, the active page, so
 * the current app and all its enclosing apps are expanded.
 *
 * @param routes - Sidebar routes.
 * @param pathname - Current browser path.
 * @param into - Accumulator.
 * @returns The accumulator.
 */
function activeGroupPaths(routes: SidebarRoute[], pathname: string, into: Record<string, boolean> = {}): Record<string, boolean> {
  for (const route of routes) {
    if (route.children?.length && containsActive(route, pathname)) {
      into[route.path] = true
      activeGroupPaths(route.children, pathname, into)
    }
  }
  return into
}

/**
 * Props for the Sidebar component.
 */
export interface SidebarProps {
  /** Hierarchical navigation routes derived from the QQQ app-tree metadata. */
  routes: SidebarRoute[]
  /** Application branding metadata (logo, icon, app name, banners). */
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
 * Branding block at the top of the sidebar, linking to the dashboard.
 *
 * Shows the branding logo when declared (as Material Dashboard does); otherwise
 * the small icon (or a "Q" mark) beside the application name.
 *
 * @param props - Component properties.
 * @param props.branding - Branding metadata.
 * @returns The branding link element.
 */
function SidebarBranding({ branding }: { branding?: QBrandingMetaData }) {
  const appName = branding?.appName || 'QQQ Admin'
  const linkClass = 'flex min-w-0 flex-1 items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  if (branding?.logo) {
    return (
      <Link href="/app" className={linkClass} data-qqq-id="sidebar-logo-link">
        {/* eslint-disable-next-line @next/next/no-img-element -- branding logos are arbitrary backend assets */}
        <img src={branding.logo} alt={appName} title={appName} className="max-h-12 w-full object-contain object-left" data-qqq-id="sidebar-logo" />
      </Link>
    )
  }
  return (
    <Link href="/app" className={linkClass} data-qqq-id="sidebar-logo-link">
      {branding?.icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- branding icons are arbitrary backend assets
        <img src={branding.icon} alt="" className="h-12 w-12 flex-shrink-0 object-contain" data-qqq-id="sidebar-icon" />
      ) : (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground" aria-hidden="true">
          Q
        </div>
      )}
      <div className="ml-4 flex items-center border-l border-border/60 pl-4" style={{ height: '60%' }}>
        <span className="text-sm font-semibold uppercase leading-tight tracking-wider text-muted-foreground" data-qqq-id="sidebar-app-name">
          {appName}
        </span>
      </div>
    </Link>
  )
}

/**
 * Hierarchical sidebar navigation panel.
 *
 * On desktop (`md+`) the sidebar is rendered as a static column. When `open`
 * is supplied it switches to a mobile drawer overlay with a backdrop. App
 * groups nest to any depth; every group containing the active route is
 * expanded, and the mobile drawer closes on route changes.
 *
 * @param props - Component properties.
 * @returns On desktop: a `hidden md:flex` wrapper containing the `<aside>`
 *   column. In mobile-drawer mode (when `open` prop is provided): `null` when
 *   `open` is `false`; a fixed full-screen overlay with a blurred backdrop
 *   and the `<aside>` panel when `open` is `true`.
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

  // Expand every group that contains the current route
  useEffect(() => {
    const expanded = activeGroupPaths(routes, pathname)
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
      <div className="flex items-center gap-2 border-b border-border px-4" style={{ height: 'var(--qqq-header-height)' }}>
        <SidebarBranding branding={branding} />
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
      <BannerComponent banners={branding?.banners} slot="QFMD_SIDE_NAV_UNDER_LOGO" className="mx-3 mt-3 rounded-lg" />

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 pt-4 pb-4"
        role="navigation"
        aria-label="App navigation"
      >
        {routes.length === 0 ? (
          /* Skeleton placeholder while metadata is loading */
          <div aria-hidden="true" data-qqq-id="sidebar-skeleton">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse h-8 rounded-md bg-muted/60 mx-2 mb-1"
              />
            ))}
          </div>
        ) : (
          <SidebarList routes={routes} pathname={pathname} openCollapses={openCollapses} onToggle={toggleCollapse} />
        )}
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
        aria-expanded={open ?? false}
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
    <div className="hidden md:flex h-full flex-shrink-0" data-qqq-id="sidebar-desktop">
      {asideEl}
    </div>
  )
}

/** Props shared by the recursive sidebar list components. */
interface SidebarListProps {
  /** Routes at this level. */
  routes: SidebarRoute[]
  /** Current browser path. */
  pathname: string
  /** Open state of app groups, keyed by path. */
  openCollapses: Record<string, boolean>
  /** Toggles an app group. */
  onToggle: (path: string) => void
  /** Nesting depth (0 = top level). */
  depth?: number
}

/**
 * Renders one level of the sidebar tree; app groups recurse into their children.
 *
 * @param props - Component properties.
 * @returns A `<ul>` of sidebar entries.
 */
function SidebarList({ routes, pathname, openCollapses, onToggle, depth = 0 }: SidebarListProps) {
  return (
    <ul className={cn('space-y-0.5', depth > 0 && 'mt-0.5 ml-3 border-l border-border/60 pl-2')} role="list">
      {routes.map((route) =>
        route.type === 'collapse' && route.children?.length ? (
          <SidebarCollapseItem
            key={route.path}
            route={route}
            isOpen={openCollapses[route.path] ?? false}
            pathname={pathname}
            openCollapses={openCollapses}
            onToggle={onToggle}
            depth={depth}
          />
        ) : (
          <SidebarLinkItem
            key={route.path}
            route={route}
            isActive={route.path === '/app' ? pathname.replace(/\/+$/, '') === '/app' : matchesPath(pathname, route.path)}
          />
        )
      )}
    </ul>
  )
}

/**
 * Props for the SidebarCollapseItem component.
 */
interface SidebarCollapseItemProps {
  /** The app route whose children are rendered in the collapsible list. */
  route: SidebarRoute
  /** Whether the collapsible group is currently expanded. */
  isOpen: boolean
  /** Current Next.js pathname for computing active state of child routes. */
  pathname: string
  /** Open state of nested app groups, keyed by path. */
  openCollapses: Record<string, boolean>
  /** Toggles an app group. */
  onToggle: (path: string) => void
  /** Nesting depth of this group. */
  depth: number
}

/**
 * Renders a collapsible app group: a link to the app home plus an
 * expand/collapse chevron, followed by its (possibly nested) children.
 *
 * The active style is applied when any descendant path matches the current
 * route; an exact-match style is applied when on the app home itself.
 *
 * @param props - Component properties.
 * @returns A `<li>` containing the app link, the chevron `<button>` and, when
 *   open, the nested {@link SidebarList}.
 */
function SidebarCollapseItem({ route, isOpen, pathname, openCollapses, onToggle, depth }: SidebarCollapseItemProps) {
  const isExactActive = pathname.replace(/\/+$/, '') === route.path
  const isActive = containsActive(route, pathname)

  return (
    <li role="listitem">
      <div className={`flex items-center rounded-lg transition-colors ${
        isExactActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : isActive
            ? 'text-primary'
            : 'text-foreground/70 hover:bg-accent hover:text-foreground'
      }`}>
        {/* App name — links to app home */}
        <Link
          href={route.path}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-l-lg"
          aria-current={isExactActive ? 'page' : undefined}
          data-qqq-id={`sidebar-collapse-${route.key}`}
        >
          <NavIcon route={route} />
          <span className="flex-1 truncate text-left">{route.name}</span>
        </Link>
        {/* Chevron — toggles expand/collapse */}
        <button
          onClick={() => onToggle(route.path)}
          className="flex items-center justify-center px-2 py-2 rounded-r-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${route.name}`}
          data-qqq-id={`sidebar-toggle-${route.key}`}
        >
          {isOpen ? (
            <ChevronDown className={`h-4 w-4 flex-shrink-0 ${isExactActive ? 'opacity-70' : 'opacity-50'}`} aria-hidden="true" />
          ) : (
            <ChevronRight className={`h-4 w-4 flex-shrink-0 ${isExactActive ? 'opacity-70' : 'opacity-50'}`} aria-hidden="true" />
          )}
        </button>
      </div>

      {isOpen && route.children && (
        <SidebarList routes={route.children} pathname={pathname} openCollapses={openCollapses} onToggle={onToggle} depth={depth + 1} />
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
 * the route's metadata icon alongside the label.
 *
 * @param props - Component properties.
 * @returns A `<li>` containing a full-width `<Link>` with a primary background
 *   and `aria-current="page"` when active, or a muted hover state otherwise.
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
        data-qqq-id={`sidebar-item-${route.key}`}
      >
        <NavIcon route={route} />
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
 * @param props - Component properties.
 * @returns A React fragment containing a `<div>` with the popover menu (above
 *   the user bar) and the user-info `<button>`, followed by a
 *   {@link UserPreferencesDialog} portal. The popover is dismissed on outside
 *   click or Escape and re-mounts cleanly each time it opens.
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
