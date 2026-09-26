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
 * @file Header — top bar rendering breadcrumbs, global search, and notifications.
 */

'use client'

import React, { useState } from 'react'
import { Bell, Menu, Search, HelpCircle } from 'lucide-react'

import { GlobalSearch } from '@/components/layout/GlobalSearch'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import type { NavTarget, ParentAppInfo } from '@/lib/hooks/use-routes'
import type { SearchableTable } from '@/lib/utils/record-search'

/**
 * Props for the Header component.
 */
export interface HeaderProps {
  /** Application name from branding metadata (currently unused in layout but reserved for future title display). */
  appName?: string
  /** Called when the mobile hamburger menu button is clicked to open the sidebar drawer. */
  onMenuOpen?: () => void
  /** Whether the mobile navigation drawer is open (reflected on the menu button). */
  menuOpen?: boolean
  /** Ref to the mobile menu button, so the drawer can return focus to it when it closes. */
  menuButtonRef?: React.Ref<HTMLButtonElement>
  /** Called when the mobile search icon button is clicked to open the search dialog. */
  onSearchOpen?: () => void
  /** Called when the keyboard shortcuts help button is clicked to open the help dialog. */
  onHelpOpen?: () => void
  /** Ref to the keyboard shortcuts help button, so the help dialog can return focus to it when it closes. */
  helpButtonRef?: React.Ref<HTMLButtonElement>
  /** Path-to-label map passed through to the Breadcrumbs component. */
  pathToLabelMap?: Record<string, string>
  /** Maps node paths to their enclosing apps, passed through to Breadcrumbs. */
  ancestorAppMap?: Record<string, ParentAppInfo[]>
  /** Navigable app-tree nodes for the header search. */
  navTargets?: NavTarget[]
  /** Tables the backend record search covers, for the header search (empty: local search only). */
  searchTables?: SearchableTable[]
}

/**
 * Renders the application top bar.
 *
 * Provides breadcrumb navigation on the left and a global search pill plus
 * notifications bell on the right. On viewports narrower than the `md`
 * breakpoint the breadcrumbs are replaced by a hamburger button that invokes
 * `onMenuOpen`, and the global search is hidden. A search icon button and a
 * keyboard-shortcuts help button are shown on mobile in place of the full
 * search pill.
 *
 * @param props - Component properties.
 * @returns A `<header>` element with `height: var(--qqq-header-height)` that
 *   contains the hamburger button + {@link Breadcrumbs} on the left and
 *   {@link GlobalSearch} + notifications bell on the right. The hamburger and
 *   GlobalSearch are each conditionally visible based on the `md` breakpoint.
 */
export default function Header({ onMenuOpen, menuOpen = false, menuButtonRef, onSearchOpen, onHelpOpen, helpButtonRef, pathToLabelMap = {}, ancestorAppMap = {}, navTargets = [], searchTables }: HeaderProps) {
  const [notificationCount] = useState(0)

  return (
    <header
      className="flex items-center justify-between border-b border-border bg-card px-4 md:px-6"
      style={{ height: 'var(--qqq-header-height)' }}
      data-qqq-id="header"
    >
      {/* Left: mobile menu + breadcrumbs (the trail scrolls sideways on its own when it is too long) */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Mobile hamburger — only visible below md breakpoint */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onMenuOpen}
          className="flex md:hidden items-center justify-center rounded-lg p-2 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          data-qqq-id="button-mobile-menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Breadcrumbs pathToLabelMap={pathToLabelMap} ancestorAppMap={ancestorAppMap} />
      </div>

      {/* Right section: search + help + notifications */}
      <div className="ml-3 flex flex-shrink-0 items-center gap-3">
        {/* Mobile search icon — only visible below md breakpoint */}
        <button
          onClick={onSearchOpen}
          className="flex md:hidden items-center justify-center rounded-lg p-2 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open search"
          data-qqq-id="button-mobile-search"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Global search — hidden on mobile */}
        <GlobalSearch navTargets={navTargets} searchTables={searchTables} className="hidden md:block" />

        {/* Keyboard shortcuts hint */}
        <button
          ref={helpButtonRef}
          type="button"
          onClick={onHelpOpen}
          className="rounded-lg p-2 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Keyboard shortcuts (?)"
          data-qqq-id="button-keyboard-shortcuts"
        >
          <HelpCircle className="h-5 w-5 text-foreground/60" aria-hidden="true" />
        </button>

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
