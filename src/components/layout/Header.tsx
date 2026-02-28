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

/** Header — top bar rendering breadcrumbs on the left and global search + notifications on the right. On mobile, a hamburger button triggers the sidebar drawer. */

import React, { useState } from 'react'
import { Bell, Menu } from 'lucide-react'

import { GlobalSearch } from '@/components/layout/GlobalSearch'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import type { ParentAppInfo } from '@/lib/hooks/use-routes'

/**
 * Props for the Header component.
 */
export interface HeaderProps {
  /** Application name from branding metadata (currently unused in layout but reserved for future title display). */
  appName?: string
  /** Called when the mobile hamburger menu button is clicked to open the sidebar drawer. */
  onMenuOpen?: () => void
  /** Path-to-label map passed through to the Breadcrumbs component. */
  pathToLabelMap?: Record<string, string>
  /** Maps flat child paths to their parent app, passed through to Breadcrumbs for injection. */
  parentAppMap?: Record<string, ParentAppInfo>
}

/**
 * Renders the application top bar.
 *
 * Provides breadcrumb navigation on the left and a global search pill plus
 * notifications bell on the right. On viewports narrower than the `md`
 * breakpoint the breadcrumbs are replaced by a hamburger button that invokes
 * `onMenuOpen`, and the global search is hidden.
 *
 * @param onMenuOpen - Callback to open the mobile sidebar drawer.
 * @param pathToLabelMap - Map of URL paths to display labels for breadcrumbs.
 * @param parentAppMap - Map of child paths to parent-app info for breadcrumb injection.
 * @returns The sticky header bar element.
 */
export default function Header({ onMenuOpen, pathToLabelMap = {}, parentAppMap = {} }: HeaderProps) {
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
