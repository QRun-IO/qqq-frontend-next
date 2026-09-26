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
 * @file SearchDialog — "/" key search dialog over pages and recently viewed records, plus
 * records found by the backend record search when the metadata advertises searchable tables.
 */

'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight, X } from 'lucide-react'

import type { NavTarget } from '@/lib/hooks/use-routes'
import { useRecordSearch } from '@/lib/hooks/use-record-search'
import { getRecentRecords } from '@/lib/utils/recent-records'
import type { RecentRecord } from '@/lib/utils/recent-records'
import { buildNavigationSearchItems } from '@/lib/utils/navigation-search'
import type { SearchableTable } from '@/lib/utils/record-search'
import { NavigationSearchResults } from '@/components/layout/NavigationSearchResults'

/** Records shown per table in the dialog. */
const DIALOG_RECORDS_PER_TABLE = 5

/** Stable empty default for `searchTables`. */
const NO_SEARCH_TABLES: SearchableTable[] = []

/**
 * Props for the SearchDialog component.
 */
interface SearchDialogProps {
  /** Whether the search dialog is currently open. */
  open: boolean
  /** Called when the dialog should close (backdrop click, Escape, or item navigation). */
  onClose: () => void
  /** Navigable targets from the app tree. */
  navTargets: NavTarget[]
  /** Tables the backend record search covers (empty: record search unavailable, never called). */
  searchTables?: SearchableTable[]
}

/**
 * Modal search dialog triggered by the `/` keyboard shortcut.
 *
 * Lists recently viewed records until the user types, then matching pages
 * (apps, tables, processes, reports by label), records found by record search
 * (when available) and matching recent records.
 * ArrowUp/Down move the selection, Enter opens it (or the search page when
 * nothing is selected), Escape closes.
 *
 * @param props - Component properties.
 * @returns The dialog overlay, or `null` when closed.
 */
export function SearchDialog({ open, onClose, navTargets, searchTables = NO_SEARCH_TABLES }: SearchDialogProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])

  // Load recent records when the dialog opens; reset state
  useEffect(() => {
    if (open) {
      setRecentRecords(getRecentRecords().slice(0, 10))
      setSearchTerm('')
      setSelectedIndex(-1)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const recordSearch = useRecordSearch(open ? searchTerm : '', searchTables, DIALOG_RECORDS_PER_TABLE)
  const items = useMemo(
    () => buildNavigationSearchItems(navTargets, recentRecords, searchTerm, 8, recordSearch.results),
    [navTargets, recentRecords, searchTerm, recordSearch.results]
  )

  useEffect(() => {
    setSelectedIndex(-1)
  }, [items])

  /**
   * Closes the dialog and navigates to the given path.
   *
   * @param path - The URL path to navigate to.
   */
  const handleNavigate = useCallback(
    (path: string) => {
      onClose()
      router.push(path)
    },
    [router, onClose]
  )

  /**
   * Handles keyboard navigation within the result list.
   *
   * @param e - The synthetic keyboard event from the search input.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
          break
        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            handleNavigate(items[selectedIndex].path)
          } else if (searchTerm.trim()) {
            handleNavigate(`/app/search?q=${encodeURIComponent(searchTerm.trim())}`)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [selectedIndex, items, searchTerm, handleNavigate, onClose]
  )

  if (!open) return null

  const hasTerm = searchTerm.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center pt-[10vh] sm:pt-[15vh]"
      data-qqq-id="search-dialog-backdrop"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-lg overflow-hidden"
        data-qqq-id="search-dialog"
        role="dialog"
        aria-label="Search"
        aria-modal="true"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={recordSearch.available ? 'Search pages and records...' : 'Jump to a page or recent record...'}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
            aria-label={recordSearch.available ? 'Search pages and records' : 'Search pages and recent records'}
            aria-expanded={true}
            aria-controls="search-dialog-results"
            aria-haspopup="listbox"
            aria-autocomplete="list"
            role="combobox"
            data-qqq-id="search-dialog-input"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            esc
          </kbd>
        </div>

        {/* Results */}
        {hasTerm || items.length > 0 ? (
          <NavigationSearchResults
            id="search-dialog-results"
            items={items}
            term={searchTerm}
            selectedIndex={selectedIndex}
            onSelect={handleNavigate}
            onHover={setSelectedIndex}
            recordSearch={recordSearch}
          />
        ) : (
          <div id="search-dialog-results" className="px-4 py-8 text-center text-sm text-muted-foreground">
            {recordSearch.available ? 'Type to find an app, table, process or record...' : 'Type to find an app, table, process or recent record...'}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex gap-4">
              <span>
                <kbd className="rounded border border-border px-1 py-0.5 font-mono">↑↓</kbd>{' '}navigate
              </span>
              <span>
                <kbd className="rounded border border-border px-1 py-0.5 font-mono">↵</kbd>{' '}open
              </span>
            </div>
            {hasTerm && (
              <button
                type="button"
                onClick={() => handleNavigate(`/app/search?q=${encodeURIComponent(searchTerm.trim())}`)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent hover:text-foreground transition-colors"
              >
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                Show all matches
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
