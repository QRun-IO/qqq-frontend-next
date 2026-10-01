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
 * @file GlobalSearch — header search over apps, tables, processes, reports and recently
 * viewed records (matched locally), plus records found by the backend record search when
 * the metadata advertises searchable tables. Without searchable tables no search request is made.
 */

'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'

import type { NavTarget } from '@/lib/hooks/use-routes'
import { useRecordSearch } from '@/lib/hooks/use-record-search'
import { cn } from '@/lib/utils/cn'
import { getRecentRecords } from '@/lib/utils/recent-records'
import type { RecentRecord } from '@/lib/utils/recent-records'
import { buildNavigationSearchItems } from '@/lib/utils/navigation-search'
import type { SearchableTable } from '@/lib/utils/record-search'
import { NavigationSearchResults } from './NavigationSearchResults'

/** Records shown per table in the dropdown. */
const DROPDOWN_RECORDS_PER_TABLE = 5

/** Stable empty default for `searchTables`. */
const NO_SEARCH_TABLES: SearchableTable[] = []

/**
 * Props for the GlobalSearch component.
 */
export interface GlobalSearchProps {
  /** Navigable targets from the app tree. */
  navTargets: NavTarget[]
  /** Tables the backend record search covers (empty: record search unavailable, never called). */
  searchTables?: SearchableTable[]
  /** Additional Tailwind class names applied to the outermost container div. */
  className?: string
}

/**
 * Inline header search with a dropdown of matching pages (apps, tables,
 * processes, reports by label), records found by record search (when available)
 * and recently viewed records.
 *
 * - With no text, the dropdown lists recently viewed records.
 * - ArrowUp/ArrowDown move the selection; Enter opens the selected result, or
 *   the search page (`/app/search?q=…`) when nothing is selected; Escape closes.
 *
 * @param props - Component properties.
 * @returns A `<div>` containing the search combobox and, when open, a listbox dropdown.
 */
export function GlobalSearch({ navTargets, searchTables = NO_SEARCH_TABLES, className }: GlobalSearchProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])

  // Load recent records when the dropdown opens
  useEffect(() => {
    if (isOpen) {
      setRecentRecords(getRecentRecords().slice(0, 10))
    }
  }, [isOpen])

  const recordSearch = useRecordSearch(isOpen ? searchTerm : '', searchTables, DROPDOWN_RECORDS_PER_TABLE)
  const items = useMemo(
    () => buildNavigationSearchItems(navTargets, recentRecords, searchTerm, 8, recordSearch.results),
    [navTargets, recentRecords, searchTerm, recordSearch.results]
  )

  // Close dropdown on outside click
  useEffect(() => {
    /**
     * Closes the dropdown when the user clicks outside the search container.
     *
     * @param event - The native mousedown event from the document listener.
     */
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset selection when the result list changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [items])

  /**
   * Navigates to the given path, closes the dropdown, and clears the search term.
   *
   * @param path - The URL path to navigate to.
   */
  const handleNavigate = useCallback(
    (path: string) => {
      setIsOpen(false)
      setSearchTerm('')
      router.push(path)
    },
    [router]
  )

  /**
   * Handles keyboard navigation within the search dropdown.
   *
   * @param e - The synthetic keyboard event from the text input.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setIsOpen(true)
        }
        return
      }

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
          setIsOpen(false)
          inputRef.current?.blur()
          break
      }
    },
    [isOpen, selectedIndex, items, searchTerm, handleNavigate]
  )

  const hasTerm = searchTerm.trim().length > 0
  const showDropdown = isOpen && (hasTerm || items.length > 0)

  return (
    <div ref={containerRef} className={cn('relative', className)} data-qqq-id="header-search">
      {/* Search input */}
      <div className="flex items-center gap-2 rounded-full border border-input bg-background px-4 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={recordSearch.available ? 'Search...' : 'Jump to...'}
          className="w-36 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
          aria-label={recordSearch.available ? 'Search pages and records' : 'Search pages and recent records'}
          aria-expanded={showDropdown}
          aria-controls="header-search-results"
          aria-haspopup="listbox"
          aria-autocomplete="list"
          role="combobox"
          data-qqq-id="input-header-search"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-[22rem] max-w-[80vw] overflow-hidden rounded-xl border border-border bg-card shadow-lg z-50">
          <NavigationSearchResults
            id="header-search-results"
            items={items}
            term={searchTerm}
            selectedIndex={selectedIndex}
            onSelect={handleNavigate}
            onHover={setSelectedIndex}
            recordSearch={recordSearch}
          />
          {hasTerm && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => handleNavigate(`/app/search?q=${encodeURIComponent(searchTerm.trim())}`)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                data-qqq-id="button-header-search-all"
              >
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                Show all matches
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
