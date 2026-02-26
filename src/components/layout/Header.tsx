'use client'

// Header component — displays page title, user info, logout button
// Mobile: shows hamburger button to toggle sidebar drawer

import React from 'react'
import { LogOut, Moon, Sun, Menu } from 'lucide-react'

import { useQContext } from '@/lib/context/q-context'
import { useTheme } from '@/lib/theme/theme-provider'

export interface HeaderProps {
  appName?: string
  onLogout?: () => void
  userName?: string
  userEmail?: string
  /** Mobile: called when the hamburger menu button is clicked */
  onMenuOpen?: () => void
}

export default function Header({ appName, onLogout, userName, userEmail, onMenuOpen }: HeaderProps) {
  const { pageHeader } = useQContext()
  const { isDarkMode, toggleDarkMode } = useTheme()

  const displayTitle = pageHeader || appName || 'QQQ Admin'

  return (
    <header
      className="flex items-center justify-between border-b px-4 md:px-6"
      style={{
        height: 'var(--qqq-header-height)',
        background: 'var(--qqq-header-background)',
        borderColor: 'var(--qqq-header-border)',
        color: 'var(--qqq-header-text)',
      }}
      data-qqq-id="header"
    >
      {/* Left: mobile menu + page title */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger — only visible below md breakpoint */}
        <button
          onClick={onMenuOpen}
          className="flex md:hidden items-center justify-center rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Open navigation menu"
          data-qqq-id="button-mobile-menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-semibold" data-qqq-id="header-title">
          {displayTitle}
        </h1>
      </div>

      {/* Right section: dark mode, user info, logout */}
      <div className="flex items-center gap-4">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          data-qqq-id="button-dark-mode-toggle"
        >
          {isDarkMode ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* User info */}
        {(userName || userEmail) && (
          <div className="flex flex-col text-right" data-qqq-id="header-user">
            {userName && (
              <span className="text-sm font-medium" data-qqq-id="header-user-name">
                {userName}
              </span>
            )}
            {userEmail && (
              <span className="text-xs opacity-60" data-qqq-id="header-user-email">
                {userEmail}
              </span>
            )}
          </div>
        )}

        {/* Logout button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-900/20"
            aria-label="Logout"
            data-qqq-id="button-logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Logout</span>
          </button>
        )}
      </div>
    </header>
  )
}
