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
 * @file Dashboard layout — authenticated route group shell providing sidebar, header, banners, command palette, and global keyboard shortcuts.
 */

'use client'

/** Dashboard layout — authenticated route group shell providing sidebar, header, banners, command palette, and global keyboard shortcuts. */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/lib/auth/use-auth'
import { useQContext, QContextProvider } from '@/lib/context/q-context'
import { useAppTreeRoutes } from '@/lib/hooks/use-routes'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'
import { loadMetaData } from '@/lib/api/metadata'
import { applyBrandingTheme } from '@/lib/theme/apply-branding'
import { readMaterialTheme } from '@/lib/theme/material-theme'
import { useTheme } from '@/lib/theme/theme-provider'
import { recordAnalytics } from '@/lib/analytics'
import { useAnalytics } from '@/lib/analytics/use-analytics'
import { queryKeys } from '@/lib/query-client'
import { searchableTables } from '@/lib/utils/record-search'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import BannerComponent from '@/components/layout/Banner'
import BrandedHeaderBar from '@/components/layout/BrandedHeaderBar'
import CompanyFooter from '@/components/layout/CompanyFooter'
import { buildBreadcrumbs, buildDocumentTitle } from '@/components/layout/Breadcrumbs'
import { CommandMenu } from '@/components/feedback/CommandMenu'
import { SearchDialog } from '@/components/feedback/SearchDialog'
import { KeyboardShortcutsDialog } from '@/components/feedback/KeyboardShortcutsDialog'

/**
 * Inner layout that renders the full dashboard chrome.
 *
 * Must be a child of `QContextProvider` in order to read and write QContext.
 * Responsibilities:
 * - Fetches full application metadata via TanStack Query (30-minute stale time).
 * - Generates sidebar routes and path-to-label map from the app tree.
 * - Syncs branding, accent color, favicon, and document title to the DOM.
 * - Applies the application theme (tokens, rules, customCss) and the branded header bar.
 * - Configures analytics and records a page view per screen.
 * - Redirects unauthenticated users to `/login`.
 * - Registers global keyboard shortcuts: Cmd+K (command palette), `/` (search), `?` (help).
 * - Renders the desktop sidebar, mobile sidebar drawer, banners, header, and main content slot.
 *
 * @param children - The authenticated page content to render in the main slot.
 * @returns The full dashboard layout, a loading spinner, or `null` during redirect.
 */
function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth()
  const { setPathToLabelMap, setBranding, setAccentColor, setUserId, pageHeader } = useQContext()

  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const helpButtonRef = useRef<HTMLButtonElement>(null)

  // Command palette state
  const [commandOpen, setCommandOpen] = useState(false)

  // Search dialog state (/ key)
  const [searchOpen, setSearchOpen] = useState(false)

  // Keyboard shortcuts help dialog state
  const [helpOpen, setHelpOpen] = useState(false)

  // Load full application metadata
  const {
    data: metaData,
    isLoading: metaLoading,
    error: metaError,
  } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: isAuthenticated,
  })

  // Generate sidebar routes and path map from app tree
  const { sidebarRoutes, pathToLabelMap, ancestorAppMap, navTargets } = useAppTreeRoutes(metaData)

  // Tables the backend record search covers for this user (none: search stays local)
  const searchTables = useMemo(() => searchableTables(metaData), [metaData])

  // Sync pathToLabelMap to QContext
  useEffect(() => {
    if (Object.keys(pathToLabelMap).length > 0) {
      setPathToLabelMap(pathToLabelMap)
    }
  }, [pathToLabelMap, setPathToLabelMap])

  // Sync branding to QContext and inject theme
  useEffect(() => {
    if (metaData?.branding) {
      setBranding(metaData.branding)
      // accent colors (validated, MED-3) and the favicon
      const accentColor = applyBrandingTheme(metaData.branding)
      if (accentColor) setAccentColor(accentColor)
    }
  }, [metaData?.branding, setBranding, setAccentColor])

  // Document title: current page, enclosing breadcrumbs, then the app name
  const documentTitle = metaData
    ? buildDocumentTitle(
      buildBreadcrumbs(pathname, pathToLabelMap, ancestorAppMap),
      typeof pageHeader === 'string' ? pageHeader : undefined,
      metaData.branding?.appName || 'QQQ'
    )
    : undefined
  useDocumentTitle(documentTitle)

  // Application theme (MaterialDashboardThemeMetaData, QRun-IO/qqq#719): tokens, rules and its
  // customCss; removed again when the dashboard unmounts (sign-out)
  const { theme, setTheme } = useTheme()
  const applicationTheme = useMemo(() => readMaterialTheme(metaData), [metaData])
  useEffect(() => { setTheme(applicationTheme) }, [applicationTheme, setTheme])
  useEffect(() => () => setTheme(null), [setTheme])

  // Analytics (QRun-IO/qqq#730): off unless configured; one page view per screen
  useAnalytics(metaData, pathname, user?.email ?? user?.name)

  // Sync user ID to QContext
  useEffect(() => {
    if (user?.email) {
      setUserId(user.email)
    }
  }, [user?.email, setUserId])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
      router.push(`/login?returnTo=${returnTo}`)
    }
  }, [isAuthenticated, authLoading, router])

  /**
   * Returns `true` when focus is in a text input, textarea, select, or contentEditable element.
   *
   * Used to suppress single-key shortcuts (`.`, `/`, `?`) while the user is typing.
   *
   * @returns Whether the currently focused element is a text-entry control.
   */
  const isInputFocused = useCallback(() => {
    const active = document.activeElement
    const tag = (active?.tagName ?? '').toLowerCase()
    const inputType = active instanceof HTMLInputElement ? active.type : ''
    const isEditable = active instanceof HTMLElement ? active.isContentEditable : false
    return tag === 'input' || tag === 'textarea' || tag === 'select' || inputType === 'search' || isEditable
  }, [])

  /**
   * Global `keydown` handler that drives the application-level keyboard shortcuts.
   *
   * - Cmd+K / Ctrl+K — toggles the command palette.
   * - Escape — closes all overlays (command palette, search dialog, help dialog, mobile sidebar).
   * - `.` — opens the command palette (only when not in a text field).
   * - `/` — opens the search dialog (only when not in a text field).
   * - `?` — opens the keyboard shortcuts dialog (only when not in a text field).
   *
   * @param e - The native DOM keyboard event.
   */
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCommandOpen((prev) => !prev)
    }
    if (e.key === 'Escape') {
      setCommandOpen(false)
      setSearchOpen(false)
      setHelpOpen(false)
      // The navigation drawer is a modal dialog and handles its own Escape
    }

    // Single-key shortcuts — only when not focused in a text field
    if (!isInputFocused() && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === '.') {
        e.preventDefault()
        recordAnalytics({ category: 'globalEvents', action: 'dotMenuKeyboardShortcut' })
        setCommandOpen(true)
      }
      if (e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(true)
      }
    }
  }, [isInputFocused])

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  // Show loading state while auth initializes
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  // Auth loaded but not authenticated — redirect handled above
  if (!isAuthenticated) {
    return null
  }

  // Show error if metadata fails to load
  if (metaError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load application metadata.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {metaError instanceof Error ? metaError.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top-of-site banner spans the whole window, above the sidebar */}
      <BannerComponent banners={metaData?.branding?.banners} slot="QFMD_TOP_OF_SITE" className="border-x-0 border-t-0" />
      <BrandedHeaderBar theme={theme} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Skip to main content — accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:inline-flex focus:items-center pointer-coarse:focus:min-h-11 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          data-qqq-id="skip-to-content"
        >
          Skip to main content
        </a>

        {/* Desktop Sidebar */}
        <Sidebar
          routes={sidebarRoutes}
          branding={metaData?.branding}
          logout={logout}
          userName={user?.name}
          userEmail={user?.email}
          data-qqq-id="sidebar-container"
        />

        {/* Mobile Sidebar Drawer */}
        <Sidebar
          routes={sidebarRoutes}
          branding={metaData?.branding}
          logout={logout}
          userName={user?.name}
          userEmail={user?.email}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          returnFocusRef={menuButtonRef}
          data-qqq-id="sidebar-mobile"
        />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header — breadcrumbs + search in one row */}
          <Header
            appName={metaData?.branding?.appName}
            onMenuOpen={() => setSidebarOpen(true)}
            menuOpen={sidebarOpen}
            menuButtonRef={menuButtonRef}
            onSearchOpen={() => setSearchOpen(true)}
            onHelpOpen={() => setHelpOpen(true)}
            helpButtonRef={helpButtonRef}
            pathToLabelMap={pathToLabelMap}
            ancestorAppMap={ancestorAppMap}
            navTargets={navTargets}
            searchTables={searchTables}
          />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6" id="main-content" data-qqq-id="main-content">
            {metaLoading ? (
              <div
                className="flex items-center justify-center py-12"
                role="status"
                aria-label="Loading content"
                aria-live="polite"
              >
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                <BannerComponent banners={metaData?.branding?.banners} slot="QFMD_TOP_OF_BODY" className="mb-4 rounded-lg" />
                {children}
                <CompanyFooter branding={metaData?.branding} />
              </>
            )}
          </main>
        </div>
      </div>

      {/* Command Palette */}
      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} navTargets={navTargets} />

      {/* Search Dialog */}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} navTargets={navTargets} searchTables={searchTables} />

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} returnFocusRef={helpButtonRef} />
    </div>
  )
}

/**
 * Outer dashboard layout exported as the Next.js `(dashboard)` route group layout.
 *
 * Wraps the inner `DashboardLayoutContent` with `QContextProvider` so that all
 * authenticated pages share a single QContext instance.
 *
 * @param children - The page component rendered inside the authenticated shell.
 * @returns A `QContextProvider` wrapping the full dashboard layout.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QContextProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </QContextProvider>
  )
}
