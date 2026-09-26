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
 * @file CommandMenu — Cmd+K / Ctrl+K / "." command palette (Material CommandMenu): the current
 * table's actions, every navigable app, table, process and report, and the recently viewed records.
 */

'use client'

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { usePathname, useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

import type { QInstance } from '@/types'
import type { NavTarget } from '@/lib/hooks/use-routes'
import { cn } from '@/lib/utils/cn'
import { buildTableActions, commandMatches, compareCommandLabels, tableScreenFor, type TableAction } from '@/lib/utils/command-palette'
import { getRecentRecords, type RecentRecord } from '@/lib/utils/recent-records'
import { MetadataIcon, type MetadataIconKind } from '@/components/layout/MetadataIcon'

/** Fallback icon kind for each app-tree node type. */
const ICON_KIND: Record<string, MetadataIconKind> = { APP: 'app', TABLE: 'table', PROCESS: 'process', REPORT: 'report' }

/** Human-readable type shown for each entry. */
const TYPE_LABEL: Record<string, string> = { APP: 'App', TABLE: 'Table', PROCESS: 'Process', REPORT: 'Report' }

/**
 * Props for the CommandMenu component.
 */
interface CommandMenuProps {
  /** Whether the command palette is currently open. */
  open: boolean
  /** Called when the palette should close (backdrop click, Escape, or item selected). */
  onClose: () => void
  /** Navigable app-tree nodes (hidden objects already excluded). */
  navTargets: NavTarget[]
  /** Instance metadata, for the current table's actions (omit for navigation only). */
  metaData?: QInstance
}

/** Shared classes of a palette entry (44 px tall on touch screens). */
const ITEM_CLASS = cn(
  'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm pointer-coarse:min-h-11',
  'text-foreground',
  'hover:bg-accent',
  'aria-selected:bg-primary/10 aria-selected:text-primary',
  'outline-none transition-colors'
)

/**
 * A palette group heading.
 *
 * @param props - Component properties.
 * @param props.children - Heading text.
 * @returns The heading element.
 */
function GroupHeading({ children }: { children: React.ReactNode }) {
  return <span className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</span>
}

/**
 * Renders the Cmd+K command palette overlay.
 *
 * Uses the `cmdk` Command primitive for fuzzy search and keyboard navigation
 * over every navigable app, table, process and report (by metadata label, with
 * its type and enclosing apps as context). Selecting an item navigates and closes.
 *
 * @param props - Component properties.
 * @returns A fixed full-screen backdrop with the command palette dialog, or
 *   `null` when `open` is `false`. Keyboard: ↑↓ navigate, ↵ open, Esc close.
 */
export function CommandMenu({ open, onClose, navTargets, metaData }: CommandMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState('')
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])
  const [hash, setHash] = useState('')

  // Recently viewed records and the hash (an open audit dialog hides the table actions) are read on open
  useEffect(() => {
    if (!open) return
    setRecentRecords(getRecentRecords())
    setHash(window.location.hash)
  }, [open])
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // Remember what had focus before the palette opened, and give it focus back on close
  // (a modal dialog restores focus to its trigger).
  useEffect(() => {
    if (open) return
    const returnTo = returnFocusRef.current
    returnFocusRef.current = null
    if (returnTo?.isConnected) returnTo.focus()
    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && !event.target.closest('[data-qqq-id="command-menu"]')) returnFocusRef.current = event.target
    }
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      returnFocusRef.current = document.activeElement
    }
    document.addEventListener('focusin', remember)
    return () => document.removeEventListener('focusin', remember)
  }, [open])

  /**
   * Keeps Tab and Shift+Tab inside the palette while it is open (focus trap).
   *
   * @param event - The keydown event from within the dialog.
   */
  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.hasAttribute('disabled'))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // Clear search when closed
  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  /**
   * Navigates to the selected item's path and closes the palette.
   *
   * @param path - The URL path of the selected command item.
   */
  const handleSelect = useCallback(
    (path: string) => {
      router.push(path)
      onClose()
    },
    [router, onClose]
  )

  // The current table's actions (Material "{Table} Actions"), on its query and record screens
  const screen = useMemo(() => (open ? tableScreenFor(pathname ?? '', hash, metaData) : null), [open, pathname, hash, metaData])
  const tableActions = useMemo(() => (screen && metaData ? buildTableActions(screen, metaData) : []), [screen, metaData])

  // Material's filter (per-word substring) and ranking (labels that start with the search first)
  const visibleActions = search ? tableActions.filter((action) => commandMatches(action.label, search)) : tableActions
  const visibleTargets = useMemo(() => {
    if (!search) return navTargets
    return navTargets
      .filter((target) => commandMatches([target.label, ...target.ancestors.map((ancestor) => ancestor.label)].join(' '), search))
      .sort((a, b) => compareCommandLabels(a.label, b.label, search))
  }, [navTargets, search])
  const visibleRecent = useMemo(() => {
    if (!search) return recentRecords
    return recentRecords
      .filter((record) => commandMatches(`${record.recordLabel} ${record.tableLabel}`, search))
      .sort((a, b) => compareCommandLabels(a.recordLabel, b.recordLabel, search))
  }, [recentRecords, search])

  /**
   * Runs a table action: navigates to it, or opens the record's audit dialog (`#audit`).
   *
   * @param action - The chosen action.
   */
  const runAction = (action: TableAction) => {
    if (action.path) {
      handleSelect(action.path)
      return
    }
    onClose()
    // a hash change (not a router push) reaches the record view's hash handler
    window.history.pushState(null, '', '#audit')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  if (!open) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 flex items-start justify-center pt-[10vh] sm:pt-[15vh]"
      style={{ zIndex: 'var(--qqq-z-toast)' } as React.CSSProperties}
      data-qqq-id="command-menu-backdrop"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Command palette */}
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-lg"
        data-qqq-id="command-menu"
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        ref={dialogRef}
        onKeyDown={trapFocus}
      >
        <Command shouldFilter={false} label="Command palette">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search for tables, actions, or recently viewed items..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
              data-qqq-id="command-menu-search"
            />
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close command palette"
              data-qqq-id="button-command-menu-close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Results list */}
          <Command.List
            className="max-h-80 overflow-y-auto py-2"
            aria-label="Navigation results"
            aria-live="polite"
            data-qqq-id="command-menu-results"
          >
            {visibleActions.length === 0 && visibleTargets.length === 0 && visibleRecent.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground" role="status" data-qqq-id="command-menu-empty">
                No results found.
              </p>
            )}

            {screen && visibleActions.length > 0 && (
              <Command.Group heading={<GroupHeading>{screen.table.label} Actions</GroupHeading>} data-qqq-id="command-group-actions">
                {visibleActions.map((action) => (
                  <Command.Item
                    key={action.key}
                    value={`action:${action.key}`}
                    onSelect={() => runAction(action)}
                    className={ITEM_CLASS}
                    data-qqq-id={`command-action-${action.key}`}
                  >
                    <MetadataIcon icon={action.icon} kind="process" />
                    <span className="flex-1 truncate font-medium">{action.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {visibleTargets.length > 0 && (
              <Command.Group heading={<GroupHeading>Navigation</GroupHeading>} data-qqq-id="command-group-navigation">
                {visibleTargets.map((target) => {
                  const context = target.ancestors.map((ancestor) => ancestor.label).join(' / ')
                  return (
                    <Command.Item
                      key={target.path}
                      value={`page:${target.path}`}
                      onSelect={() => handleSelect(target.path)}
                      className={ITEM_CLASS}
                      data-qqq-id={`command-item-${target.key}`}
                      data-node-type={target.nodeType}
                    >
                      <MetadataIcon icon={target.icon} kind={ICON_KIND[target.nodeType]} />
                      <span className="flex-1 truncate font-medium">{target.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {context ? `${TYPE_LABEL[target.nodeType]} · ${context}` : TYPE_LABEL[target.nodeType]}
                      </span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {visibleRecent.length > 0 && (
              <Command.Group heading={<GroupHeading>Recently Viewed Records</GroupHeading>} data-qqq-id="command-group-recent">
                {visibleRecent.map((record) => (
                  <Command.Item
                    key={record.path}
                    value={`recent:${record.path}`}
                    onSelect={() => handleSelect(record.path)}
                    className={ITEM_CLASS}
                    data-qqq-id={`command-recent-${record.tableName}-${record.recordId}`}
                  >
                    <MetadataIcon icon={record.tableIcon} kind="table" />
                    <span className="flex-1 truncate font-medium">{record.recordLabel}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{record.tableLabel}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer hint */}
          <div className="border-t border-border px-4 py-2">
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>
                <kbd className="rounded border border-border px-1 py-0.5 font-mono">↑↓</kbd>{' '}
                navigate
              </span>
              <span>
                <kbd className="rounded border border-border px-1 py-0.5 font-mono">↵</kbd>{' '}
                open
              </span>
              <span>
                <kbd className="rounded border border-border px-1 py-0.5 font-mono">esc</kbd>{' '}
                close
              </span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  )
}
