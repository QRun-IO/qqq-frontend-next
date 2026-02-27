/**
 * WidgetGrid — Responsive CSS grid container for dashboard widget cards.
 *
 * Stacks to a single column on mobile, expanding to the configured column count
 * on medium and large breakpoints. Each item can span 1, 2, 3, or the full
 * grid width based on its WidgetSpan value.
 */
'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Number of grid columns a widget item occupies at the medium+ breakpoint.
 * 'full' spans all available columns regardless of the configured column count.
 */
export type WidgetSpan = 1 | 2 | 3 | 'full'

/** Descriptor for a single item placed inside a WidgetGrid. */
export interface WidgetGridItem {
  /** Stable React key and data-qqq-id suffix for this grid item. */
  key: string
  /** Number of grid columns this item spans at the medium+ breakpoint (default: 1). */
  span?: WidgetSpan
  /** The widget component to render inside this grid cell. */
  children: React.ReactNode
}

/** Props accepted by the WidgetGrid layout component. */
interface WidgetGridProps {
  /** Ordered list of widget items to place in the grid. */
  items: WidgetGridItem[]
  /** Max columns in the grid (default: 3) */
  columns?: 2 | 3 | 4
  /** Optional extra Tailwind classes applied to the grid container. */
  className?: string
}

/**
 * Static lookup table mapping WidgetSpan values to responsive Tailwind col-span classes.
 *
 * All spans collapse to col-span-1 on mobile and expand at the md breakpoint.
 */
const SPAN_CLASSES: Record<WidgetSpan, string> = {
  1: 'col-span-1',
  2: 'col-span-1 md:col-span-2',
  3: 'col-span-1 md:col-span-3',
  full: 'col-span-1 md:col-span-full',
}

/** Maps the `columns` prop value to the corresponding Tailwind responsive grid-cols class string. */
const GRID_COLS_CLASS: Record<number, string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
}

/**
 * Renders a responsive CSS grid that lays out dashboard widget cards.
 *
 * Each WidgetGridItem is placed in a grid cell whose column span is controlled
 * by the item's `span` property. The overall column count defaults to 3 and
 * can be overridden via the `columns` prop.
 *
 * @param items - Ordered list of widget items to place in the grid.
 * @param columns - Maximum column count at the medium breakpoint (default: 3).
 * @param className - Additional Tailwind classes applied to the grid container.
 */
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
