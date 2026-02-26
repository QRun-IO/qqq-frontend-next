'use client'

// WidgetGrid — Responsive CSS grid layout for dashboard widgets
// Respects widget width/span metadata; stacks to 1 column on mobile

import React from 'react'
import { cn } from '@/lib/utils/cn'

export type WidgetSpan = 1 | 2 | 3 | 'full'

export interface WidgetGridItem {
  key: string
  span?: WidgetSpan
  children: React.ReactNode
}

interface WidgetGridProps {
  items: WidgetGridItem[]
  /** Max columns in the grid (default: 3) */
  columns?: 2 | 3 | 4
  className?: string
}

const SPAN_CLASSES: Record<WidgetSpan, string> = {
  1: 'col-span-1',
  2: 'col-span-1 md:col-span-2',
  3: 'col-span-1 md:col-span-3',
  full: 'col-span-1 md:col-span-full',
}

const GRID_COLS_CLASS: Record<number, string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
}

export function WidgetGrid({ items, columns = 3, className }: WidgetGridProps) {
  const gridClass = GRID_COLS_CLASS[columns] ?? GRID_COLS_CLASS[3]

  return (
    <div
      className={cn('grid gap-5', gridClass, className)}
      data-qqq-id="widget-grid"
    >
      {items.map(({ key, span = 1, children }) => (
        <div
          key={key}
          className={cn(SPAN_CLASSES[span])}
          data-qqq-id={`widget-grid-item-${key}`}
        >
          {children}
        </div>
      ))}
    </div>
  )
}
