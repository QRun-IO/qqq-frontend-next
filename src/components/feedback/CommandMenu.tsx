'use client'

// CommandMenu — Cmd+K / Ctrl+K command palette
// Fuzzy-searches all sidebar routes from QContext
// Navigate with arrow keys, Enter to navigate, Escape to close

import React, { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { Search, Table2, Workflow, BarChart3, LayoutGrid, X } from 'lucide-react'

import { useQContext } from '@/lib/context/q-context'
import { cn } from '@/lib/utils/cn'

interface CommandMenuItem {
  id: string
  label: string
  path: string
  type: 'app' | 'table' | 'process' | 'report'
  breadcrumb?: string
}

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

interface CommandMenuProps {
  open: boolean
  onClose: () => void
}

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
        className="relative z-10 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        data-qqq-id="command-menu"
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
      >
        <Command shouldFilter={true} label="Command palette">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search pages, tables, processes..."
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
              autoFocus
              data-qqq-id="command-menu-search"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:text-gray-300"
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
          >
            <Command.Empty className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No results found.
            </Command.Empty>

            {items.length > 0 && (
              <Command.Group
                heading={
                  <span className="px-4 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
                      'text-gray-700 dark:text-gray-200',
                      'hover:bg-gray-100 dark:hover:bg-gray-800',
                      'aria-selected:bg-blue-50 aria-selected:text-blue-700',
                      'dark:aria-selected:bg-blue-950 dark:aria-selected:text-blue-300',
                      'outline-none transition-colors'
                    )}
                    data-qqq-id={`command-item-${item.id.replace(/\//g, '-')}`}
                  >
                    <TypeIcon type={item.type} />
                    <span className="flex-1 truncate font-medium">{item.label}</span>
                    {item.breadcrumb && (
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                        {item.breadcrumb}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer hint */}
          <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
            <div className="flex gap-4 text-xs text-gray-400">
              <span>
                <kbd className="rounded border border-gray-200 px-1 py-0.5 font-mono dark:border-gray-700">↑↓</kbd>{' '}
                navigate
              </span>
              <span>
                <kbd className="rounded border border-gray-200 px-1 py-0.5 font-mono dark:border-gray-700">↵</kbd>{' '}
                open
              </span>
              <span>
                <kbd className="rounded border border-gray-200 px-1 py-0.5 font-mono dark:border-gray-700">esc</kbd>{' '}
                close
              </span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  )
}
