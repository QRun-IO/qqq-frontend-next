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
 * @file SearchDialog — "/" key (and mobile header) search dialog: search-as-you-type over
 * pages, recently viewed records and recent searches, plus records found by the backend
 * record search when the metadata advertises searchable tables.
 */

'use client'

import React, { useEffect, useCallback, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

import type { NavTarget } from '@/lib/hooks/use-routes'
import type { SearchableTable } from '@/lib/utils/record-search'
import { searchPagePath } from '@/lib/search/search-url'
import type { QuickSearchPanelController } from '@/components/search/QuickSearchPanel'

/** The results panel, loaded when the dialog first opens. */
const QuickSearchPanel = dynamic(() => import('@/components/search/QuickSearchPanel').then((module) => module.QuickSearchPanel), { ssr: false })

/** Stable empty default for `searchTables`. */
const NO_SEARCH_TABLES: SearchableTable[] = []

/** DOM id of the results listbox. */
const LISTBOX_ID = 'search-dialog-results'

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
 * Modal search dialog triggered by the `/` keyboard shortcut and the mobile header button.
 *
 * Lists recent searches and recently viewed records until the user types, then grouped
 * results (top hits, pages, records per table, recently viewed). ↑/↓ move the selection,
 * Enter opens it, Ctrl/⌘+Enter opens it in a new tab, Escape closes.
 *
 * @param props - Component properties.
 * @returns The dialog overlay, or `null` when closed.
 */
export function SearchDialog({ open, onClose, navTargets, searchTables = NO_SEARCH_TABLES }: SearchDialogProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const handleNavigate = useCallback((path: string) => {
    onClose()
    router.push(path)
  }, [router, onClose])

  const [term, setTerm] = useState('')
  const controllerRef = useRef<QuickSearchPanelController | null>(null)
  const [activeDescendant, setActiveDescendant] = useState<string>()
  const recordSearchAvailable = searchTables.length > 0

  const handleController = useCallback((controller: QuickSearchPanelController | null) => {
    controllerRef.current = controller
    setActiveDescendant(controller?.activeDescendant)
  }, [])

  /**
   * Defers ↑↓, Enter and Ctrl/⌘+Enter to the results panel (Enter searches everything while it loads).
   *
   * @param event - The input's keydown event.
   */
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (controllerRef.current) {
      controllerRef.current.onInputKeyDown(event)
    } else if (event.key === 'Enter' && term.trim()) {
      event.preventDefault()
      handleNavigate(searchPagePath({ q: term }))
    }
  }

  // Reset and focus on open; give focus back on close
  useEffect(() => {
    if (!open) return
    const returnTo = document.activeElement
    setTerm('')
    const frame = requestAnimationFrame(() => {
      if (!dialogRef.current?.contains(document.activeElement)) inputRef.current?.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus()
    }
  }, [open, setTerm])

  /**
   * Handles dismissal from every control and keeps keyboard focus inside the modal.
   *
   * @param event - The key pressed in the dialog.
   */
  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]'))
      .filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0)
    if (focusable.length === 0) return
    // Handle each step: WebKit's native Tab order can omit buttons and leave the modal.
    const current = focusable.indexOf(document.activeElement as HTMLElement)
    const next = current < 0 ? (event.shiftKey ? focusable.length - 1 : 0)
      : (current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length
    event.preventDefault()
    focusable[next].focus()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center px-2 pt-[6vh] sm:px-4 sm:pt-[12vh]" data-qqq-id="search-dialog-backdrop">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg sm:max-h-[76vh]"
        data-qqq-id="search-dialog"
        role="dialog"
        aria-label="Search"
        aria-modal="true"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={recordSearchAvailable ? 'Search pages and records…' : 'Jump to a page or recent record…'}
            className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-sm"
            aria-label={recordSearchAvailable ? 'Search pages and records' : 'Search pages and recent records'}
            aria-expanded={true}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={activeDescendant}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            data-qqq-id="search-dialog-input"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                inputRef.current?.focus()
                setTerm('')
              }}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
            aria-label="Close search"
          >
            esc
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <QuickSearchPanel
            listboxId={LISTBOX_ID}
            open={open}
            term={term}
            setTerm={setTerm}
            navTargets={navTargets}
            searchTables={searchTables}
            onNavigate={handleNavigate}
            onController={handleController}
            listClassName="min-h-0 flex-1"
          />
        </div>

        <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground sm:flex" aria-hidden="true">
          <span><kbd className="rounded border border-border px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border px-1 py-0.5 font-mono">↵</kbd> open</span>
          <span><kbd className="rounded border border-border px-1 py-0.5 font-mono">Ctrl/⌘ ↵</kbd> new tab</span>
        </div>
      </div>
    </div>
  )
}
