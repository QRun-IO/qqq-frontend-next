'use client'

// Pagination — page navigation + page size selector

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

import { PAGE_SIZE_OPTIONS, type PageSize } from '@/lib/hooks/use-record-query'

interface PaginationProps {
  pageNum: number
  pageSize: PageSize
  totalCount: number
  totalPages: number
  isFetching: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: PageSize) => void
}

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

  const handleGoToPage = () => {
    const p = parseInt(goToPage, 10)
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p)
      setGoToPage('')
    }
  }

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
