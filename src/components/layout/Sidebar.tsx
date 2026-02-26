'use client'

// Sidebar navigation component
// Renders hierarchical navigation from appTree with max depth 2
// Subtle gray sidebar with primary-colored active state, icons, and mobile drawer mode

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

// Map Material Icons names to Lucide icon components
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

function NavIcon({ iconName, className }: { iconName?: string; className?: string }) {
  if (!iconName) {
    return <FolderOpen className={className} aria-hidden="true" />
  }
  const Icon = ICON_MAP[iconName] ?? FolderOpen
  return <Icon className={className} aria-hidden="true" />
}

export interface SidebarProps {
  routes: SidebarRoute[]
  branding?: QBrandingMetaData
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  logout?: () => void
  userName?: string
  userEmail?: string
  /** Mobile: if provided, sidebar renders as a drawer overlay. true = open */
  open?: boolean
  /** Called when the mobile drawer should close */
  onClose?: () => void
}

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
  useEffect(() => {
    onClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

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

interface SidebarCollapseItemProps {
  route: SidebarRoute
  isOpen: boolean
  onToggle: () => void
  isActive: boolean
  pathname: string
}

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

interface SidebarLinkItemProps {
  route: SidebarRoute
  isActive: boolean
}

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
