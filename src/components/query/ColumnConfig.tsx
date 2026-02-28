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

/** ColumnConfig — floating panel for toggling column visibility and reordering columns via drag-and-drop or keyboard arrow keys. */
'use client'

// ColumnConfig — show/hide/reorder columns panel

import React, { useState } from 'react'
import { Eye, EyeOff, GripVertical, X } from 'lucide-react'

import type { QTableMetaData } from '@/types'

/**
 * Props for the ColumnConfig component.
 */
interface ColumnConfigProps {
  /** Full table metadata providing the complete field list. */
  tableMetaData: QTableMetaData
  /** Map of field name → visibility; `false` means the column is currently hidden. */
  columnVisibility: Record<string, boolean>
  /** Ordered list of field names determining the left-to-right column display order. */
  columnOrder: string[]
  /** Callback invoked when the user toggles a column's visibility or uses Show/Hide all. */
  onVisibilityChange: (visibility: Record<string, boolean>) => void
  /** Callback invoked when the user reorders columns via drag-and-drop or keyboard arrows. */
  onOrderChange: (order: string[]) => void
  /** Callback invoked when the user closes the panel via the X button. */
  onClose: () => void
}

/**
 * Floating panel that lets users show/hide columns and reorder them for the DataGrid.
 *
 * Columns are listed with drag-and-drop handles (HTML5 Drag API) and accessibility-
 * friendly Up/Down arrow key support on the grip button. "Show all" and "Hide all"
 * shortcuts are provided at the top of the panel.
 *
 * @param tableMetaData - Table metadata for building the full field list.
 * @param columnVisibility - Current per-column visibility state.
 * @param columnOrder - Current column order (field names in display order).
 * @param onVisibilityChange - Callback when visibility changes.
 * @param onOrderChange - Callback when column order changes.
 * @param onClose - Callback when the close button is clicked.
 */
export function ColumnConfig({
  tableMetaData,
  columnVisibility,
  columnOrder,
  onVisibilityChange,
  onOrderChange,
  onClose,
}: ColumnConfigProps) {
  // Build sorted field list
  const allFields = Object.values(tableMetaData.fields).filter((f) => !f.isHidden)

  const sortedFields = [...allFields].sort((a, b) => {
    const orderMap: Record<string, number> = {}
    columnOrder.forEach((name, idx) => {
      orderMap[name] = idx
    })
    const ia = orderMap[a.name] ?? 9999
    const ib = orderMap[b.name] ?? 9999
    return ia - ib
  })

  const [fields, setFields] = useState(sortedFields)

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  /**
   * Toggles the visibility of a single column and propagates the change to the parent.
   *
   * @param fieldName - The backend field name of the column to toggle.
   */
  const toggleVisibility = (fieldName: string) => {
    onVisibilityChange({
      ...columnVisibility,
      [fieldName]: columnVisibility[fieldName] !== false ? false : true,
    })
  }

  /**
   * Sets all columns to visible and notifies the parent.
   */
  const showAll = () => {
    const vis: Record<string, boolean> = {}
    allFields.forEach((f) => {
      vis[f.name] = true
    })
    onVisibilityChange(vis)
  }

  /**
   * Sets all columns to hidden and notifies the parent.
   */
  const hideAll = () => {
    const vis: Record<string, boolean> = {}
    allFields.forEach((f) => {
      vis[f.name] = false
    })
    onVisibilityChange(vis)
  }

  // Drag-and-drop reorder
  /**
   * Records the dragged row's index and sets the drag effect.
   *
   * @param e - The dragstart event.
   * @param index - The zero-based index of the row being dragged.
   */
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  /**
   * Tracks the row currently being dragged over so a drop target indicator can be rendered.
   *
   * @param e - The dragover event.
   * @param index - The zero-based index of the row under the pointer.
   */
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  /**
   * Completes the drag-and-drop reorder by splicing the dragged item into the drop position.
   *
   * @param e - The drop event.
   * @param dropIndex - The zero-based index of the drop target row.
   */
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) return

    const reordered = [...fields]
    const [moved] = reordered.splice(dragIndex, 1)
    if (moved) {
      reordered.splice(dropIndex, 0, moved)
    }

    setFields(reordered)
    onOrderChange(reordered.map((f) => f.name))
    setDragIndex(null)
    setDragOverIndex(null)
  }

  /**
   * Resets drag state after a drag operation completes (regardless of whether a drop occurred).
   */
  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // Move up/down buttons (accessible alternative to drag)
  /**
   * Moves the column at `index` one position up in the list (keyboard-accessible alternative to drag).
   * Does nothing if the column is already at the top.
   *
   * @param index - Zero-based index of the column to move up.
   */
  const moveUp = (index: number) => {
    if (index === 0) return
    const reordered = [...fields]
    const a = reordered[index - 1]
    const b = reordered[index]
    if (a && b) {
      reordered[index - 1] = b
      reordered[index] = a
    }
    setFields(reordered)
    onOrderChange(reordered.map((f) => f.name))
  }

  /**
   * Moves the column at `index` one position down in the list (keyboard-accessible alternative to drag).
   * Does nothing if the column is already at the bottom.
   *
   * @param index - Zero-based index of the column to move down.
   */
  const moveDown = (index: number) => {
    if (index === fields.length - 1) return
    const reordered = [...fields]
    const a = reordered[index]
    const b = reordered[index + 1]
    if (a && b) {
      reordered[index] = b
      reordered[index + 1] = a
    }
    setFields(reordered)
    onOrderChange(reordered.map((f) => f.name))
  }

  return (
    <div
      className="flex flex-col bg-card rounded-xl shadow-sm border border-border w-72"
      data-qqq-id="column-config"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold text-foreground">
          Configure Columns
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Close column configuration"
          data-qqq-id="column-config-close"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Show/hide all buttons */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={showAll}
          className="text-xs text-primary underline hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring"
          data-qqq-id="column-config-show-all"
        >
          Show all
        </button>
        <span className="text-muted-foreground">|</span>
        <button
          type="button"
          onClick={hideAll}
          className="text-xs text-primary underline hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring"
          data-qqq-id="column-config-hide-all"
        >
          Hide all
        </button>
      </div>

      {/* Column list */}
      <div
        className="max-h-80 overflow-y-auto"
        role="list"
        aria-label="Column visibility and order"
      >
        {fields.map((field, index) => {
          const isVisible = columnVisibility[field.name] !== false
          const isDragging = dragIndex === index
          const isDragOver = dragOverIndex === index && dragIndex !== index

          return (
            <div
              key={field.name}
              role="listitem"
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 px-4 py-2 transition-colors ${isDragging ? 'opacity-50 bg-muted' : ''} ${isDragOver ? 'border-t-2 border-primary' : ''} hover:bg-accent`}
              data-qqq-id={`column-config-item-${field.name}`}
            >
              {/* Drag handle */}
              <button
                type="button"
                className="cursor-grab text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={`Drag to reorder ${field.label}`}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') { e.preventDefault(); moveUp(index) }
                  if (e.key === 'ArrowDown') { e.preventDefault(); moveDown(index) }
                }}
                title="Drag to reorder (or use arrow keys)"
              >
                <GripVertical className="h-4 w-4" aria-hidden="true" />
              </button>

              {/* Toggle visibility */}
              <button
                type="button"
                onClick={() => toggleVisibility(field.name)}
                className={`flex flex-1 items-center gap-2 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring ${isVisible ? 'text-foreground' : 'text-muted-foreground line-through'}`}
                aria-pressed={isVisible}
                aria-label={`${isVisible ? 'Hide' : 'Show'} column ${field.label}`}
                data-qqq-id={`column-toggle-${field.name}`}
              >
                {isVisible ? (
                  <Eye className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="truncate">{field.label}</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
