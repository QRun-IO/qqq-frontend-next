'use client'

// Sidebar navigation component
// Renders hierarchical navigation from appTree with max depth 2
// Supports mini mode (icons only), collapse/expand, and mobile drawer mode

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react'

import type { QBrandingMetaData } from '@/types'
import type { SidebarRoute } from '@/lib/hooks/use-routes'

export interface SidebarProps {
  routes: SidebarRoute[]
  branding?: QBrandingMetaData
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  logout?: () => void
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
  open,
  onClose,
}: SidebarProps) {
  const pathname = usePathname()
  const [miniMode, setMiniMode] = useState(false)
  const [openCollapses, setOpenCollapses] = useState<Record<string, boolean>>({})

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

  const handleMouseEnter = () => {
    if (miniMode) {
      setMiniMode(false)
    }
    onMouseEnter?.()
  }

  const handleMouseLeave = () => {
    onMouseLeave?.()
  }

  // Determine if we are in mobile drawer mode (open prop provided)
  const isMobileDrawer = open !== undefined

  const asideEl = (
    <aside
      className="flex h-full flex-col overflow-hidden transition-all duration-300 bg-[var(--qqq-sidebar-background)] text-[var(--qqq-sidebar-text)]"
      style={{
        width: isMobileDrawer
          ? 'var(--qqq-sidebar-width)'
          : miniMode
            ? 'var(--qqq-sidebar-width-mini)'
            : 'var(--qqq-sidebar-width)',
      }}
      onMouseEnter={!isMobileDrawer ? handleMouseEnter : undefined}
      onMouseLeave={!isMobileDrawer ? handleMouseLeave : undefined}
      data-qqq-id="sidebar"
      aria-label="Main navigation"
    >
      {/* Logo / App Name */}
      <div
        className="flex items-center gap-3 border-b p-4"
        style={{ borderColor: 'var(--qqq-sidebar-border)' }}
      >
        {branding?.icon && (
          <Image
            src={branding.icon}
            alt={branding.appName || 'QQQ'}
            className="h-8 w-8 flex-shrink-0 rounded"
            width={32}
            height={32}
            unoptimized
          />
        )}
        {!branding?.icon && (
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-sm font-bold"
            style={{ background: 'var(--qqq-primary-color)' }}
            aria-hidden="true"
          >
            Q
          </div>
        )}
        {(!miniMode || isMobileDrawer) && (
          <span className="flex-1 truncate text-sm font-semibold">
            {branding?.appName || 'QQQ Admin'}
          </span>
        )}
        {/* Close button for mobile drawer */}
        {isMobileDrawer && (
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 hover:bg-[var(--qqq-sidebar-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Close navigation"
            data-qqq-id="button-sidebar-close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Toggle mini mode button — desktop only */}
      {!isMobileDrawer && (
        <div
          className="flex justify-end border-b px-2 py-1"
          style={{ borderColor: 'var(--qqq-sidebar-border)' }}
        >
          <button
            onClick={() => setMiniMode((prev) => !prev)}
            className="rounded p-1 hover:bg-[var(--qqq-sidebar-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label={miniMode ? 'Expand sidebar' : 'Collapse sidebar'}
            data-qqq-id="button-sidebar-toggle"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-3"
        role="navigation"
        aria-label="App navigation"
      >
        <ul className="space-y-1" role="list">
          {routes.map((route) =>
            route.type === 'collapse' && route.children?.length ? (
              <SidebarCollapseItem
                key={route.path}
                route={route}
                isOpen={openCollapses[route.path] ?? false}
                onToggle={() => toggleCollapse(route.path)}
                isActive={pathname.startsWith(route.path)}
                miniMode={!isMobileDrawer && miniMode}
                pathname={pathname}
              />
            ) : (
              <SidebarLinkItem
                key={route.path}
                route={route}
                isActive={pathname === route.path || pathname.startsWith(route.path + '/')}
                miniMode={!isMobileDrawer && miniMode}
              />
            )
          )}
        </ul>
      </nav>

      {/* Logout button */}
      {logout && (
        <div
          className="border-t p-2"
          style={{ borderColor: 'var(--qqq-sidebar-border)' }}
        >
          <button
            onClick={logout}
            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-[var(--qqq-sidebar-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Logout"
            data-qqq-id="button-logout-sidebar"
          >
            {!isMobileDrawer && miniMode ? '→' : 'Logout'}
          </button>
        </div>
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
        <div className="relative flex h-full flex-col shadow-xl">
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
  miniMode: boolean
  pathname: string
}

function SidebarCollapseItem({
  route,
  isOpen,
  onToggle,
  isActive,
  miniMode,
  pathname,
}: SidebarCollapseItemProps) {
  return (
    <li role="listitem">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded px-3 py-2 text-sm transition-colors hover:bg-[var(--qqq-sidebar-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        style={isActive ? { color: 'var(--qqq-sidebar-active)' } : {}}
        title={miniMode ? route.name : undefined}
        aria-expanded={isOpen}
        aria-label={`${route.name} menu`}
        data-qqq-id={`sidebar-collapse-${route.name}`}
      >
        {!miniMode && <span className="flex-1 truncate text-left">{route.name}</span>}
        {miniMode && (
          <span
            className="flex h-6 w-6 items-center justify-center text-xs font-bold"
            aria-hidden="true"
          >
            {route.name.charAt(0).toUpperCase()}
          </span>
        )}
        {!miniMode &&
          (isOpen ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          ))}
      </button>

      {isOpen && !miniMode && route.children && (
        <ul className="mt-1 space-y-1 pl-4" role="list">
          {route.children.map((child) => (
            <SidebarLinkItem
              key={child.path}
              route={child}
              isActive={pathname === child.path || pathname.startsWith(child.path + '/')}
              miniMode={false}
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
  miniMode: boolean
}

function SidebarLinkItem({ route, isActive, miniMode }: SidebarLinkItemProps) {
  return (
    <li role="listitem">
      <Link
        href={route.path}
        className="flex items-center rounded px-3 py-2 text-sm transition-colors hover:bg-[var(--qqq-sidebar-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        style={
          isActive
            ? {
                color: 'var(--qqq-sidebar-active)',
                backgroundColor: 'var(--qqq-sidebar-active-bg)',
              }
            : {}
        }
        title={miniMode ? route.name : undefined}
        aria-current={isActive ? 'page' : undefined}
        data-qqq-id={`sidebar-item-${route.name}`}
      >
        {!miniMode && <span className="truncate">{route.name}</span>}
        {miniMode && (
          <span
            className="flex h-6 w-6 items-center justify-center text-xs font-bold"
            aria-hidden="true"
          >
            {route.name.charAt(0).toUpperCase()}
          </span>
        )}
      </Link>
    </li>
  )
}
