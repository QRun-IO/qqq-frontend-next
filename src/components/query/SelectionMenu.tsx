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
 * @file SelectionMenu — Material's query-screen "Selection" menu: select this page, the full
 * query result, or the first N records of it, or clear the selection.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CheckSquare, ChevronDown, X } from 'lucide-react'

import type { SelectionMode } from '@/lib/hooks/use-record-query'

/**
 * Props for the SelectionMenu component.
 */
interface SelectionMenuProps {
  /** Rows on the current page. */
  pageRowCount: number
  /** Matching records (or distinct records with a many-side join); null when uncountable. */
  matchingCount: number | null
  /** Whether a many-side join is active ("distinct" wording). */
  distinct: boolean
  /** Selects every row on the current page. */
  onSelectPage: () => void
  /** Selects all records matching the query, or the first N. */
  onSelectMode: (mode: SelectionMode, subsetSize?: number) => void
  /** Clears the selection. */
  onClear: () => void
}

/**
 * Dropdown selection menu with a "first N records" dialog.
 *
 * @param props - Component properties.
 * @returns The menu.
 */
export function SelectionMenu({ pageRowCount, matchingCount, distinct, onSelectPage, onSelectMode, onClear }: SelectionMenuProps) {
  const [open, setOpen] = useState(false)
  const [subsetOpen, setSubsetOpen] = useState(false)
  const [subsetSize, setSubsetSize] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const word = distinct ? 'distinct records' : 'records'

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const subsetValue = Number(subsetSize)
  const subsetValid = Number.isInteger(subsetValue) && subsetValue >= 1
  const menuItem = 'flex w-full items-center px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent focus:bg-accent focus:outline-none'

  return (
    <div ref={containerRef} className="relative" data-qqq-id="selection-menu">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={matchingCount === 0 || pageRowCount === 0}
        className="flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        data-qqq-id="button-selection"
      >
        <CheckSquare className="h-4 w-4" aria-hidden="true" />
        Selection
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Selection" className="absolute left-0 z-20 mt-1 w-72 rounded-xl border border-border bg-popover py-1 shadow-sm">
          <button type="button" role="menuitem" className={menuItem} data-qqq-id="selection-page"
            onClick={() => { setOpen(false); onSelectPage() }}>
            This page ({pageRowCount.toLocaleString()} {word})
          </button>
          {matchingCount !== null && (
            <button type="button" role="menuitem" className={menuItem} data-qqq-id="selection-all"
              onClick={() => { setOpen(false); onSelectMode('all') }}>
              Full query result ({matchingCount.toLocaleString()} {word})
            </button>
          )}
          <button type="button" role="menuitem" className={menuItem} data-qqq-id="selection-subset"
            onClick={() => { setOpen(false); setSubsetSize(''); setSubsetOpen(true) }}>
            Subset of the query result...
          </button>
          <button type="button" role="menuitem" className={menuItem} data-qqq-id="selection-clear"
            onClick={() => { setOpen(false); onClear() }}>
            Clear selection
          </button>
        </div>
      )}

      <DialogPrimitive.Root open={subsetOpen} onOpenChange={setSubsetOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content aria-describedby={undefined} data-qqq-id="dialog-selection-subset"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg focus:outline-none">
            <div className="mb-4 flex items-center justify-between">
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Subset of the Query Result</DialogPrimitive.Title>
              <DialogPrimitive.Close className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (subsetValid) { onSelectMode('subset', subsetValue); setSubsetOpen(false) } }}>
              <label htmlFor="selection-subset-size" className="mb-1 block text-sm text-foreground">How many records do you want to select?</label>
              <input id="selection-subset-size" type="number" min={1} step={1} value={subsetSize} autoFocus
                onChange={(e) => setSubsetSize(e.target.value)} aria-invalid={subsetSize !== '' && !subsetValid}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                data-qqq-id="input-selection-subset-size" />
              {subsetSize !== '' && !subsetValid && <p role="alert" className="mt-1 text-xs text-destructive">Enter a whole number of at least 1.</p>}
              <div className="mt-4 flex justify-end gap-2">
                <DialogPrimitive.Close className="rounded border border-input px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">Cancel</DialogPrimitive.Close>
                <button type="submit" disabled={!subsetValid} data-qqq-id="button-selection-subset-ok"
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring">OK</button>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}

/**
 * Material's selection banner text.
 *
 * @param mode - Selection mode.
 * @param count - Records covered.
 * @param pageRowCount - Rows on the page.
 * @param allPageRowsSelected - Whether every page row is checked (rows mode).
 * @param distinct - Whether a many-side join is active.
 * @returns The banner text.
 */
export function selectionBannerText(mode: SelectionMode, count: number, pageRowCount: number, allPageRowsSelected: boolean, distinct: boolean): string {
  const noun = `${distinct ? 'distinct ' : ''}record${count === 1 ? '' : 's'}`
  if (mode === 'all') return `All ${count.toLocaleString()} ${noun} matching this query ${count === 1 ? 'is' : 'are'} selected.`
  if (mode === 'subset') return `The first ${count.toLocaleString()} ${noun} matching this query ${count === 1 ? 'is' : 'are'} selected.`
  if (allPageRowsSelected && pageRowCount > 0) return `The ${count.toLocaleString()} ${noun} on this page ${count === 1 ? 'is' : 'are'} selected.`
  return `${count.toLocaleString()} ${noun} ${count === 1 ? 'is' : 'are'} selected.`
}
