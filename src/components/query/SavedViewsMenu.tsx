'use client'

// SavedViewsMenu — save, load, and delete named filter+column configurations

import React, { useState } from 'react'
import { BookmarkIcon, Trash2, Check } from 'lucide-react'

import type { SavedView } from '@/lib/hooks/use-record-query'

interface SavedViewsMenuProps {
  savedViews: SavedView[]
  onSave: (name: string) => void
  onLoad: (view: SavedView) => void
  onDelete: (id: string) => void
}

export function SavedViewsMenu({
  savedViews,
  onSave,
  onLoad,
  onDelete,
}: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false)
  const [saveMode, setSaveMode] = useState(false)
  const [newViewName, setNewViewName] = useState('')

  const handleSave = () => {
    const name = newViewName.trim()
    if (!name) return
    onSave(name)
    setNewViewName('')
    setSaveMode(false)
  }

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
