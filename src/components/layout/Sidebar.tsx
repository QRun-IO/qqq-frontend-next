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

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'

import type { QBrandingMetaData } from '@/types'
import type { SidebarRoute, SidebarSection } from '@/lib/hooks/use-routes'
import { cn } from '@/lib/utils/cn'
import { navItemQqqId } from '@/lib/utils/qqq-id'
import { NAV_WIDTH_CSS } from '@/lib/utils/nav-width'
import BannerComponent from './Banner'
import { MetadataIcon, type MetadataIconKind } from './MetadataIcon'
import { NavResizeHandle } from './NavResizeHandle'

/** The personal Favorites section; it checks for collaboration and loads after hydration. */
const SidebarFavorites = dynamic(() => import('@/components/collaboration/SidebarFavorites').then((module) => module.SidebarFavorites), { ssr: false })

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
  return matchesRoute(route, pathname) || (route.children ?? []).some((child) => containsActive(child, pathname))
}

/**
 * Whether a route is the current page: its path, or another path it stands for (an app shown as
 * one leaf is current on its home and on its only child).
 *
 * @param route - Sidebar route.
 * @param pathname - Current browser path.
 * @returns `true` when the route is active.
 */
function matchesRoute(route: SidebarRoute, pathname: string): boolean {
  if (route.path === '/app') return pathname.replace(/\/+$/, '') === '/app'
  return matchesPath(pathname, route.path) || (route.alsoActivePaths ?? []).some((path) => matchesPath(pathname, path))
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
  /** Where the logo links: the instance's home app, or the `/app` overview (default). */
  homePath?: string
  /** Called when the mouse enters the sidebar (desktop hover expansion). */
  onMouseEnter?: () => void
  /** Called when the mouse leaves the sidebar (desktop hover collapse). */
  onMouseLeave?: () => void
  /** Opens the search box; the drawer shows a search field at its top (hidden navigation keeps search visible). */
  onSearchOpen?: () => void
  /** Show the personal Favorites section (signed in). */
  showFavorites?: boolean
  /** When provided the sidebar renders as a mobile drawer overlay; `true` = open. */
  open?: boolean
  /** Called when the mobile drawer overlay should close (backdrop click, close button, Escape or a chosen link). */
  onClose?: () => void
  /** Element that gets focus back when the mobile drawer closes (the header menu button). */
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * Branding block at the top of the sidebar, linking to the dashboard.
 *
 * Shows the branding logo when declared (as Material Dashboard does); otherwise
 * the small icon (or a "Q" mark) beside the application name.
 *
 * @param props - Component properties.
 * @param props.branding - Branding metadata.
 * @param props.href - The home page the logo links to.
 * @returns The branding link element.
 */
function SidebarBranding({ branding, href }: { branding?: QBrandingMetaData; href: string }) {
  const appName = branding?.appName || 'QQQ Admin'
  const linkClass = 'flex min-w-0 flex-1 items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  if (branding?.logo) {
    return (
      <Link href={href} className={linkClass} data-qqq-id="sidebar-logo-link">
        {/* eslint-disable-next-line @next/next/no-img-element -- branding logos are arbitrary backend assets */}
        <img src={branding.logo} alt={appName} title={appName} className="max-h-12 w-full object-contain object-left" data-qqq-id="sidebar-logo" />
      </Link>
    )
  }
  return (
    <Link href={href} className={linkClass} data-qqq-id="sidebar-logo-link">
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
 * is supplied it switches to a mobile drawer: a modal dialog with a backdrop
 * that takes focus on open, keeps Tab inside, and closes on Escape, the close
 * button, a backdrop tap or a chosen link, returning focus to `returnFocusRef`.
 * App groups nest to any depth; every group containing the active route is
 * expanded, and the mobile drawer closes on route changes.
 *
 * @param props - Component properties.
 * @returns On desktop: a `hidden md:flex` wrapper containing the `<aside>`
 *   column and its resize handle (the width persists per browser). In
 *   mobile-drawer mode (when `open` prop is provided): a Radix dialog whose content (the `<aside>` panel) is mounted only while `open`.
 */
export default function Sidebar({
  routes,
  branding,
  homePath = '/app',
  onMouseEnter,
  onMouseLeave,
  onSearchOpen,
  showFavorites = false,
  open,
  onClose,
  returnFocusRef,
}: SidebarProps) {
  const pathname = usePathname()
  const [openCollapses, setOpenCollapses] = React.useState<Record<string, boolean>>({})
  const drawerRef = useRef<HTMLDivElement>(null)

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
   * Opens or closes a collapsible navigation group or section.
   *
   * @param key - The group's path (or `{path}#{section}` for a section).
   * @param next - The new state; omitted, the state flips.
   */
  const toggleCollapse = (key: string, next?: boolean) => {
    setOpenCollapses((prev) => ({
      ...prev,
      [key]: next ?? !prev[key],
    }))
  }

  // Determine if we are in mobile drawer mode (open prop provided)
  const isMobileDrawer = open !== undefined

  const asideEl = (
    <aside
      id={isMobileDrawer ? undefined : 'qqq-desktop-nav'}
      className={cn('flex h-full flex-col overflow-hidden border-r border-border bg-sidebar text-foreground', isMobileDrawer ? 'w-64' : 'w-full')}
      onMouseEnter={!isMobileDrawer ? onMouseEnter : undefined}
      onMouseLeave={!isMobileDrawer ? onMouseLeave : undefined}
      data-qqq-id="sidebar"
      aria-label="Main navigation"
    >
      {/* Material's sidenav-root hook (QRun-IO/qqq#731): fills the panel, so app CSS keyed to it styles the whole sidebar */}
      <div className="flex min-h-0 flex-1 flex-col" data-qqq-id="sidenav-root">
        {/* Logo / App Branding — height matches header so border lines up */}
        <div className="flex items-center gap-2 border-b border-border px-4" style={{ height: 'var(--qqq-header-height)' }} data-qqq-id="sidenav-logo-area">
          <SidebarBranding branding={branding} href={homePath} />
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

        {/* Hidden navigation keeps search visible: the drawer starts with the search field */}
        {isMobileDrawer && onSearchOpen && (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => { onClose?.(); onSearchOpen() }}
              className="flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-qqq-id="sidebar-search"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search or jump to…
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto px-3 pt-4 pb-4"
          role="navigation"
          aria-label="App navigation"
        >
          {showFavorites && <SidebarFavorites pathname={pathname} open={openCollapses['#favorites'] ?? false} onToggle={(next) => toggleCollapse('#favorites', next)} />}
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

      </div>
    </aside>
  )

  // Mobile drawer mode — a modal dialog: focus moves in and stays in, Escape closes it
  if (isMobileDrawer) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose?.() }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-[var(--qqq-z-sidebar,100)] bg-black/40"
            data-qqq-id="sidebar-mobile-backdrop"
            // A tap on the backdrop closes the drawer, also where no outside pointer-down reaches the dialog (Firefox with touch)
            onClick={onClose}
          />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-[var(--qqq-z-sidebar,100)] flex h-full max-w-[85vw] flex-col shadow-lg focus:outline-none"
            aria-describedby={undefined}
            data-qqq-id="sidebar-mobile-drawer"
            ref={drawerRef}
            onCloseAutoFocus={(event) => {
              const trigger = returnFocusRef?.current
              if (trigger?.isConnected) {
                event.preventDefault()
                trigger.focus()
              }
            }}
            onClick={(event) => {
              // Choosing a link closes the drawer, also when it is the current page
              if ((event.target as Element).closest('a[href]')) onClose?.()
            }}
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            {asideEl}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    )
  }

  // Desktop (from 1024 px; a drawer below, so a 768 px screen keeps its width for content): a
  // static column whose width the user sets with the handle on its right edge
  return (
    <div className="relative hidden lg:flex h-full flex-shrink-0" style={{ width: NAV_WIDTH_CSS }} data-qqq-id="sidebar-desktop">
      {asideEl}
      <NavResizeHandle controls="qqq-desktop-nav" />
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
  /** Opens or closes an app group or section (flips without `next`). */
  onToggle: (key: string, next?: boolean) => void
  /** Nesting depth (0 = top level). */
  depth?: number
  /** Inside a sectioned app: no extra indent (the sections carry it). */
  flat?: boolean
  /** Element id, for a list a disclosure button controls. */
  id?: string
}

/**
 * Renders one level of the sidebar tree; app groups recurse into their children.
 *
 * @param props - Component properties.
 * @returns A `<ul>` of sidebar entries.
 */
function SidebarList({ routes, pathname, openCollapses, onToggle, depth = 0, flat = false, id }: SidebarListProps) {
  return (
    <ul
      id={id}
      className={cn('space-y-0.5', depth > 0 && !flat && 'mt-0.5 ml-3 border-l border-border/60 pl-2')}
      role="list"
      data-qqq-id={depth === 0 ? 'sidenav-menu-list' : undefined}
    >
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
            isActive={matchesRoute(route, pathname)}
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
  /** Opens or closes an app group or section. */
  onToggle: (key: string, next?: boolean) => void
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
    <li role="listitem" data-qqq-id={navItemQqqId(undefined, route.name, route.path)}>
      <div
        className={`flex items-center rounded-lg transition-colors ${
          isExactActive
            ? 'qqq-sidebar-active bg-primary text-primary-foreground shadow-sm'
            : isActive
              ? 'text-primary'
              : 'text-foreground/70 hover:bg-accent hover:text-foreground'
        }`}
        data-qqq-sidenav-item-type={depth === 0 ? 'top-level-parent-app' : undefined}
      >
        {/* App name — links to app home */}
        <Link
          href={route.path}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-l-lg pointer-coarse:min-h-11"
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

      {isOpen && route.children && (route.sections ? (
        <SidebarSections route={route} sections={route.sections} pathname={pathname} openCollapses={openCollapses} onToggle={onToggle} depth={depth + 1} />
      ) : (
        <SidebarList routes={route.children} pathname={pathname} openCollapses={openCollapses} onToggle={onToggle} depth={depth + 1} />
      ))}
    </li>
  )
}

/**
 * An app's children in its sections (metadata roles): PRIMARY entries without a heading, HISTORY
 * and GROUP entries under a heading, and SETTINGS as a disclosure ("Settings · 6") that starts
 * closed unless it holds the current page. Headings are group labels, never links.
 *
 * @param props - Component properties.
 * @param props.route - The app whose sections these are.
 * @param props.sections - Its sections, each with its entries in server order.
 * @param props.pathname - Current browser path.
 * @param props.openCollapses - Open state of groups and sections.
 * @param props.onToggle - Opens or closes a group or section.
 * @param props.depth - Nesting depth of the entries.
 * @returns The sections, indented under the app.
 */
function SidebarSections({ route, sections, pathname, openCollapses, onToggle, depth }: {
  route: SidebarRoute
  sections: SidebarSection[]
  pathname: string
  openCollapses: Record<string, boolean>
  onToggle: (key: string, next?: boolean) => void
  depth: number
}) {
  const listProps = { pathname, openCollapses, onToggle, depth, flat: true }
  return (
    <div className="mt-0.5 ml-3 space-y-1 border-l border-border/60 pl-2" data-qqq-id={`sidebar-sections-${route.key}`}>
      {sections.map((section) => {
        const baseId = `sidebar-section-${route.key}-${section.key || 'main'}`.replace(/[^A-Za-z0-9_-]/g, '_')
        if (section.role === 'PRIMARY') {
          return <SidebarList key={baseId} routes={section.routes} {...listProps} />
        }
        if (section.collapsedByDefault) {
          const stateKey = `${route.path}#${section.key}`
          const holdsActive = section.routes.some((child) => containsActive(child, pathname))
          const isOpen = openCollapses[stateKey] ?? holdsActive
          const count = section.routes.length
          return (
            <div key={baseId} role="group" aria-labelledby={`${baseId}-heading`} data-qqq-id={baseId} data-qqq-section-role={section.role}>
              <button
                id={`${baseId}-heading`}
                type="button"
                onClick={() => onToggle(stateKey, !isOpen)}
                aria-expanded={isOpen}
                aria-controls={`${baseId}-list`}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                data-qqq-id={`${baseId}-toggle`}
              >
                <span className="flex-1 truncate">{section.label}</span>
                <span className="font-normal normal-case" aria-label={`${count} ${count === 1 ? 'item' : 'items'}`}>· {count}</span>
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
              {isOpen && <SidebarList id={`${baseId}-list`} routes={section.routes} {...listProps} />}
            </div>
          )
        }
        return (
          <div key={baseId} role="group" aria-labelledby={`${baseId}-heading`} data-qqq-id={baseId} data-qqq-section-role={section.role}>
            <div id={`${baseId}-heading`} className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </div>
            <SidebarList routes={section.routes} {...listProps} />
          </div>
        )
      })}
    </div>
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
    <li role="listitem" data-qqq-id={navItemQqqId(undefined, route.name, route.path)}>
      <Link
        href={route.path}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 ${
          isActive
            ? 'qqq-sidebar-active bg-primary text-primary-foreground shadow-sm'
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
