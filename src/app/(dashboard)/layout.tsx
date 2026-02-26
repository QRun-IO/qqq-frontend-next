'use client'

// Dashboard layout — authenticated route group layout
// Renders sidebar, header, breadcrumbs, and banner zones
// Includes: mobile sidebar drawer, command palette (Cmd+K), skip link, customCss injection

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
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import BannerComponent from '@/components/layout/Banner'
import { CommandMenu } from '@/components/feedback/CommandMenu'

// Inner layout content — needs QContextProvider to be set up first
function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth()
  const { setPathToLabelMap, setBranding, setAccentColor, setUserId } = useQContext()

  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Command palette state
  const [commandOpen, setCommandOpen] = useState(false)

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
  const { sidebarRoutes, pathToLabelMap } = useAppTreeRoutes(metaData)

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

      if (metaData.branding.accentColor) {
        setAccentColor(metaData.branding.accentColor)
        document.documentElement.style.setProperty(
          '--qqq-accent-color',
          metaData.branding.accentColor
        )
        document.documentElement.style.setProperty(
          '--color-primary',
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
  useEffect(() => {
    if (metaData?.branding?.customCss) {
      const styleId = 'qqq-custom-css'
      let styleTag = document.getElementById(styleId) as HTMLStyleElement | null
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.id = styleId
        document.head.appendChild(styleTag)
      }
      styleTag.textContent = metaData.branding.customCss
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

  // Global keyboard shortcut: Cmd+K / Ctrl+K → command palette
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCommandOpen((prev) => !prev)
    }
    if (e.key === 'Escape') {
      setCommandOpen(false)
      setSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  // Show loading state while auth initializes
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
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
          <p className="text-red-600">Failed to load application metadata.</p>
          <p className="mt-1 text-sm text-gray-500">
            {metaError instanceof Error ? metaError.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Skip to main content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        data-qqq-id="skip-to-content"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <Sidebar
        routes={sidebarRoutes}
        branding={metaData?.branding}
        logout={logout}
        data-qqq-id="sidebar-container"
      />

      {/* Mobile Sidebar Drawer */}
      <Sidebar
        routes={sidebarRoutes}
        branding={metaData?.branding}
        logout={logout}
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

        {/* Header */}
        <Header
          appName={metaData?.branding?.appName}
          onLogout={logout}
          userName={user?.name}
          userEmail={user?.email}
          onMenuOpen={() => setSidebarOpen(true)}
        />

        {/* Breadcrumbs */}
        <div
          className="border-b px-6 py-2"
          style={{
            background: 'var(--color-bg-subtle, #f9fafb)',
            borderColor: 'var(--color-border)',
          }}
        >
          <Breadcrumbs pathToLabelMap={pathToLabelMap} />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6" id="main-content" data-qqq-id="main-content">
          {metaLoading ? (
            <div
              className="flex items-center justify-center py-12"
              role="status"
              aria-label="Loading content"
              aria-live="polite"
            >
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Command Palette */}
      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  )
}

// Outer layout — provides QContext to inner layout
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QContextProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </QContextProvider>
  )
}
