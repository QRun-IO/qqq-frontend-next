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
 * @file ColumnConfig — the query screen's columns panel (Material's "Columns" field list): search
 * the fields, show or hide each column (base, virtual or join), switch a whole table's fields on
 * or off with its count of shown columns, collapse a table, and reorder with drag-and-drop or the
 * arrow keys on the grip handle. Join fields are grouped under "{Table} Fields", hidden by default.
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Pin, Search, X } from 'lucide-react'

import type { QTableMetaData } from '@/types'
import { arrangePinnedColumns, effectivePins, getQueryColumns, orderColumns, type ColumnPins, type QueryColumn } from '@/lib/utils/query-columns'
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
  /** Pinned columns (pinned columns stay at their side of the list, as in the grid). */
  columnPins?: ColumnPins | null
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
 * Whether a column matches the search text the way Material's field list matches: the field
 * label (without a "Table: " prefix) starts with the text or has a word starting with it, or the
 * table part of the label has such a word.
 *
 * @param column - The column.
 * @param search - The search text.
 * @returns True when the column is shown for the search.
 */
export function columnMatchesSearch(column: Pick<QueryColumn, 'label'>, search: string): boolean {
  const text = search.trim().toLowerCase()
  if (!text) return true
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const wordStart = new RegExp(`\\b${escaped}`)
  const fieldPart = column.label.replace(/.*: /, '').toLowerCase()
  if (fieldPart.startsWith(text) || wordStart.test(fieldPart)) return true
  const tablePart = column.label.includes(': ') ? column.label.replace(/:.*/, '').toLowerCase() : ''
  return Boolean(tablePart) && wordStart.test(tablePart)
}

/**
 * Column configuration panel.
 *
 * @param props - Component properties.
 * @returns The rendered panel.
 */
export function ColumnConfig({ tableMetaData, columnVisibility, columnOrder, columnPins = null, onVisibilityChange, onOrderChange, onClose, maxHeight }: ColumnConfigProps) {
  const allColumns = useMemo(() => getQueryColumns(tableMetaData), [tableMetaData])
  const arrange = (list: QueryColumn[]) => arrangePinnedColumns(list, effectivePins(list.map((c) => c.name), columnPins, tableMetaData.primaryKeyField))
  const [columns, setColumns] = useState<QueryColumn[]>(() => arrange(orderColumns(allColumns, columnOrder)))
  const [lastAnnouncement, setLastAnnouncement] = useState<string>('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const pins = effectivePins(columns.map((c) => c.name), columnPins, tableMetaData.primaryKeyField)
  const searching = search.trim() !== ''

  useEffect(() => {
    if (!lastAnnouncement) return
    const id = setTimeout(() => setLastAnnouncement(''), 3000)
    return () => clearTimeout(id)
  }, [lastAnnouncement])

  const groups = useMemo(() => [...new Set(columns.map((c) => c.group))], [columns])
  const matching = (column: QueryColumn) => columnMatchesSearch(column, search)

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

  /**
   * Material's table switch: turn matching fields on or off.
   *
   * @param group - The table field group.
   * @param on - Whether matching fields should be visible.
   */
  const toggleGroup = (group: string, on: boolean) => {
    const next = { ...columnVisibility }
    for (const c of columns) if (c.group === group && matching(c)) next[c.name] = on
    setLastAnnouncement(`${group} ${on ? 'shown' : 'hidden'}`)
    onVisibilityChange(next)
  }

  const reorder = (reordered: QueryColumn[]) => {
    // pinned columns keep their side, as the grid shows them
    const arranged = columnPins ? arrangePinnedColumns(reordered, columnPins) : reordered
    setColumns(arranged)
    onOrderChange(arranged.map((c) => c.name))
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

      <div className="relative shrink-0 border-b border-border px-4 py-2">
        <label htmlFor="column-config-search" className="sr-only">Search Fields</label>
        <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id="column-config-search"
          type="search"
          value={search}
          autoComplete="off"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Fields"
          className="w-full rounded border border-input bg-background py-1.5 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          data-qqq-id="column-config-search"
        />
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
        {groups.map((group) => {
          const inGroup = columns.filter((c) => c.group === group)
          const shownInGroup = inGroup.filter(matching)
          if (searching && shownInGroup.length === 0) return null
          const visibleCount = inGroup.filter((c) => isColumnVisible(c.name, columnVisibility)).length
          const allOn = shownInGroup.length > 0 && shownInGroup.every((c) => isColumnVisible(c.name, columnVisibility))
          const isCollapsed = Boolean(collapsed[group])
          const groupId = group.replace(/\s+/g, '-').toLowerCase()
          return (
            <div key={group} role="group" aria-label={group} data-qqq-id={`column-config-group-${groupId}`}>
              <div className="flex items-center gap-2 bg-muted px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [group]: !isCollapsed }))}
                  className="rounded p-0.5 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group}`} data-qqq-id={`column-config-collapse-${groupId}`}>
                  {isCollapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                </button>
                <button type="button" role="switch" aria-checked={allOn} onClick={() => toggleGroup(group, !allOn)}
                  className="flex flex-1 items-center gap-2 text-left focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-label={`${group} (${visibleCount} shown)`} data-qqq-id={`column-config-switch-${groupId}`}>
                  <span aria-hidden="true" className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${allOn ? 'bg-primary' : 'bg-input'}`}>
                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-background shadow transition-transform ${allOn ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </span>
                  <span className="text-foreground">{group}</span>
                  <span className="font-normal" data-qqq-id={`column-config-count-${groupId}`}>({visibleCount})</span>
                </button>
                {groups.length > 1 && (
                  <span className="flex gap-2 font-normal">
                    <button type="button" onClick={() => setGroupVisibility(group, true)} className="underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      aria-label={`Show all ${group}`}>all</button>
                    <button type="button" onClick={() => setGroupVisibility(group, false)} className="underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      aria-label={`Hide all ${group}`}>none</button>
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <div role="list" aria-label={groups.length === 1 ? 'Column visibility and order' : `${group} visibility and order`}>
                  {columns.map((column, index) => {
                    if (column.group !== group || !matching(column)) return null
                    const visible = isColumnVisible(column.name, columnVisibility)
                    const pinned = pins[column.name]
                    return (
                      <div
                        key={column.name}
                        role="listitem"
                        draggable={!searching}
                        onDragStart={(e) => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move' }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(index) }}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
                        className={`flex items-center gap-2 px-4 py-2 transition-colors hover:bg-accent ${dragIndex === index ? 'bg-muted opacity-50' : ''} ${dragOverIndex === index && dragIndex !== index ? 'border-t-2 border-primary' : ''}`}
                        data-qqq-id={`column-config-item-${column.name}`}
                      >
                        {!searching && (
                          <button type="button" className="cursor-grab text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            aria-label={`Drag to reorder ${column.label}`} title="Drag to reorder (or use arrow keys)"
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp') { e.preventDefault(); move(index, -1) }
                              if (e.key === 'ArrowDown') { e.preventDefault(); move(index, 1) }
                            }}>
                            <GripVertical className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        <button type="button" onClick={() => toggleVisibility(column)}
                          className={`flex flex-1 items-center gap-2 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring ${visible ? 'text-foreground' : 'text-muted-foreground line-through'}`}
                          aria-pressed={visible} aria-label={`${visible ? 'Hide' : 'Show'} column ${column.label}`} data-qqq-id={`column-toggle-${column.name}`}>
                          {visible ? <Eye className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                          <span className="truncate">{column.label}</span>
                        </button>
                        {pinned && (
                          <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" role="img" aria-label={`Pinned ${pinned}`} data-qqq-id={`column-config-pinned-${column.name}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {searching && groups.every((group) => !columns.some((c) => c.group === group && matching(c))) && (
          <p className="px-4 py-3 text-sm text-muted-foreground" data-qqq-id="column-config-no-match">No fields match your search.</p>
        )}
      </div>
    </div>
  )
}
