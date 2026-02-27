'use client'

/** Dashboard layout — authenticated route group shell providing sidebar, header, banners, command palette, and global keyboard shortcuts. */

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/lib/auth/use-auth'
import { useQContext, QContextProvider } from '@/lib/context/q-context'
import { useAppTreeRoutes } from '@/lib/hooks/use-routes'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import BannerComponent from '@/components/layout/Banner'
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
 * - Sanitizes and injects `customCss` from branding metadata.
 * - Redirects unauthenticated users to `/login`.
 * - Registers global keyboard shortcuts: Cmd+K (command palette), `/` (search), `?` (help).
 * - Renders the desktop sidebar, mobile sidebar drawer, banners, header, and main content slot.
 *
 * @param children - The authenticated page content to render in the main slot.
 * @returns The full dashboard layout, a loading spinner, or `null` during redirect.
 */
function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth()
  const { setPathToLabelMap, setBranding, setAccentColor, setUserId } = useQContext()

  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
  const { sidebarRoutes, pathToLabelMap, parentAppMap } = useAppTreeRoutes(metaData)

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

      // MED-3: validate color format before applying to CSS custom properties
      const ACCENT_COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^rgb\(|^rgba\(|^hsl\(|^hsla\(/
      if (metaData.branding.accentColor && ACCENT_COLOR_RE.test(metaData.branding.accentColor)) {
        setAccentColor(metaData.branding.accentColor)
        document.documentElement.style.setProperty(
          '--qqq-accent-color',
          metaData.branding.accentColor
        )
        document.documentElement.style.setProperty(
          '--color-primary',
          metaData.branding.accentColor
        )
        document.documentElement.style.setProperty(
          '--primary',
          metaData.branding.accentColor
        )
        document.documentElement.style.setProperty(
          '--ring',
          metaData.branding.accentColor
        )
        document.documentElement.style.setProperty(
          '--qqq-sidebar-active-bg',
          metaData.branding.accentColor
        )
      }

      // Update favicon from branding
      if (metaData.branding.icon) {
        const favicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
        if (favicon) {
          favicon.href = metaData.branding.icon
        }
      }

      // Update document title
      if (metaData.branding.appName) {
        document.title = metaData.branding.appName
      }
    }
  }, [metaData?.branding, setBranding, setAccentColor])

  // Inject customCss from branding metadata
  // MED-2: strip known CSS injection vectors before applying
  useEffect(() => {
    if (metaData?.branding?.customCss) {
      const safe = metaData.branding.customCss
        .replace(/<\/?\s*style[^>]*>/gi, '')   // no embedded style tags
        .replace(/expression\s*\(/gi, '')       // no IE CSS expressions
        .replace(/@import\b/gi, '')             // no @import directives
        .replace(/javascript\s*:/gi, '')        // no javascript: scheme
        .replace(/url\s*\(\s*["']?\s*data:/gi, '') // no data: URLs

      const styleId = 'qqq-custom-css'
      let styleTag = document.getElementById(styleId) as HTMLStyleElement | null
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.id = styleId
        document.head.appendChild(styleTag)
      }
      styleTag.textContent = safe
    }
  }, [metaData?.branding?.customCss])

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
    const tag = (document.activeElement?.tagName || '').toLowerCase()
    const type = (document.activeElement as HTMLInputElement)?.type || ''
    const isEditable = (document.activeElement as HTMLElement)?.isContentEditable
    return tag === 'input' || tag === 'textarea' || tag === 'select' || type === 'search' || isEditable
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
      setSidebarOpen(false)
    }

    // Single-key shortcuts — only when not focused in a text field
    if (!isInputFocused() && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === '.') {
        e.preventDefault()
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Skip to main content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
        data-qqq-id="sidebar-mobile"
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Environment/status banners */}
        {metaData?.branding?.banners &&
          Object.keys(metaData.branding.banners).length > 0 && (
            <BannerComponent banners={metaData.branding.banners} />
          )}

        {/* Header — breadcrumbs + search in one row */}
        <Header
          appName={metaData?.branding?.appName}
          onMenuOpen={() => setSidebarOpen(true)}
          pathToLabelMap={pathToLabelMap}
          parentAppMap={parentAppMap}
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
            children
          )}
        </main>
      </div>

      {/* Command Palette */}
      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />

      {/* Search Dialog */}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
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
