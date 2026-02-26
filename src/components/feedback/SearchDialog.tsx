'use client'

// SearchDialog — "/" key command palette for searching records
// Shows recent records when idle, live API search results when typing
// Enter on a result navigates to record; Enter with no selection goes to full search page

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, Clock, ArrowRight, X } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import { globalSearch } from '@/lib/api/tables'
import type { GlobalSearchResult } from '@/lib/api/tables'
import { getRecentRecords } from '@/lib/utils/recent-records'
import type { RecentRecord } from '@/lib/utils/recent-records'
import { queryKeys } from '@/lib/query-client'

interface SearchDialogProps {
  open: boolean
  onClose: () => void
}

function getInitials(label: string): string {
  const words = label.trim().split(/\s+/)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])

  // Debounced search term for API calls
  const [debouncedTerm, setDebouncedTerm] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // TanStack Query for search results
  const { data: searchResults = [], isLoading: isSearching } = useQuery<GlobalSearchResult[]>({
    queryKey: queryKeys.globalSearch(debouncedTerm),
    queryFn: () => globalSearch(debouncedTerm),
    enabled: open && debouncedTerm.length >= 2,
    staleTime: 1000 * 30,
  })

  // Load recent records when dialog opens; clear state when closed
  useEffect(() => {
    if (open) {
      setRecentRecords(getRecentRecords().slice(0, 10))
      setSearchTerm('')
      setDebouncedTerm('')
      setSelectedIndex(-1)
      // Focus after animation frame
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchResults, recentRecords, searchTerm])

  // Build navigable items
  const navigableItems: Array<{ path: string; label: string; tableLabel?: string }> = []
  if (searchTerm.length >= 2 && searchResults.length > 0) {
    for (const result of searchResults) {
      navigableItems.push({
        path: `/app/${encodeURIComponent(result.tableName)}/${encodeURIComponent(result.recordId)}`,
        label: result.recordLabel,
        tableLabel: result.tableLabel || result.tableName,
      })
    }
  } else if (searchTerm.length < 2 && recentRecords.length > 0) {
    for (const record of recentRecords) {
      navigableItems.push({
        path: record.path,
        label: record.recordLabel,
        tableLabel: record.tableLabel,
      })
    }
  }

  const handleNavigate = useCallback(
    (path: string) => {
      onClose()
      router.push(path)
    },
    [router, onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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
            handleNavigate(`/app/search?q=${encodeURIComponent(searchTerm.trim())}`)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [selectedIndex, navigableItems, searchTerm, handleNavigate, onClose]
  )

  // Group search results by table
  const groupedResults: Record<string, GlobalSearchResult[]> = {}
  if (searchTerm.length >= 2) {
    for (const result of searchResults) {
      const key = result.tableLabel || result.tableName
      if (!groupedResults[key]) groupedResults[key] = []
      groupedResults[key].push(result)
    }
  }

  let runningIndex = 0
  const showRecent = searchTerm.length < 2 && recentRecords.length > 0
  const showResults = searchTerm.length >= 2
  const showEmpty = searchTerm.length >= 2 && !isSearching && searchResults.length === 0

  if (!open) return null

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
        aria-label="Search records"
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
            placeholder="Search records..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
            aria-label="Search records"
            aria-expanded={true}
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
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto" role="listbox" aria-label="Search results">
          {/* Recent records */}
          {showRecent && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Recently Viewed
              </div>
              {recentRecords.map((record, index) => (
                <button
                  key={record.path}
                  onClick={() => handleNavigate(record.path)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    selectedIndex === index ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                  role="option"
                  aria-selected={selectedIndex === index}
                >
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

          {/* Searching spinner */}
          {showResults && isSearching && (
            <div className="flex items-center justify-center px-4 py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          )}

          {/* Grouped search results */}
          {showResults && !isSearching && !showEmpty && (
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
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      selectedIndex === itemIndex ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                    role="option"
                    aria-selected={selectedIndex === itemIndex}
                  >
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
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
                    {tableLabel}
                  </div>
                  {groupItems}
                </div>
              )
            })
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{searchTerm}&rdquo;
            </div>
          )}

          {/* No recent records and no search */}
          {!showRecent && !showResults && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Start typing to search records...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex gap-4">
              <span>
                <kbd className="rounded border border-border px-1 py-0.5 font-mono">↑↓</kbd>{' '}navigate
              </span>
              <span>
                <kbd className="rounded border border-border px-1 py-0.5 font-mono">↵</kbd>{' '}
                {searchTerm.trim() ? 'open' : 'select'}
              </span>
            </div>
            {searchTerm.trim() && (
              <button
                onClick={() => handleNavigate(`/app/search?q=${encodeURIComponent(searchTerm.trim())}`)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent hover:text-foreground transition-colors"
              >
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                View all results
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
