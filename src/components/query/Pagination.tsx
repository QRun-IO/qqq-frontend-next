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
 * @file Pagination — page navigation controls and page-size selector for the DataGrid. Includes first/prev/next/last buttons and a numeric "Go to page" input for large datasets.
 */

'use client'

// Pagination — page navigation + page size selector

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

import { PAGE_SIZE_OPTIONS, type PageSize } from '@/lib/hooks/use-record-query'

/**
 * Props for the Pagination component.
 */
interface PaginationProps {
  /** Current 1-based page number. */
  pageNum: number
  /** Number of records displayed per page (constrained to the PageSize union type). */
  pageSize: PageSize
  /** Total number of records matching the active filter (across all pages). */
  totalCount: number
  /** Total number of pages, derived from totalCount / pageSize. */
  totalPages: number
  /** Whether a background fetch is in progress; navigation buttons are disabled when true. */
  isFetching: boolean
  /** Callback invoked when the user navigates to a different page. */
  onPageChange: (page: number) => void
  /** Callback invoked when the user changes the rows-per-page setting. */
  onPageSizeChange: (pageSize: PageSize) => void
}

/**
 * Pagination controls rendered below the DataGrid.
 *
 * Displays a record-count summary ("Showing X–Y of Z"), a rows-per-page selector,
 * and first/previous/next/last navigation buttons. A "Go to page" text input is
 * shown when the total page count exceeds 5.
 *
 * All navigation buttons are disabled while a background fetch is in progress.
 *
 * @param props - Component properties.
 * @returns The rendered pagination controls.
 */
export function Pagination({
  pageNum,
  pageSize,
  totalCount,
  totalPages,
  isFetching,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const [goToPage, setGoToPage] = useState('')

  const startRecord = totalCount === 0 ? 0 : (pageNum - 1) * pageSize + 1
  const endRecord = Math.min(pageNum * pageSize, totalCount)

  /**
   * Parses the "Go to page" input value and navigates if it is a valid page number.
   * Resets the input after a successful navigation.
   */
  const handleGoToPage = () => {
    const p = parseInt(goToPage, 10)
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p)
      setGoToPage('')
    }
  }

  /**
   * Submits the "Go to page" input when the user presses Enter.
   *
   * @param e - The keyboard event from the go-to-page input.
   */
  const handleGoToPageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGoToPage()
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-3"
      data-qqq-id="pagination"
    >
      {/* Left: record count summary */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span aria-live="polite" aria-atomic="true">
          {totalCount === 0 ? (
            'No records'
          ) : (
            <>
              Showing{' '}
              <span className="font-medium text-foreground">
                {startRecord}–{endRecord}
              </span>{' '}
              of{' '}
              <span className="font-medium text-foreground">
                {totalCount.toLocaleString()}
              </span>
            </>
          )}
        </span>

        {/* Page size selector */}
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Rows per page"
            data-qqq-id="pagination-page-size"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Right: navigation controls */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={pageNum <= 1 || isFetching}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-input bg-background text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="First page"
          data-qqq-id="pagination-first"
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Previous page */}
        <button
          type="button"
          onClick={() => onPageChange(pageNum - 1)}
          disabled={pageNum <= 1 || isFetching}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-input bg-background text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
          data-qqq-id="pagination-prev"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Page indicator */}
        <span className="px-3 text-sm text-foreground" aria-current="page">
          {pageNum} / {totalPages}
        </span>

        {/* Next page */}
        <button
          type="button"
          onClick={() => onPageChange(pageNum + 1)}
          disabled={pageNum >= totalPages || isFetching}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-input bg-background text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
          data-qqq-id="pagination-next"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Last page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={pageNum >= totalPages || isFetching}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-input bg-background text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Last page"
          data-qqq-id="pagination-last"
        >
          <ChevronsRight className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Go to page input */}
        {totalPages > 5 && (
          <div className="ml-2 flex items-center gap-1.5">
            <label htmlFor="goto-page" className="text-sm text-muted-foreground">
              Go to:
            </label>
            <input
              id="goto-page"
              type="number"
              min={1}
              max={totalPages}
              value={goToPage}
              onChange={(e) => setGoToPage(e.target.value)}
              onKeyDown={handleGoToPageKeyDown}
              onBlur={handleGoToPage}
              className="w-16 rounded border border-input bg-background px-2 py-1 text-center text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Go to page number"
              data-qqq-id="pagination-goto"
            />
          </div>
        )}
      </div>
    </div>
  )
}
