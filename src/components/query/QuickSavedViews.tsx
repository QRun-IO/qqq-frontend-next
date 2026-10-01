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
 * @file QuickSavedViews — Material's row of quick saved view buttons above the query grid: the
 * saved views the backend marks `type: quickView` (from its quickSavedView table), in their sort
 * order, each showing its record count when it asks for one (`doCount`). The active view's button
 * is filled when clean and tinted when it has unsaved changes.
 */

'use client'

import React from 'react'
import { useQueries } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'

import type { QFieldMetaData, QTableMetaData } from '@/types'
import { countRecords, type TableVariant } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { normalizeFilter, prepFilterForBackend, resolveField } from '@/lib/utils/filter-utils'
import type { SavedView } from '@/lib/utils/saved-view-utils'
import { cn } from '@/lib/utils/cn'

/** Props for {@link QuickSavedViews}. */
export interface QuickSavedViewsProps {
  /** The query table. */
  tableMetaData: QTableMetaData
  /** The quick views, in order. */
  quickViews: SavedView[]
  /** The saved view the screen shows, if any. */
  currentView: SavedView | null
  /** Whether the screen differs from the current view. */
  isModified: boolean
  /** Selected backend variant (counts use it). */
  tableVariant?: TableVariant | null
  /** Whether counts may be requested (the table can count and needs no variant, or has one). */
  canCount: boolean
  /** Opens a quick view. */
  onSelect: (view: SavedView) => void
}

/**
 * The quick views row, or nothing when the table has no quick views.
 *
 * @param props - Component properties.
 * @returns The row.
 */
export function QuickSavedViews({ tableMetaData, quickViews, currentView, isModified, tableVariant, canCount, onSelect }: QuickSavedViewsProps) {
  const variantKey = tableVariant ? `${tableVariant.type}:${tableVariant.id}` : null
  const counted = quickViews.filter((view) => view.doCount)
  const counts = useQueries({
    queries: counted.map((view) => ({
      queryKey: [...queryKeys.tableRecords(tableMetaData.name), 'quickViewCount', view.id, JSON.stringify(view.view.queryFilter ?? {}), variantKey],
      queryFn: () => {
        const fieldFor = (name: string): QFieldMetaData | undefined => resolveField(tableMetaData, name)?.field
        const filter = { ...prepFilterForBackend(normalizeFilter(view.view.queryFilter ?? {}, 0), fieldFor), skip: 0, limit: 0, orderBys: [] }
        return countRecords(tableMetaData.name, { filter, ...(tableVariant ? { tableVariant } : {}) })
      },
      enabled: canCount,
      staleTime: 0,
      retry: false,
    })),
  })
  if (quickViews.length === 0) return null
  const countFor = new Map(counted.map((view, index) => [view.id, counts[index]]))

  return (
    <div className="flex flex-wrap items-center gap-2" data-qqq-id="quick-views-container" role="group" aria-label="Quick views">
      {quickViews.map((view) => {
        const state = currentView?.id === view.id ? (isModified ? 'dirty' : 'clean') : 'empty'
        const count = countFor.get(view.id)
        return (
          <button
            key={view.id}
            type="button"
            data-button-state={state}
            aria-pressed={state !== 'empty'}
            onClick={(e) => { e.currentTarget.blur(); onSelect(view) }}
            className={cn(
              'inline-flex items-center gap-1 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
              state === 'clean' && 'border-primary bg-primary text-primary-foreground',
              state === 'dirty' && 'border-primary/20 bg-primary/15 text-primary',
              state === 'empty' && 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            data-qqq-id={`quick-view-${view.id}`}
          >
            {view.label}
            {view.doCount && (
              count?.isError
                ? <AlertCircle className="h-4 w-4" aria-label="Error loading count" data-qqq-id={`quick-view-count-error-${view.id}`} />
                : <span data-qqq-id={`quick-view-count-${view.id}`}>({typeof count?.data?.count === 'number' ? count.data.count.toLocaleString() : '...'})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
