'use client'

/** CommandMenu — Cmd+K / Ctrl+K command palette that fuzzy-searches all sidebar routes from QContext. */

import React, { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { Search, Table2, Workflow, BarChart3, LayoutGrid, X } from 'lucide-react'

import { useQContext } from '@/lib/context/q-context'
import { cn } from '@/lib/utils/cn'

/**
 * Represents a single navigable entry in the command palette list.
 */
interface CommandMenuItem {
  /** Unique identifier (the route path). */
  id: string
  /** Human-readable display label shown in the list. */
  label: string
  /** The URL path to navigate to when this item is selected. */
  path: string
  /** The type of resource, used to select an icon. */
  type: 'app' | 'table' | 'process' | 'report'
  /** Optional parent-app label shown as a breadcrumb hint on the right. */
  breadcrumb?: string
}

/**
 * Converts the flat `pathToLabelMap` from QContext into a list of CommandMenuItems.
 *
 * Parametric paths (containing `:`) and utility sub-paths (`/create`, `/dev`,
 * `/key`, `/savedView`) are filtered out. Two-segment paths under `/app` are
 * classified as `'app'` type; three-segment paths are `'table'` type with the
 * parent-app label injected as a breadcrumb.
 *
 * @param pathToLabelMap - Map of URL path strings to display label strings.
 * @returns An array of command palette items ready for fuzzy search.
 */
function buildMenuItems(pathToLabelMap: Record<string, string>): CommandMenuItem[] {
  const items: CommandMenuItem[] = []

  for (const [path, label] of Object.entries(pathToLabelMap)) {
    // Skip parametric paths and dev/utility pages
    if (path.includes(':') || path.includes('/create') || path.includes('/dev') || path.includes('/key') || path.includes('/savedView')) {
      continue
    }

    const parts = path.split('/').filter(Boolean) // e.g. ['app', 'employees'] or ['app', 'crm', 'employees']

    let type: CommandMenuItem['type'] = 'table'
    let breadcrumb: string | undefined

    if (parts.length === 2 && parts[0] === 'app') {
      // Could be app home or table
      type = 'app'
    } else if (parts.length === 3) {
      type = 'table'
      const parentPath = `/${parts[0]}/${parts[1]}`
      breadcrumb = pathToLabelMap[parentPath]
    }

    items.push({
      id: path,
      label,
      path,
      type,
      breadcrumb,
    })
  }

  return items
}

/**
 * Renders a color-coded Lucide icon for a given command item type.
 *
 * @param type - The resource type (`'app'`, `'table'`, `'process'`, or `'report'`).
 * @returns An `aria-hidden` icon element colored by type.
 */
function TypeIcon({ type }: { type: CommandMenuItem['type'] }) {
  switch (type) {
    case 'app':
      return <LayoutGrid className="h-4 w-4 text-blue-500" aria-hidden="true" />
    case 'table':
      return <Table2 className="h-4 w-4 text-green-500" aria-hidden="true" />
    case 'process':
      return <Workflow className="h-4 w-4 text-purple-500" aria-hidden="true" />
    case 'report':
      return <BarChart3 className="h-4 w-4 text-orange-500" aria-hidden="true" />
  }
}

/**
 * Props for the CommandMenu component.
 */
interface CommandMenuProps {
  /** Whether the command palette is currently open. */
  open: boolean
  /** Called when the palette should close (backdrop click, Escape, or item selected). */
  onClose: () => void
}

/**
 * Renders the Cmd+K command palette overlay.
 *
 * Uses the `cmdk` Command primitive for fuzzy search and keyboard navigation.
 * All navigable routes are derived from `pathToLabelMap` in QContext. The
 * search term is cleared each time the palette closes. Selecting an item
 * navigates via the Next.js router and calls `onClose`.
 *
 * @param open - Whether the palette is visible.
 * @param onClose - Callback invoked to close the palette.
 * @returns A fixed full-screen overlay with the command palette dialog, or `null` when closed.
 */
export function CommandMenu({ open, onClose }: CommandMenuProps) {
  const router = useRouter()
  const { pathToLabelMap } = useQContext()
  const [search, setSearch] = useState('')

  const items = buildMenuItems(pathToLabelMap)

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

  if (!open) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center pt-[10vh] sm:pt-[15vh]"
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
      >
        <Command shouldFilter={true} label="Command palette">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search pages, tables, processes..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
              data-qqq-id="command-menu-search"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {items.length > 0 && (
              <Command.Group
                heading={
                  <span className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Navigation
                  </span>
                }
              >
                {items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.breadcrumb ?? ''}`}
                    onSelect={() => handleSelect(item.path)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm',
                      'text-foreground',
                      'hover:bg-accent',
                      'aria-selected:bg-primary/10 aria-selected:text-primary',
                      'outline-none transition-colors'
                    )}
                    data-qqq-id={`command-item-${item.id.replace(/\//g, '-')}`}
                  >
                    <TypeIcon type={item.type} />
                    <span className="flex-1 truncate font-medium">{item.label}</span>
                    {item.breadcrumb && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.breadcrumb}
                      </span>
                    )}
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
