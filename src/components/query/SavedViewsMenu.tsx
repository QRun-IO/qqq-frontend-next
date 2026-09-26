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
 * @file SavedViewsMenu — Material's saved views menu for the query screen: save, rename,
 * save as, delete and new view actions; "Your Saved Views" and "Views Shared with you"; and an
 * unsaved-changes indicator with save and reset links.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { BookmarkIcon, ChevronDown, X } from 'lucide-react'

import type { SavedView } from '@/lib/utils/saved-view-utils'
import type { SavedViewsResult } from '@/lib/hooks/use-saved-views'

/** Dialog shown by a view action. */
type DialogKind = 'saveAs' | 'rename' | 'update' | 'delete'

/**
 * Props for the SavedViewsMenu component.
 */
interface SavedViewsMenuProps {
  /** Saved view lists and actions. */
  savedViews: SavedViewsResult
  /** The view the screen was loaded from, or null for a new view. */
  currentView: SavedView | null
  /** Differences between the screen and the current (or default) view. */
  viewDiffs: string[]
  /** Opens a saved view. */
  onSelectView: (view: SavedView) => void
  /** Leaves the current view for a new (default) view. */
  onNewView: () => void
  /** Stores the current screen as a view (insert, or update when `id` is given) and opens it. */
  onStore: (input: { id?: number; label: string }) => Promise<void>
  /** Deletes the current view. */
  onDelete: (view: SavedView) => Promise<void>
}

/**
 * Saved views dropdown and dialogs.
 *
 * @param props - Component properties.
 * @returns The menu, or null when the backend has no saved views.
 */
export function SavedViewsMenu({ savedViews, currentView, viewDiffs, onSelectView, onNewView, onStore, onDelete }: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    // Escape closes the menu and returns focus to its button
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      containerRef.current?.querySelector<HTMLElement>('[aria-expanded]')?.focus()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!savedViews.isAvailable) return null

  const isOwner = currentView ? savedViews.isOwner(currentView) : true
  const notOwnerText = 'You may not save changes to this view, because you are not its owner.'
  const modified = viewDiffs.length > 0

  const openDialog = (kind: DialogKind) => {
    setOpen(false)
    setError(null)
    setName(kind === 'rename' && currentView ? currentView.label : '')
    setDialog(kind)
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      if (dialog === 'delete' && currentView) await onDelete(currentView)
      else if (dialog === 'update' && currentView) await onStore({ id: currentView.id, label: currentView.label })
      else if (dialog === 'rename' && currentView) await onStore({ id: currentView.id, label: name.trim() })
      else await onStore({ label: name.trim() })
      setDialog(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const needsName = dialog === 'saveAs' || dialog === 'rename'
  const title = dialog === 'delete' ? 'Delete View' : dialog === 'rename' ? 'Rename View' : dialog === 'update' ? 'Update Existing View' : 'Save View As'
  const menuItem = 'flex w-full items-center px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent focus:bg-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
  const viewItem = (view: SavedView, group: 'your' | 'shared') => (
    <button key={view.id} type="button" role="menuitem" className={`${menuItem} ${currentView?.id === view.id ? 'font-semibold text-primary' : ''}`}
      onClick={() => { setOpen(false); onSelectView(view) }} data-qqq-id={`saved-view-${group}-${view.id}`}>
      {view.label}
    </button>
  )

  return (
    <div ref={containerRef} className="relative flex items-center gap-2" data-qqq-id="saved-views-menu">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={currentView ? `Saved views (current view: ${currentView.label})` : 'Saved views'}
        aria-haspopup="menu"
        aria-expanded={open}
        data-qqq-id="button-saved-views"
      >
        <BookmarkIcon className="h-4 w-4" aria-hidden="true" />
        <span className="max-w-[12rem] truncate">{currentView ? currentView.label : 'Views'}</span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {modified && (
        <span className="flex items-center gap-2 text-xs" data-qqq-id="saved-view-unsaved">
          <span className="font-semibold text-foreground" title={viewDiffs.join('\n')}>
            {currentView ? `${viewDiffs.length} Unsaved Change${viewDiffs.length === 1 ? '' : 's'}` : 'Unsaved Changes'}
          </span>
          {savedViews.canStore && (!currentView || isOwner) && (
            <button type="button" className="text-primary underline hover:text-primary/80 focus:outline-none focus:ring-1 focus:ring-ring"
              onClick={() => openDialog(currentView ? 'update' : 'saveAs')} data-qqq-id="saved-view-save-changes">
              {currentView ? 'Save...' : 'Save View As...'}
            </button>
          )}
          <button type="button" className="text-muted-foreground underline hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onClick={() => (currentView ? onSelectView(currentView) : onNewView())} data-qqq-id="saved-view-reset">
            Reset All Changes
          </button>
        </span>
      )}

      {open && (
        <div role="menu" aria-label="Saved views" className="absolute left-0 top-full z-30 mt-1 max-h-[calc(100vh-200px)] w-80 overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-sm">
          <p className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">View Actions</p>
          {savedViews.canStore && (
            <button type="button" role="menuitem" className={menuItem} disabled={Boolean(currentView) && !isOwner}
              title={currentView && !isOwner ? notOwnerText : undefined}
              onClick={() => openDialog(currentView ? 'update' : 'saveAs')} data-qqq-id="saved-view-action-save">
              {currentView ? 'Save...' : 'Save As...'}
            </button>
          )}
          {savedViews.canStore && currentView && (
            <button type="button" role="menuitem" className={menuItem} disabled={!isOwner} title={!isOwner ? notOwnerText : undefined}
              onClick={() => openDialog('rename')} data-qqq-id="saved-view-action-rename">Rename...</button>
          )}
          {savedViews.canStore && currentView && (
            <button type="button" role="menuitem" className={menuItem} onClick={() => openDialog('saveAs')} data-qqq-id="saved-view-action-save-as">Save As...</button>
          )}
          {savedViews.canDelete && currentView && (
            <button type="button" role="menuitem" className={menuItem} disabled={!isOwner} title={!isOwner ? notOwnerText : undefined}
              onClick={() => openDialog('delete')} data-qqq-id="saved-view-action-delete">Delete...</button>
          )}
          <button type="button" role="menuitem" className={menuItem} onClick={() => { setOpen(false); onNewView() }} data-qqq-id="saved-view-action-new">New View</button>

          <div role="separator" className="my-1 border-t border-border" />
          <p className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground" id="your-saved-views">Your Saved Views</p>
          <div role="group" aria-labelledby="your-saved-views" data-qqq-id="saved-views-yours">
            {savedViews.isLoading ? (
              <p className="px-4 py-2 text-sm text-muted-foreground">Loading...</p>
            ) : savedViews.error ? (
              <p role="alert" className="px-4 py-2 text-sm text-destructive">Saved views could not be loaded.</p>
            ) : savedViews.yourViews.length ? savedViews.yourViews.map((v) => viewItem(v, 'your')) : (
              <p className="px-4 py-2 text-sm italic text-muted-foreground">You do not have any saved views for this table.</p>
            )}
          </div>
          <p className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground" id="shared-saved-views">Views Shared with you</p>
          <div role="group" aria-labelledby="shared-saved-views" data-qqq-id="saved-views-shared">
            {!savedViews.isLoading && !savedViews.error && (savedViews.sharedViews.length ? savedViews.sharedViews.map((v) => viewItem(v, 'shared')) : (
              <p className="px-4 py-2 text-sm italic text-muted-foreground">You do not have any views shared with you for this table.</p>
            ))}
          </div>
        </div>
      )}

      <DialogPrimitive.Root open={dialog !== null} onOpenChange={(o) => { if (!o) setDialog(null) }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content aria-describedby={undefined} data-qqq-id="dialog-saved-view"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg focus:outline-none">
            <div className="mb-4 flex items-center justify-between">
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (!needsName || name.trim()) void submit() }}>
              {needsName ? (
                <>
                  <label htmlFor="saved-view-name" className="mb-1 block text-sm text-foreground">
                    {dialog === 'rename' ? 'Enter a new name for this view' : 'Enter a name for this view'}
                  </label>
                  <input id="saved-view-name" type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-required="true" aria-invalid={Boolean(error)} data-qqq-id="saved-views-name-input" />
                </>
              ) : (
                <p className="text-sm text-foreground">
                  {dialog === 'delete'
                    ? `Are you sure you want to delete the view '${currentView?.label}'?`
                    : `Are you sure you want to update the view '${currentView?.label}'?`}
                </p>
              )}
              {error && <p role="alert" className="mt-2 text-sm text-destructive" data-qqq-id="saved-view-error">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <DialogPrimitive.Close className="rounded border border-input px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">Cancel</DialogPrimitive.Close>
                <button type="submit" disabled={submitting || (needsName && !name.trim())} data-qqq-id="saved-views-confirm-save"
                  className={`rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 disabled:opacity-50 ${dialog === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive' : 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring'}`}>
                  {dialog === 'delete' ? 'Delete' : 'Save'}
                </button>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
