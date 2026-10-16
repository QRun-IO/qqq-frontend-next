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
 * @file Header — the top bar: navigation and breadcrumbs on the left; on the right, from the most
 * general to the most personal, Search · Ask · Jobs · Notifications · Help · Account.
 */

'use client'

import React, { useRef, useSyncExternalStore } from 'react'
import { Menu, Search } from 'lucide-react'

import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { JobsHeaderButton } from '@/components/jobs/JobsHeaderButton'
import { useToastTopBelow } from '@/components/feedback/Toast'
import type { ParentAppInfo } from '@/lib/hooks/use-routes'
import { cn } from '@/lib/utils/cn'
import { HEADER_BUTTON_CLASS } from './HeaderMenu'

/**
 * Props for the Header component.
 */
export interface HeaderProps {
  /** Application name from branding metadata (reserved for a future title display). */
  appName?: string
  /** Opens the navigation drawer (below 1024 px, where the sidebar is not a column). */
  onMenuOpen?: () => void
  /** Whether the navigation drawer is open (reflected on the menu button). */
  menuOpen?: boolean
  /** Ref to the menu button, so the drawer can return focus to it when it closes. */
  menuButtonRef?: React.Ref<HTMLButtonElement>
  /** Opens the search box (the one search: pages, records, actions, help, Ask). */
  onSearchOpen?: () => void
  /** Path-to-label map passed through to the Breadcrumbs component. */
  pathToLabelMap?: Record<string, string>
  /** Maps node paths to their enclosing apps, passed through to Breadcrumbs. */
  ancestorAppMap?: Record<string, ParentAppInfo[]>
  /** Where the breadcrumb home crumb links (the instance's home app, or `/app`). */
  homePath?: string
  /** The assistant's Ask button, when the assistant is available. */
  assistantButton?: React.ReactNode
  /** The notifications bell (the Alerts qbit's), when Alerts is available. */
  notificationsButton?: React.ReactNode
  /** The Help menu (always present: WCAG 3.2.6 consistent help). */
  helpMenu?: React.ReactNode
  /** The signed-in user's account menu (avatar), always last. */
  accountMenu?: React.ReactNode
}

/**
 * Whether the browser runs on an Apple platform, for the ⌘K / Ctrl K hint.
 *
 * @returns `true` on macOS and iOS.
 */
function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => false
  )
}

/**
 * Renders the application top bar.
 *
 * Collapse rules by width (IA review 2026-10-15 §6.3; owner: Jobs is always shown):
 * - below 640 px: menu, breadcrumbs, then search (icon), Jobs, Notifications and the avatar; Help
 *   and Ask move into the avatar menu;
 * - from 640 px: Ask and Help return as icons; from 768 px search is a field;
 * - from 1024 px the sidebar is a column, so the menu button goes;
 * - from 1440 px Ask shows its text label and search its ⌘K hint; the field is at most 560 px.
 * Every control is 40 px square, 44 px for coarse pointers, with 4 px gaps.
 *
 * @param props - Component properties.
 * @returns The `<header>` element.
 */
export default function Header({ onMenuOpen, menuOpen = false, menuButtonRef, onSearchOpen, pathToLabelMap = {}, ancestorAppMap = {}, homePath, assistantButton, notificationsButton, helpMenu, accountMenu }: HeaderProps) {
  // toasts appear below the header, never over its controls
  const headerRef = useRef<HTMLElement>(null)
  useToastTopBelow(headerRef)
  const apple = useIsApplePlatform()
  const shortcut = apple ? '⌘K' : 'Ctrl K'

  return (
    <header
      ref={headerRef}
      className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 md:px-6"
      style={{ minHeight: 'var(--qqq-header-height)' }}
      data-qqq-id="header"
    >
      {/* Left: navigation drawer button + a breadcrumb trail that truncates long labels and wraps instead of scrolling */}
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onMenuOpen}
          className={cn(HEADER_BUTTON_CLASS, 'lg:hidden')}
          aria-label="Menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          data-qqq-id="button-mobile-menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Breadcrumbs pathToLabelMap={pathToLabelMap} ancestorAppMap={ancestorAppMap} homePath={homePath} />
      </div>

      {/* Right: find, ask, monitor, help, me */}
      <div className="flex flex-shrink-0 items-center gap-1 md:min-w-0 md:flex-1 md:justify-end">
        <button
          type="button"
          onClick={(event) => {
            // WebKit can activate a button without focusing it; focus returns here when search closes
            event.currentTarget.focus({ preventScroll: true })
            onSearchOpen?.()
          }}
          aria-label="Search or jump to"
          aria-haspopup="dialog"
          aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
          className={cn(
            HEADER_BUTTON_CLASS,
            'md:w-full md:max-w-[560px] md:justify-start md:gap-2 md:border md:border-border md:bg-background md:px-3 md:text-sm md:text-muted-foreground'
          )}
          data-qqq-id="button-search"
        >
          <Search className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
          <span className="hidden flex-1 truncate text-left md:inline">Search or jump to…</span>
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 font-mono text-xs min-[1440px]:inline" aria-hidden="true">{shortcut}</kbd>
        </button>

        {assistantButton && (
          <div role="group" aria-label="Assistant" className="hidden items-center sm:flex" data-qqq-id="header-group-assistant">
            {assistantButton}
          </div>
        )}

        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <div role="group" aria-label="Activity" className="flex items-center gap-1" data-qqq-id="header-group-activity">
          <JobsHeaderButton />
          {notificationsButton}
        </div>

        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <div role="group" aria-label="Help and account" className="flex items-center gap-1" data-qqq-id="header-group-account">
          {helpMenu && <div className="hidden sm:flex">{helpMenu}</div>}
          {accountMenu}
        </div>
      </div>
    </header>
  )
}
