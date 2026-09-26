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
 * @file ColumnConfig — panel for toggling column visibility and reordering columns, including
 * the fields of exposed joins (grouped under "{Table} Fields", hidden by default).
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Eye, EyeOff, GripVertical, X } from 'lucide-react'

import type { QTableMetaData } from '@/types'
import { getQueryColumns, orderColumns, type QueryColumn } from '@/lib/utils/query-columns'
import { isColumnVisible } from '@/lib/utils/saved-view-utils'

/**
 * Props for the ColumnConfig component.
 */
interface ColumnConfigProps {
  /** Table metadata used to derive the column list. */
  tableMetaData: QTableMetaData
  /** Explicit visibility map (join columns default hidden). */
  columnVisibility: Record<string, boolean>
  /** Ordered list of column names. */
  columnOrder: string[]
  /** Called with the full new visibility map. */
  onVisibilityChange: (visibility: Record<string, boolean>) => void
  /** Called with the full new order. */
  onOrderChange: (order: string[]) => void
  /** Called when the panel is dismissed. */
  onClose: () => void
  /** Height limit in pixels (the room left in the viewport); the column list scrolls within it. */
  maxHeight?: number
}

/**
 * Column configuration panel: show/hide each column (base or join), show/hide all per group,
 * and reorder with drag-and-drop or arrow keys on the grip handle.
 *
 * @param props - Component properties.
 * @returns The rendered panel.
 */
export function ColumnConfig({ tableMetaData, columnVisibility, columnOrder, onVisibilityChange, onOrderChange, onClose, maxHeight }: ColumnConfigProps) {
  const allColumns = useMemo(() => getQueryColumns(tableMetaData), [tableMetaData])
  const [columns, setColumns] = useState<QueryColumn[]>(() => orderColumns(allColumns, columnOrder))
  const [lastAnnouncement, setLastAnnouncement] = useState<string>('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!lastAnnouncement) return
    const id = setTimeout(() => setLastAnnouncement(''), 3000)
    return () => clearTimeout(id)
  }, [lastAnnouncement])

  const groups = useMemo(() => [...new Set(columns.map((c) => c.group))], [columns])

  const toggleVisibility = (column: QueryColumn) => {
    const willBeVisible = !isColumnVisible(column.name, columnVisibility)
    setLastAnnouncement(`Column ${column.label} ${willBeVisible ? 'visible' : 'hidden'}`)
    onVisibilityChange({ ...columnVisibility, [column.name]: willBeVisible })
  }

  const setGroupVisibility = (group: string | null, visible: boolean) => {
    const next = { ...columnVisibility }
    for (const c of columns) if (group === null || c.group === group) next[c.name] = visible
    onVisibilityChange(next)
  }

  const reorder = (reordered: QueryColumn[]) => {
    setColumns(reordered)
    onOrderChange(reordered.map((c) => c.name))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= columns.length) return
    const reordered = [...columns]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    reorder(reordered)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) return
    const reordered = [...columns]
    const [moved] = reordered.splice(dragIndex, 1)
    if (moved) reordered.splice(dropIndex, 0, moved)
    reorder(reordered)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="flex w-80 max-w-[calc(100vw-16px)] flex-col rounded-xl border border-border bg-card shadow-sm" data-qqq-id="column-config" role="dialog" aria-label="Configure columns"
      style={maxHeight === undefined ? undefined : { maxHeight }}>
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold text-foreground">Configure Columns</h3>
        <button type="button" onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Close column configuration" data-qqq-id="column-config-close">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <button type="button" onClick={() => setGroupVisibility(groups.length > 1 ? groups[0] : null, true)}
          className="text-xs text-primary underline hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring" data-qqq-id="column-config-show-all">
          Show all
        </button>
        <span className="text-muted-foreground">|</span>
        <button type="button" onClick={() => setGroupVisibility(null, false)}
          className="text-xs text-primary underline hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring" data-qqq-id="column-config-hide-all">
          Hide all
        </button>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{lastAnnouncement}</div>

      <div className="max-h-96 min-h-0 overflow-y-auto" data-qqq-id="column-config-list">
        {groups.map((group) => (
          <div key={group} role="group" aria-label={group} data-qqq-id={`column-config-group-${group.replace(/\s+/g, '-').toLowerCase()}`}>
            {groups.length > 1 && (
              <div className="flex items-center justify-between bg-muted px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>{group}</span>
                <span className="flex gap-2 font-normal">
                  <button type="button" onClick={() => setGroupVisibility(group, true)} className="underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label={`Show all ${group}`}>all</button>
                  <button type="button" onClick={() => setGroupVisibility(group, false)} className="underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label={`Hide all ${group}`}>none</button>
                </span>
              </div>
            )}
            <div role="list" aria-label={groups.length === 1 ? 'Column visibility and order' : `${group} visibility and order`}>
              {columns.map((column, index) => {
                if (column.group !== group) return null
                const visible = isColumnVisible(column.name, columnVisibility)
                return (
                  <div
                    key={column.name}
                    role="listitem"
                    draggable
                    onDragStart={(e) => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move' }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(index) }}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
                    className={`flex items-center gap-2 px-4 py-2 transition-colors hover:bg-accent ${dragIndex === index ? 'bg-muted opacity-50' : ''} ${dragOverIndex === index && dragIndex !== index ? 'border-t-2 border-primary' : ''}`}
                    data-qqq-id={`column-config-item-${column.name}`}
                  >
                    <button type="button" className="cursor-grab text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      aria-label={`Drag to reorder ${column.label}`} title="Drag to reorder (or use arrow keys)"
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') { e.preventDefault(); move(index, -1) }
                        if (e.key === 'ArrowDown') { e.preventDefault(); move(index, 1) }
                      }}>
                      <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => toggleVisibility(column)}
                      className={`flex flex-1 items-center gap-2 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring ${visible ? 'text-foreground' : 'text-muted-foreground line-through'}`}
                      aria-pressed={visible} aria-label={`${visible ? 'Hide' : 'Show'} column ${column.label}`} data-qqq-id={`column-toggle-${column.name}`}>
                      {visible ? <Eye className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      <span className="truncate">{column.label}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
