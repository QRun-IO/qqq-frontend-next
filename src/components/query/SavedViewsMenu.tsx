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

/** SavedViewsMenu — dropdown menu for saving, loading, and deleting named filter and column configurations (saved views). */
'use client'

// SavedViewsMenu — save, load, and delete named filter+column configurations

import React, { useState } from 'react'
import { BookmarkIcon, Trash2, Check } from 'lucide-react'

import type { SavedView } from '@/lib/hooks/use-record-query'

/**
 * Props for the SavedViewsMenu component.
 */
interface SavedViewsMenuProps {
  /** The current list of saved views retrieved from localStorage. */
  savedViews: SavedView[]
  /** Callback invoked when the user confirms saving the current state under a new name. */
  onSave: (name: string) => void
  /** Callback invoked when the user selects a saved view to restore. */
  onLoad: (view: SavedView) => void
  /** Callback invoked when the user deletes a saved view by its ID. */
  onDelete: (id: string) => void
}

/**
 * Toolbar dropdown for managing named saved views of filter + column state.
 *
 * Opens a dropdown that shows a "Save current view" entry and a scrollable list of
 * existing saved views. Saving enters an inline name-input mode; loading closes the
 * dropdown and restores the chosen view; deleting is available via a per-row trash icon
 * that is only visible on hover/focus.
 *
 * @param savedViews - Saved view list from the parent hook (use-record-query).
 * @param onSave - Called with the new view name when the user confirms the save.
 * @param onLoad - Called with the SavedView to restore when the user clicks a view.
 * @param onDelete - Called with the view ID when the user clicks the delete button.
 */
export function SavedViewsMenu({
  savedViews,
  onSave,
  onLoad,
  onDelete,
}: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false)
  const [saveMode, setSaveMode] = useState(false)
  const [newViewName, setNewViewName] = useState('')

  /**
   * Validates the new view name, calls `onSave`, and resets the save-mode UI.
   * Does nothing if the name is blank.
   */
  const handleSave = () => {
    const name = newViewName.trim()
    if (!name) return
    onSave(name)
    setNewViewName('')
    setSaveMode(false)
  }

  /**
   * Loads a saved view and closes the dropdown.
   *
   * @param view - The SavedView to restore.
   */
  const handleLoadView = (view: SavedView) => {
    onLoad(view)
    setOpen(false)
  }

  return (
    <div className="relative" data-qqq-id="saved-views-menu">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setSaveMode(false)
        }}
        className="flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Saved views"
        aria-haspopup="true"
        aria-expanded={open}
        data-qqq-id="button-saved-views"
      >
        <BookmarkIcon className="h-4 w-4" aria-hidden="true" />
        Views
        {savedViews.length > 0 && (
          <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
            {savedViews.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown */}
          <div
            className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-border bg-popover shadow-sm"
            role="dialog"
            aria-label="Saved views"
          >
            {/* Save current view */}
            {!saveMode ? (
              <button
                type="button"
                onClick={() => setSaveMode(true)}
                className="flex w-full items-center gap-2 border-b border-border px-4 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
                data-qqq-id="saved-views-save-current"
              >
                <BookmarkIcon className="h-4 w-4" aria-hidden="true" />
                Save current view...
              </button>
            ) : (
              <div className="border-b border-border p-3">
                <p className="mb-2 text-xs font-medium text-foreground">
                  Name this view
                </p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave()
                      if (e.key === 'Escape') setSaveMode(false)
                    }}
                    placeholder="View name..."
                    className="flex-1 rounded border border-input px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="New view name"
                    autoFocus
                    data-qqq-id="saved-views-name-input"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!newViewName.trim()}
                    className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Confirm save"
                    data-qqq-id="saved-views-confirm-save"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Saved views list */}
            {savedViews.length === 0 ? (
              <p className="px-4 py-3 text-center text-sm text-muted-foreground">
                No saved views yet
              </p>
            ) : (
              <ul className="max-h-60 overflow-y-auto" role="list">
                {savedViews.map((view) => (
                  <li
                    key={view.id}
                    className="group flex items-center justify-between px-4 py-2 hover:bg-accent"
                    data-qqq-id={`saved-view-item-${view.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadView(view)}
                      className="flex-1 text-left text-sm text-popover-foreground hover:text-primary focus:outline-none focus:ring-1 focus:ring-ring"
                      aria-label={`Load view: ${view.name}`}
                      data-qqq-id={`saved-view-load-${view.id}`}
                    >
                      <span className="truncate">{view.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(view.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(view.id)
                      }}
                      className="ml-2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 hover:text-destructive focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-destructive group-hover:opacity-100"
                      aria-label={`Delete saved view: ${view.name}`}
                      data-qqq-id={`saved-view-delete-${view.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
