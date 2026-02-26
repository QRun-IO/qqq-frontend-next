'use client'

// Header component — single top bar: breadcrumbs left, global search + notifications right
// Matches ME design: breadcrumbs ARE the header row
// Mobile: shows hamburger button to toggle sidebar drawer

import React, { useState } from 'react'
import { Bell, Menu } from 'lucide-react'

import { GlobalSearch } from '@/components/layout/GlobalSearch'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import type { ParentAppInfo } from '@/lib/hooks/use-routes'

export interface HeaderProps {
  appName?: string
  /** Mobile: called when the hamburger menu button is clicked */
  onMenuOpen?: () => void
  /** Path-to-label map for breadcrumbs */
  pathToLabelMap?: Record<string, string>
  /** Maps flat child paths to their parent app for breadcrumb injection */
  parentAppMap?: Record<string, ParentAppInfo>
}

export default function Header({ appName, onMenuOpen, pathToLabelMap = {}, parentAppMap = {} }: HeaderProps) {
  const [notificationCount] = useState(0)

  return (
    <header
      className="flex items-center justify-between border-b border-border bg-card px-4 md:px-6"
      style={{ height: 'var(--qqq-header-height)' }}
      data-qqq-id="header"
    >
      {/* Left: mobile menu + breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger — only visible below md breakpoint */}
        <button
          onClick={onMenuOpen}
          className="flex md:hidden items-center justify-center rounded-lg p-2 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open navigation menu"
          data-qqq-id="button-mobile-menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Breadcrumbs pathToLabelMap={pathToLabelMap} parentAppMap={parentAppMap} />
      </div>

      {/* Right section: search + notifications */}
      <div className="flex items-center gap-3">
        {/* Global search — hidden on mobile */}
        <GlobalSearch className="hidden md:block" />

        {/* Notifications bell */}
        <button
          className="relative rounded-lg p-2 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={notificationCount > 0 ? `${notificationCount} notifications` : 'No notifications'}
          data-qqq-id="button-notifications"
        >
          <Bell className="h-5 w-5 text-foreground/60" aria-hidden="true" />
          {notificationCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-destructive" />
          )}
        </button>
      </div>
    </header>
  )
}
