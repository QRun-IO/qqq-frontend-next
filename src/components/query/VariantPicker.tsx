/** VariantPicker — modal dialog for selecting a table variant before viewing scoped data */
'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Search, X, Check, Loader2 } from 'lucide-react'

import { globalSearch } from '@/lib/api/tables'
import type { GlobalSearchResult } from '@/lib/api/tables'
import { cn } from '@/lib/utils/cn'
import { COMBOBOX_DEBOUNCE_MS } from '@/lib/constants'

/**
 * Props for the {@link VariantPicker} component.
 */
export interface VariantPickerProps {
  /** Whether the dialog is currently open. */
  open: boolean
  /** Callback invoked when the dialog is dismissed without making a selection. */
  onCancel: () => void
  /**
   * Callback invoked when the user confirms a variant selection.
   *
   * @param variantId - The primary key of the selected variant record.
   * @param variantLabel - The human-readable label of the selected variant record.
   */
  onSelect: (variantId: string | number, variantLabel: string) => void
  /** Human-readable label for the variant dimension (e.g. "Client"). */
  variantTableLabel: string
  /**
   * Backend table name used to scope the global search.
   * Falls back to searching across all tables when not provided.
   */
  variantTableName?: string
}

/**
 * A searchable modal dialog that lets the user pick a variant record before the query page
 * loads scoped data.
 *
 * Uses `globalSearch` to fetch matching variant options as the user types.  The dialog is
 * built on Radix `Dialog` which provides a full focus trap and Escape-key dismissal.
 *
 * @param props - See {@link VariantPickerProps}.
 */
export function VariantPicker({
  open,
  onCancel,
  onSelect,
  variantTableLabel,
  variantTableName,
}: VariantPickerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedResult, setSelectedResult] = useState<GlobalSearchResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  /** Runs a debounced globalSearch and updates the results list. */
  const runSearch = useCallback(
    (term: string) => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      if (!term.trim()) {
        setResults([])
        setIsSearching(false)
        return
      }
      setIsSearching(true)
      setSearchError(null)
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const tableNames = variantTableName ? [variantTableName] : []
          const data = await globalSearch(term, tableNames)
          setResults(data)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Search failed'
          setSearchError(message)
          setResults([])
        } finally {
          setIsSearching(false)
        }
      }, COMBOBOX_DEBOUNCE_MS)
    },
    [variantTableName]
  )

  /** Reset internal state when the dialog closes or re-opens. */
  useEffect(() => {
    if (open) {
      setSearchTerm('')
      setResults([])
      setSelectedResult(null)
      setSearchError(null)
      setIsSearching(false)
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [open])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    setSelectedResult(null)
    runSearch(value)
  }

  const handleConfirm = () => {
    if (!selectedResult) return
    onSelect(selectedResult.recordId, selectedResult.recordLabel)
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          data-qqq-id="variant-picker-dialog"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-border bg-card shadow-lg',
            'focus:outline-none'
          )}
          aria-describedby="variant-picker-description"
          onOpenAutoFocus={(e) => {
            // Focus the search input when the dialog opens
            e.preventDefault()
            searchInputRef.current?.focus()
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Select {variantTableLabel}
          </DialogPrimitive.Title>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Select {variantTableLabel}
            </h2>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Close dialog"
                className={cn(
                  'rounded-md p-1 text-muted-foreground hover:text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            <p id="variant-picker-description" className="text-sm text-muted-foreground">
              Search for a {variantTableLabel} to scope the data you want to view.
            </p>

            {/* Search input */}
            <div className="relative">
              <label htmlFor="variant-search" className="sr-only">
                Search {variantTableLabel}
              </label>
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                id="variant-search"
                type="search"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={`Search ${variantTableLabel}...`}
                className={cn(
                  'w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm',
                  'text-foreground placeholder:text-muted-foreground',
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'
                )}
                data-qqq-id="variant-search-input"
                aria-autocomplete="list"
                aria-controls="variant-results-list"
                aria-activedescendant={selectedResult ? `variant-result-${selectedResult.recordId}` : undefined}
              />
              {isSearching && (
                <Loader2
                  className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {!isSearching && searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('')
                    setResults([])
                    setSelectedResult(null)
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label="Clear search"
                  data-qqq-id="variant-search-clear"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Error message */}
            {searchError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {searchError}
              </div>
            )}

            {/* Results list */}
            <div
              id="variant-results-list"
              role="listbox"
              aria-label={`${variantTableLabel} search results`}
              className={cn(
                'max-h-60 overflow-y-auto rounded-md border border-border bg-background',
                results.length === 0 ? 'hidden' : ''
              )}
            >
              {results.map((result) => {
                const isSelected = selectedResult?.recordId === result.recordId
                return (
                  <button
                    key={`${result.tableName}-${result.recordId}`}
                    id={`variant-result-${result.recordId}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedResult(result)}
                    onDoubleClick={() => {
                      setSelectedResult(result)
                      onSelect(result.recordId, result.recordLabel)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                      'focus:outline-none focus:ring-1 focus:ring-ring',
                      isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-accent'
                    )}
                    data-qqq-id={`variant-result-${result.recordId}`}
                  >
                    <span className="flex-1 truncate">{result.recordLabel}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Empty state */}
            {!isSearching && searchTerm && results.length === 0 && !searchError && (
              <p className="py-2 text-center text-sm text-muted-foreground" role="status">
                No {variantTableLabel} records found for &ldquo;{searchTerm}&rdquo;
              </p>
            )}

            {/* Prompt to search */}
            {!searchTerm && !isSearching && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Type to search for a {variantTableLabel}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 rounded-b-lg border-t border-border bg-muted px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              data-qqq-id="variant-picker-cancel"
              className={cn(
                'inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium',
                'text-foreground bg-card hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'transition-colors duration-150'
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedResult}
              data-qqq-id="variant-picker-select"
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              Select
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
