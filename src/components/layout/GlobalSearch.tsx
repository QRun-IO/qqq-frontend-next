'use client'

/** GlobalSearch — inline header search component showing recent records and live API search results in a dropdown. */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, Clock, ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import { globalSearch } from '@/lib/api/tables'
import type { GlobalSearchResult } from '@/lib/api/tables'
import { getRecentRecords } from '@/lib/utils/recent-records'
import type { RecentRecord } from '@/lib/utils/recent-records'
import { queryKeys } from '@/lib/query-client'

/**
 * Props for the GlobalSearch component.
 */
export interface GlobalSearchProps {
  /** Additional Tailwind class names applied to the outermost container div. */
  className?: string
}

/**
 * Generates initials from a record label (first letter of first two words).
 */
function getInitials(label: string): string {
  const words = label.trim().split(/\s+/)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

/**
 * Highlights matching portions of text by wrapping them in <mark> tags.
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) {
    return <>{text}</>
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

/**
 * Inline header search widget with a dropdown that shows recently-viewed records
 * (when the query is short) or live API search results grouped by table.
 *
 * The search term is debounced by 300 ms before triggering a TanStack Query
 * fetch. Full keyboard navigation (ArrowUp/Down, Enter, Escape) is supported.
 * Pressing Enter with no result selected navigates to the global search page.
 *
 * @param className - Additional class names applied to the container div.
 * @returns The search input together with its dropdown results panel.
 */
export function GlobalSearch({ className }: GlobalSearchProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])

  // Debounced search term for API calls
  const [debouncedTerm, setDebouncedTerm] = useState('')

  // Debounce the search term by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // TanStack Query for search results
  const {
    data: searchResults = [],
    isLoading: isSearching,
  } = useQuery<GlobalSearchResult[]>({
    queryKey: queryKeys.globalSearch(debouncedTerm),
    queryFn: () => globalSearch(debouncedTerm),
    enabled: debouncedTerm.length >= 2,
    staleTime: 1000 * 30, // 30 seconds
  })

  // Load recent records when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setRecentRecords(getRecentRecords().slice(0, 10))
    }
  }, [isOpen])

  // Build the list of navigable items for keyboard navigation
  const navigableItems: Array<{ path: string; label: string }> = []

  if (searchTerm.length >= 2 && searchResults.length > 0) {
    for (const result of searchResults) {
      navigableItems.push({
        path: `/app/${encodeURIComponent(result.tableName)}/${encodeURIComponent(result.recordId)}`,
        label: result.recordLabel,
      })
    }
  } else if (searchTerm.length < 2 && recentRecords.length > 0) {
    for (const record of recentRecords) {
      navigableItems.push({
        path: record.path,
        label: record.recordLabel,
      })
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchResults, recentRecords, searchTerm])

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
   * Opens the dropdown when the search input receives focus.
   */
  const handleInputFocus = useCallback(() => {
    setIsOpen(true)
  }, [])

  /**
   * Updates the search term and ensures the dropdown is open as the user types.
   *
   * @param e - The synthetic change event from the text input.
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setIsOpen(true)
  }, [])

  /**
   * Handles keyboard navigation within the search dropdown.
   *
   * ArrowDown/Up move the selection index, Enter navigates to the selected item
   * or the full-search page, and Escape closes the dropdown.
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
          setSelectedIndex((prev) =>
            prev < navigableItems.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
          break
        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0 && selectedIndex < navigableItems.length) {
            handleNavigate(navigableItems[selectedIndex].path)
          } else if (searchTerm.trim()) {
            // Navigate to full search page
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
    [isOpen, selectedIndex, navigableItems, searchTerm, handleNavigate]
  )

  // Group search results by table name
  const groupedResults: Record<string, GlobalSearchResult[]> = {}
  if (searchTerm.length >= 2) {
    for (const result of searchResults) {
      const key = result.tableLabel || result.tableName
      if (!groupedResults[key]) {
        groupedResults[key] = []
      }
      groupedResults[key].push(result)
    }
  }

  // Track a running index across all grouped results for keyboard selection
  let runningIndex = 0

  const showRecent = searchTerm.length < 2 && recentRecords.length > 0
  const showResults = searchTerm.length >= 2
  const showEmpty =
    searchTerm.length >= 2 && !isSearching && searchResults.length === 0
  const showDropdown = isOpen && (showRecent || showResults || showEmpty)

  return (
    <div ref={containerRef} className={cn('relative', className)} data-qqq-id="header-search">
      {/* Search input */}
      <div className="flex items-center gap-2 rounded-full border border-input bg-background px-4 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="w-36 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
          aria-label="Search records"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          role="combobox"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-2 w-full min-w-[320px] rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50"
          role="listbox"
          aria-label="Search results"
        >
          <div className="max-h-[400px] overflow-y-auto">
            {/* Recently Viewed section */}
            {showRecent && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Recently Viewed
                </div>
                {recentRecords.map((record, index) => (
                  <button
                    key={record.path}
                    onClick={() => handleNavigate(record.path)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      selectedIndex === index ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                    role="option"
                    aria-selected={selectedIndex === index}
                  >
                    {/* Initials avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {getInitials(record.recordLabel)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {record.recordLabel}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {record.tableLabel}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Search Results section */}
            {showResults && !showEmpty && (
              <div>
                {isSearching ? (
                  <div className="flex items-center justify-center px-3 py-6">
                    <div
                      className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
                      role="status"
                      aria-label="Searching"
                    />
                    <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                  </div>
                ) : (
                  Object.entries(groupedResults).map(([tableLabel, results]) => {
                    const groupItems = results.map((result, resultIdx) => {
                      const itemIndex = runningIndex
                      runningIndex++
                      return (
                        <button
                          key={`${result.tableName}-${result.recordId}-${resultIdx}`}
                          onClick={() =>
                            handleNavigate(
                              `/app/${encodeURIComponent(result.tableName)}/${encodeURIComponent(result.recordId)}`
                            )
                          }
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                            selectedIndex === itemIndex ? 'bg-accent' : 'hover:bg-accent/50'
                          )}
                          role="option"
                          aria-selected={selectedIndex === itemIndex}
                        >
                          {/* Initials avatar */}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {getInitials(result.recordLabel)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">
                              <HighlightedText text={result.recordLabel} query={searchTerm} />
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {result.tableLabel || result.tableName}
                            </div>
                          </div>
                        </button>
                      )
                    })

                    return (
                      <div key={tableLabel}>
                        <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                          {tableLabel}
                        </div>
                        {groupItems}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Empty state */}
            {showEmpty && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No results found for &ldquo;{searchTerm}&rdquo;
              </div>
            )}
          </div>

          {/* Footer hint */}
          {searchTerm.trim() && (
            <div className="border-t border-border px-3 py-2">
              <button
                onClick={() =>
                  handleNavigate(`/app/search?q=${encodeURIComponent(searchTerm.trim())}`)
                }
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                Press Enter to search all records
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
