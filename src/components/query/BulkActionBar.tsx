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
 * @file BulkActionBar — the selection banner shown while records are selected: Material's
 * selection text, a clear button, and shortcuts to the table's bulk processes.
 */

'use client'

import React from 'react'
import { X } from 'lucide-react'

/** A shortcut button in the bar. */
export interface BulkAction {
  /** Stable key. */
  key: string
  /** Button text. */
  label: string
  /** data-qqq-id for the button. */
  dataId: string
  /** Whether the action is destructive (styled accordingly). */
  destructive?: boolean
  /** Click handler. */
  onClick: () => void
}

/**
 * Props for the BulkActionBar component.
 */
interface BulkActionBarProps {
  /** Records the selection covers; the bar is hidden at zero. */
  selectionCount: number
  /** Material's selection banner text. */
  selectionText: string
  /** Clears the selection. */
  onClearSelection: () => void
  /** Shortcut actions (for example Bulk Edit and Bulk Delete). */
  actions?: BulkAction[]
}

/**
 * Selection banner with bulk shortcuts. Returns null when nothing is selected.
 *
 * @param props - Component properties.
 * @returns The bar or null.
 */
export function BulkActionBar({ selectionCount, selectionText, onClearSelection, actions = [] }: BulkActionBarProps) {
  if (selectionCount === 0) return null
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2"
      role="region"
      aria-label="Bulk actions"
      aria-live="polite"
      data-qqq-id="bulk-action-bar"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-primary" data-qqq-id="bulk-selection-text">{selectionText}</span>
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Clear selection"
          data-qqq-id="bulk-clear-selection"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>
      {actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              className={`flex items-center gap-1.5 rounded border bg-background px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 ${action.destructive ? 'border-destructive text-destructive hover:bg-destructive/10 focus:ring-destructive' : 'border-input text-foreground hover:bg-accent focus:ring-ring'}`}
              data-qqq-id={action.dataId}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
