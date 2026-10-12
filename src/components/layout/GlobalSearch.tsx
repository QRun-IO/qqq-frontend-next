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
 * @file GlobalSearch — header search-as-you-type over apps, tables, processes, reports and
 * recently viewed records (matched locally), plus records found by the backend record
 * search when the metadata advertises searchable tables (without them no search request
 * is made). The input is part of every page; the results panel loads on first focus.
 */

'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

import type { NavTarget } from '@/lib/hooks/use-routes'
import { cn } from '@/lib/utils/cn'
import type { SearchableTable } from '@/lib/utils/record-search'
import { searchPagePath } from '@/lib/search/search-url'
import type { QuickSearchPanelController } from '@/components/search/QuickSearchPanel'

/** The results panel, loaded when the search first opens. */
const QuickSearchPanel = dynamic(() => import('@/components/search/QuickSearchPanel').then((module) => module.QuickSearchPanel), { ssr: false })

/** Stable empty default for `searchTables`. */
const NO_SEARCH_TABLES: SearchableTable[] = []

/** DOM id of the results listbox. */
const LISTBOX_ID = 'header-search-results'

/** Keyboard hints under the results. */
const FOOTER = (
  <div className="hidden items-center gap-4 border-t border-border px-3 py-1.5 text-[0.7rem] text-muted-foreground sm:flex" aria-hidden="true">
    <span><kbd className="rounded border border-border px-1 font-mono">↑↓</kbd> navigate</span>
    <span><kbd className="rounded border border-border px-1 font-mono">↵</kbd> open</span>
    <span><kbd className="rounded border border-border px-1 font-mono">Ctrl/⌘ ↵</kbd> new tab</span>
    <span><kbd className="rounded border border-border px-1 font-mono">esc</kbd> close</span>
  </div>
)

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
 * Inline header search with a dropdown of grouped results: top hits, pages, records per
 * table (with counts and "see all" links), recently viewed records and recent searches.
 *
 * Keyboard: ↓/↑ move the selection (the first result is selected while typing), Enter
 * opens it, Ctrl/⌘+Enter opens it in a new tab, Escape closes (and then clears).
 * "Search everything" (or Enter before results load) opens the search page.
 *
 * @param props - Component properties.
 * @returns A `<div>` containing the search combobox and, when open, its results.
 */
export function GlobalSearch({ navTargets, searchTables = NO_SEARCH_TABLES, className }: GlobalSearchProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  // mounted once opened, so the panel keeps its state (recents, cache) between openings
  const [panelMounted, setPanelMounted] = useState(false)
  const [term, setTerm] = useState('')
  const controllerRef = useRef<QuickSearchPanelController | null>(null)
  const [activeDescendant, setActiveDescendant] = useState<string>()
  const [hasContent, setHasContent] = useState(false)
  const recordSearchAvailable = searchTables.length > 0

  useEffect(() => {
    if (isOpen) setPanelMounted(true)
  }, [isOpen])

  const handleNavigate = useCallback((path: string) => {
    setIsOpen(false)
    inputRef.current?.blur()
    router.push(path)
  }, [router])

  const handleController = useCallback((controller: QuickSearchPanelController | null) => {
    controllerRef.current = controller
    setActiveDescendant(controller?.activeDescendant)
    setHasContent(controller?.hasContent ?? false)
  }, [])

  // Close on outside click
  useEffect(() => {
    /**
     * Closes the dropdown when the user clicks outside the search container.
     *
     * @param event - The native mousedown event from the document listener.
     */
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /**
   * Keyboard handling: opens the dropdown, closes it on Escape (a second Escape clears the
   * text), and otherwise defers to the results panel (↑↓, Enter, Ctrl/⌘+Enter).
   *
   * @param event - The input's keydown event.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (isOpen) setIsOpen(false)
      else if (term) setTerm('')
      else inputRef.current?.blur()
      return
    }
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setIsOpen(true)
      return
    }
    if (controllerRef.current && isOpen) {
      controllerRef.current.onInputKeyDown(event)
    } else if (event.key === 'Enter' && term.trim()) {
      // the panel is closed or still loading: Enter searches everything (never a hidden option)
      event.preventDefault()
      setTerm('')
      handleNavigate(searchPagePath({ q: term }))
    }
  }

  const showDropdown = isOpen && (term.trim().length > 0 || hasContent)

  return (
    <div ref={containerRef} className={cn('relative', className)} data-qqq-id="header-search">
      <div className="flex items-center gap-2 rounded-full border border-input bg-background px-4 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={recordSearchAvailable ? 'Search…' : 'Jump to…'}
          className="w-36 bg-transparent text-foreground outline-none placeholder:text-muted-foreground lg:w-48 2xl:w-64"
          aria-label={recordSearchAvailable ? 'Search pages and records' : 'Search pages and recent records'}
          aria-expanded={showDropdown}
          aria-controls={LISTBOX_ID}
          aria-activedescendant={showDropdown ? activeDescendant : undefined}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          data-qqq-id="input-header-search"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm('')
              inputRef.current?.focus()
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Clear search"
            data-qqq-id="button-header-search-clear"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {panelMounted && (
        <div
          hidden={!showDropdown}
          className="absolute right-0 top-full z-50 mt-2 w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          data-qqq-id="header-search-dropdown"
        >
          <QuickSearchPanel
            listboxId={LISTBOX_ID}
            open={isOpen}
            term={term}
            setTerm={setTerm}
            navTargets={navTargets}
            searchTables={searchTables}
            onNavigate={handleNavigate}
            onController={handleController}
            listClassName="max-h-[min(70vh,32rem)]"
            footer={FOOTER}
            hideWhenEmpty
          />
        </div>
      )}
    </div>
  )
}
