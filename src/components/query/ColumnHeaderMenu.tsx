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
 * @file ColumnHeaderMenu — Material's column menu on each query grid header: sort, filter, hide,
 * pin left or right, copy the column's values (this page or the full query result) and column
 * statistics. Columns that are not query criteria (some virtual fields) offer no sort or filter.
 */

'use client'

import React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { MoreVertical } from 'lucide-react'

import type { QFilterOrderBy } from '@/types'
import type { ColumnPin, QueryColumn } from '@/lib/utils/query-columns'
import { cn } from '@/lib/utils/cn'

/** What the column menu can do; absent actions are not offered. */
export interface ColumnMenuActions {
  /** Sorts by the column. */
  onSort: (columnName: string, isAscending: boolean) => void
  /** Adds a filter on the column and opens the filter. */
  onFilter?: (columnName: string) => void
  /** Hides the column. */
  onHide: (columnName: string) => void
  /** Pins the column to a side, or unpins it. */
  onPin: (columnName: string, side: ColumnPin | null) => void
  /** Copies the column's values on this page. */
  onCopyPageValues: (columnName: string) => void
  /** Copies the column's values for the full query result. */
  onCopyFullQueryValues: (columnName: string) => void
  /** Opens column statistics. */
  onColumnStats?: (columnName: string, columnLabel: string) => void
}

/** Props for {@link ColumnHeaderMenu}. */
interface ColumnHeaderMenuProps extends ColumnMenuActions {
  /** The column. */
  column: QueryColumn
  /** The column's sort, when the query is sorted by it. */
  sort?: QFilterOrderBy
  /** The side the column is pinned to. */
  pinned?: ColumnPin
  /** Whether the query has rows (copying needs some). */
  hasRows: boolean
}

const itemClass = cn(
  'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm text-foreground outline-none',
  'data-[highlighted]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'
)

/**
 * The column menu button and its menu.
 *
 * @param props - Component properties.
 * @returns The menu.
 */
export function ColumnHeaderMenu({ column, sort, pinned, hasRows, onSort, onFilter, onHide, onPin, onCopyPageValues, onCopyFullQueryValues, onColumnStats }: ColumnHeaderMenuProps) {
  const noRows = hasRows ? undefined : 'There are no rows to copy from'
  const id = (action: string) => `column-menu-${action}`
  return (
    <DropdownMenuPrimitive.Root modal={false}>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-60 hover:text-foreground hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring group-hover:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
          aria-label={`${column.label} column menu`}
          data-qqq-id={`grid-column-menu-${column.name}`}
        >
          <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-[160] max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[200px] overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg"
          aria-label={`${column.label} column menu`}
          data-qqq-id={`column-menu-${column.name}`}
        >
          {column.isQueryCriteria && (
            <>
              <DropdownMenuPrimitive.Item className={itemClass} disabled={sort?.isAscending === true} onSelect={() => onSort(column.name, true)} data-qqq-id={id('sort-asc')}>
                Sort ascending
              </DropdownMenuPrimitive.Item>
              <DropdownMenuPrimitive.Item className={itemClass} disabled={sort?.isAscending === false} onSelect={() => onSort(column.name, false)} data-qqq-id={id('sort-desc')}>
                Sort descending
              </DropdownMenuPrimitive.Item>
              {onFilter && (
                <DropdownMenuPrimitive.Item className={itemClass} onSelect={() => onFilter(column.name)} data-qqq-id={id('filter')}>
                  Filter
                </DropdownMenuPrimitive.Item>
              )}
            </>
          )}
          <DropdownMenuPrimitive.Item className={itemClass} onSelect={() => onHide(column.name)} data-qqq-id={id('hide')}>
            Hide column
          </DropdownMenuPrimitive.Item>
          <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
          {pinned !== 'left' && (
            <DropdownMenuPrimitive.Item className={itemClass} onSelect={() => onPin(column.name, 'left')} data-qqq-id={id('pin-left')}>
              Pin to left
            </DropdownMenuPrimitive.Item>
          )}
          {pinned !== 'right' && (
            <DropdownMenuPrimitive.Item className={itemClass} onSelect={() => onPin(column.name, 'right')} data-qqq-id={id('pin-right')}>
              Pin to right
            </DropdownMenuPrimitive.Item>
          )}
          {pinned && (
            <DropdownMenuPrimitive.Item className={itemClass} onSelect={() => onPin(column.name, null)} data-qqq-id={id('unpin')}>
              Unpin
            </DropdownMenuPrimitive.Item>
          )}
          <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
          <DropdownMenuPrimitive.Item className={itemClass} disabled={!hasRows} title={noRows} onSelect={() => onCopyPageValues(column.name)} data-qqq-id={id('copy-page')}>
            Copy page values
          </DropdownMenuPrimitive.Item>
          <DropdownMenuPrimitive.Item className={itemClass} disabled={!hasRows} title={noRows} onSelect={() => onCopyFullQueryValues(column.name)} data-qqq-id={id('copy-full')}>
            Copy full query values
          </DropdownMenuPrimitive.Item>
          {onColumnStats && (
            <DropdownMenuPrimitive.Item className={itemClass} onSelect={() => onColumnStats(column.name, column.label)} data-qqq-id={id('stats')}>
              Column statistics
            </DropdownMenuPrimitive.Item>
          )}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
