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
 * @file CommandMenu — Cmd+K / Ctrl+K command palette that fuzzy-searches every navigable app, table, process and report.
 */

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

import type { NavTarget } from '@/lib/hooks/use-routes'
import { cn } from '@/lib/utils/cn'
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
export function CommandMenu({ open, onClose, navTargets }: CommandMenuProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')

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
      >
        <Command shouldFilter={true} label="Command palette">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search apps, tables, processes..."
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
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {navTargets.length > 0 && (
              <Command.Group
                heading={
                  <span className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Navigation
                  </span>
                }
              >
                {navTargets.map((target) => {
                  const context = target.ancestors.map((ancestor) => ancestor.label).join(' / ')
                  return (
                    <Command.Item
                      key={target.path}
                      value={`${target.label} ${context} ${target.path}`}
                      onSelect={() => handleSelect(target.path)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm',
                        'text-foreground',
                        'hover:bg-accent',
                        'aria-selected:bg-primary/10 aria-selected:text-primary',
                        'outline-none transition-colors'
                      )}
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
