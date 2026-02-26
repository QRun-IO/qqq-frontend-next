'use client'

// ColumnConfig — show/hide/reorder columns panel

import React, { useState } from 'react'
import { Eye, EyeOff, GripVertical, X } from 'lucide-react'

import type { QTableMetaData } from '@/types'

interface ColumnConfigProps {
  tableMetaData: QTableMetaData
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  onVisibilityChange: (visibility: Record<string, boolean>) => void
  onOrderChange: (order: string[]) => void
  onClose: () => void
}

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

  const toggleVisibility = (fieldName: string) => {
    onVisibilityChange({
      ...columnVisibility,
      [fieldName]: columnVisibility[fieldName] !== false ? false : true,
    })
  }

  const showAll = () => {
    const vis: Record<string, boolean> = {}
    allFields.forEach((f) => {
      vis[f.name] = true
    })
    onVisibilityChange(vis)
  }

  const hideAll = () => {
    const vis: Record<string, boolean> = {}
    allFields.forEach((f) => {
      vis[f.name] = false
    })
    onVisibilityChange(vis)
  }

  // Drag-and-drop reorder
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

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

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // Move up/down buttons (accessible alternative to drag)
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
      className="flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-72"
      data-qqq-id="column-config"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Configure Columns
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label="Close column configuration"
          data-qqq-id="column-config-close"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Show/hide all buttons */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 dark:border-gray-700">
        <button
          type="button"
          onClick={showAll}
          className="text-xs text-blue-600 underline hover:text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-qqq-id="column-config-show-all"
        >
          Show all
        </button>
        <span className="text-gray-300">|</span>
        <button
          type="button"
          onClick={hideAll}
          className="text-xs text-blue-600 underline hover:text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className={`flex items-center gap-2 px-4 py-2 transition-colors ${isDragging ? 'opacity-50 bg-gray-100 dark:bg-gray-800' : ''} ${isDragOver ? 'border-t-2 border-blue-500' : ''} hover:bg-gray-50 dark:hover:bg-gray-800`}
              data-qqq-id={`column-config-item-${field.name}`}
            >
              {/* Drag handle */}
              <button
                type="button"
                className="cursor-grab text-gray-300 hover:text-gray-500 focus:outline-none"
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
                className={`flex flex-1 items-center gap-2 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${isVisible ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 line-through'}`}
                aria-pressed={isVisible}
                aria-label={`${isVisible ? 'Hide' : 'Show'} column ${field.label}`}
                data-qqq-id={`column-toggle-${field.name}`}
              >
                {isVisible ? (
                  <Eye className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
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
