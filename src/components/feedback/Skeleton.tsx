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
 * @file Skeleton — collection of animated placeholder components used while content is loading.
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Base props shared by all Skeleton sub-components.
 */
interface SkeletonBaseProps {
  /** Additional Tailwind class names applied to the outermost element. */
  className?: string
}

/**
 * A single animated pulse bar used as a building block for skeleton variants.
 *
 * @param props - Component properties.
 * @returns An `aria-hidden` div with `animate-pulse rounded bg-muted` styling;
 *   width/height are controlled entirely by the `className` prop.
 */
function Bar({ className }: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-muted',
        className
      )}
      aria-hidden="true"
    />
  )
}

/**
 * Props for the Skeleton.Text sub-component.
 */
interface TextProps {
  /** Number of placeholder text lines to render. Defaults to `3`. */
  lines?: number
  /** Additional Tailwind class names applied to the container div. */
  className?: string
}

/**
 * Renders a stack of animated placeholder text lines at varying widths.
 *
 * Uses `role="status"` and `aria-busy="true"` for accessibility.
 *
 * @param props - Component properties.
 * @returns A stack of `Bar` elements mimicking a block of text.
 */
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

/**
 * Props for the Skeleton.Card sub-component.
 */
interface CardProps {
  /** Additional Tailwind class names applied to the card container. */
  className?: string
}

/**
 * Renders an animated placeholder that mimics a content card layout.
 *
 * Includes an avatar circle, two lines of meta text, body text bars, and a
 * tall image placeholder. Uses `role="status"` and `aria-busy="true"`.
 *
 * @param props - Component properties.
 * @returns A bordered rounded card filled with `Bar` placeholders.
 */
function Card({ className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5',
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

/**
 * Props for the Skeleton.Table sub-component.
 */
interface TableProps {
  /** Number of placeholder data rows to render. Defaults to `5`. */
  rows?: number
  /** Number of placeholder columns per row. Defaults to `4`. */
  cols?: number
  /** Additional Tailwind class names applied to the table container. */
  className?: string
}

/**
 * Renders an animated placeholder resembling a data table with a header row and data rows.
 *
 * Uses `role="status"` and `aria-busy="true"` for accessibility.
 *
 * @param props - Component properties.
 * @returns A bordered container with a header row and data rows of `Bar` cells.
 */
function Table({ rows = 5, cols = 4, className }: TableProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-border', className)}
      role="status"
      aria-label="Loading table"
      aria-busy="true"
    >
      {/* Header row */}
      <div className="flex animate-pulse gap-4 border-b border-border bg-muted px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Bar key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex animate-pulse gap-4 border-b border-border px-4 py-3 last:border-0"
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

/**
 * Namespace object exporting all skeleton variant components.
 *
 * @example
 * ```tsx
 * <Skeleton.Text lines={3} />
 * <Skeleton.Card className="my-4" />
 * <Skeleton.Table rows={8} cols={5} />
 * ```
 */
export const Skeleton = { Text, Card, Table }
