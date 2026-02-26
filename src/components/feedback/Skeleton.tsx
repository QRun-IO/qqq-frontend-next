'use client'

// Skeleton — Reusable skeleton loader variants
// Usage:
//   <Skeleton.Text lines={3} />
//   <Skeleton.Card />
//   <Skeleton.Table rows={5} cols={4} />

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface SkeletonBaseProps {
  className?: string
}

// Single animated bar
function Bar({ className }: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-gray-200 dark:bg-gray-700',
        className
      )}
      aria-hidden="true"
    />
  )
}

// Text lines placeholder
interface TextProps {
  lines?: number
  className?: string
}

function Text({ lines = 3, className }: TextProps) {
  const widths = ['w-full', 'w-4/5', 'w-3/5', 'w-full', 'w-2/3', 'w-1/2']
  return (
    <div
      className={cn('space-y-2', className)}
      role="status"
      aria-label="Loading text"
      aria-busy="true"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} className={cn('h-4', widths[i % widths.length])} />
      ))}
    </div>
  )
}

// Card placeholder
interface CardProps {
  className?: string
}

function Card({ className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900',
        className
      )}
      role="status"
      aria-label="Loading card"
      aria-busy="true"
    >
      <div className="animate-pulse space-y-4">
        {/* Header line */}
        <div className="flex items-center gap-3">
          <Bar className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bar className="h-4 w-1/3" />
            <Bar className="h-3 w-1/4" />
          </div>
        </div>
        {/* Body lines */}
        <div className="space-y-2">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-5/6" />
          <Bar className="h-20 w-full rounded" />
          <Bar className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}

// Table rows placeholder
interface TableProps {
  rows?: number
  cols?: number
  className?: string
}

function Table({ rows = 5, cols = 4, className }: TableProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700', className)}
      role="status"
      aria-label="Loading table"
      aria-busy="true"
    >
      {/* Header row */}
      <div className="flex animate-pulse gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Bar key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex animate-pulse gap-4 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-gray-800"
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Bar
              key={col}
              className={cn('h-4 flex-1', col === 0 ? 'w-1/4' : 'w-auto')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// Namespace export — Skeleton.Text, Skeleton.Card, Skeleton.Table
export const Skeleton = { Text, Card, Table }
