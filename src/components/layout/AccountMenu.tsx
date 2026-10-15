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
 * @file AccountMenu — the signed-in user's avatar at the far right of the header (the usual
 * "my account" place): name and email, Preferences and the sections that opt into the menu,
 * dark mode, QA mode status, and sign out.
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Bug, ChevronDown, LogOut, Moon, Settings } from 'lucide-react'

import { getPreferences } from '@/lib/api/preferences'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useQaCaptureCapability } from '@/lib/hooks/use-qa-capture'
import { queryKeys } from '@/lib/query-client'
import { useTheme } from '@/lib/theme/theme-provider'
import { cn } from '@/lib/utils/cn'
import { gravatarUrl } from '@/lib/utils/gravatar'
import { MetadataIcon } from './MetadataIcon'
import { HEADER_MENU_ITEM_CLASS, HeaderMenu, HeaderMenuSeparator } from './HeaderMenu'

/** Below this width the header shows only Search, Jobs, Notifications and the avatar. */
export const COMPACT_HEADER_QUERY = '(max-width: 639px)'

/** Props for {@link AccountMenu}. */
export interface AccountMenuProps {
  /** Display name of the signed-in user ("Anonymous" when absent, as Material does). */
  userName?: string
  /** Email of the signed-in user. */
  userEmail?: string
  /** Signs out; the Sign out item is shown only with it. */
  logout?: () => void
  /** Branding's Gravatar default; without it no email hash leaves the browser. */
  gravatarDefault?: string
  /**
   * Items shown first on compact screens, where the header has no room for them (Help, Ask).
   * Each must have a `menuitem` role; call `close` when chosen.
   */
  compactItems?: (close: (then?: () => void) => void) => React.ReactNode
}

/**
 * The account avatar and its menu.
 *
 * @param props - Component properties.
 * @returns The avatar button and menu.
 */
export function AccountMenu({ userName, userEmail, logout, gravatarDefault, compactItems }: AccountMenuProps) {
  const displayName = userName || 'Anonymous'
  const avatarUrl = gravatarDefault ? gravatarUrl(userEmail, gravatarDefault) : undefined
  const [avatarFailed, setAvatarFailed] = useState(false)
  const capability = useQaCaptureCapability()
  const qaMode = capability?.enabled && capability.reason === 'QA_MODE'

  const avatar = avatarUrl && !avatarFailed ? (
    // eslint-disable-next-line @next/next/no-img-element -- Gravatar images are external, sized by the service
    <img src={avatarUrl} alt="" aria-hidden="true" onError={() => setAvatarFailed(true)}
      className="h-8 w-8 rounded-full object-cover" data-qqq-id="header-user-avatar" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold text-foreground"
      aria-hidden="true" data-qqq-id="header-user-avatar">
      {displayName.charAt(0).toUpperCase()}
    </span>
  )

  return (
    <HeaderMenu
      label={qaMode ? `Account: ${displayName} (QA mode on)` : `Account: ${displayName}`}
      qqqId="button-account"
      triggerClassName="gap-1 px-1"
      trigger={(
        <>
          <span className="relative">
            {avatar}
            {/* QA mode shows as a dot on the avatar; its name is in the button's label */}
            {qaMode && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-amber-500" aria-hidden="true" data-qqq-id="qa-mode-dot" />}
          </span>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground min-[1440px]:block" aria-hidden="true" />
        </>
      )}
    >
      {(close) => <AccountMenuItems displayName={displayName} userEmail={userEmail} logout={logout} close={close} compactItems={compactItems} />}
    </HeaderMenu>
  )
}

/**
 * The menu's items; preference sections load when the menu opens.
 *
 * @param props - Component properties.
 * @returns The items.
 */
function AccountMenuItems({ displayName, userEmail, logout, close, compactItems }: {
  displayName: string
  userEmail?: string
  logout?: () => void
  close: (then?: () => void) => void
  compactItems?: (close: (then?: () => void) => void) => React.ReactNode
}) {
  const { theme, isDarkMode, setDarkMode } = useTheme()
  const capability = useQaCaptureCapability()
  const preferences = useQuery({ queryKey: queryKeys.preferencesIndex(), queryFn: getPreferences, retry: false })
  const qaSection = capability?.enabled && capability.reason === 'QA_MODE' ? capability.qaMode.preferenceSection : undefined
  // the compact header (below Tailwind's sm, 640 px) has no room for Help and Ask
  const isCompact = useMediaQuery(COMPACT_HEADER_QUERY)
  const compact = isCompact ? compactItems?.(close) : null

  return (
    <>
      <div className="px-4 pb-2 pt-2" data-qqq-id="header-user-identity">
        <p className="truncate text-sm font-semibold text-foreground" data-qqq-id="header-user-name">{displayName}</p>
        {userEmail && <p className="truncate text-xs text-muted-foreground" data-qqq-id="header-user-email">{userEmail}</p>}
      </div>
      <HeaderMenuSeparator />
      {compact && (
        <div data-qqq-id="account-menu-compact">
          {compact}
          <HeaderMenuSeparator />
        </div>
      )}
      <Link href="/app/preferences" role="menuitem" onClick={() => close()} className={HEADER_MENU_ITEM_CLASS} data-qqq-id="menu-item-preferences">
        <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Preferences
      </Link>
      {preferences.data?.sections.filter((section) => section.showInUserMenu).map((section) => (
        <Link key={section.name} href={`/app/preferences?section=${encodeURIComponent(section.name)}`} role="menuitem" onClick={() => close()}
          className={HEADER_MENU_ITEM_CLASS} data-qqq-id={`menu-item-preferences-${section.name}`}>
          <MetadataIcon icon={section.icon} kind="section" className="h-4 w-4 text-muted-foreground" />
          {section.label}
        </Link>
      ))}
      {/* Applies immediately, without leaving the page; full display settings live on the Preferences page. */}
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={isDarkMode}
        disabled={Boolean(theme)}
        title={theme ? 'This application theme requires light mode.' : undefined}
        onClick={() => setDarkMode(!isDarkMode)}
        className={HEADER_MENU_ITEM_CLASS}
        data-qqq-id="menu-item-dark-mode"
      >
        <Moon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-left">Dark mode</span>
        <span aria-hidden="true" className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', isDarkMode ? 'bg-primary' : 'bg-muted-foreground/30')}>
          <span className={cn('inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform', isDarkMode ? 'translate-x-4' : 'translate-x-0.5')} />
        </span>
      </button>
      {capability?.enabled && capability.reason === 'QA_MODE' && (
        qaSection ? (
          <Link href={`/app/preferences?section=${encodeURIComponent(qaSection)}`} role="menuitem" onClick={() => close()}
            className={HEADER_MENU_ITEM_CLASS} data-qqq-id="qa-mode-indicator">
            <Bug className="h-4 w-4 text-amber-600" aria-hidden="true" />
            QA mode: on
          </Link>
        ) : (
          <p className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground" data-qqq-id="qa-mode-indicator">
            <Bug className="h-4 w-4 text-amber-600" aria-hidden="true" />
            QA mode: on
          </p>
        )
      )}
      {logout && (
        <>
          <HeaderMenuSeparator />
          <button type="button" role="menuitem" onClick={() => close(logout)} className={HEADER_MENU_ITEM_CLASS} data-qqq-id="sidenav-logout-button">
            <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Sign out
          </button>
        </>
      )}
    </>
  )
}
