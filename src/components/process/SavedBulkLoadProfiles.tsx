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
 * @file SavedBulkLoadProfiles — the Material dashboard's saved bulk load profile menu for the
 * bulk load screens: save, rename, save as, delete and new profile actions; "Your Saved Bulk
 * Load Profiles" and "Bulk Load Profiles Shared with you"; the unsaved-changes count with its
 * list of changes, Save and Reset All Changes; and Reset to Empty or Suggested Mapping. Only a
 * profile's owner may save, rename or delete it. Works through the store/query/delete saved
 * bulk load profile processes and is shown only when the application defines them.
 */

'use client'

import React, { useId, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Save, X } from 'lucide-react'

import {
  deleteSavedBulkLoadProfile,
  querySavedBulkLoadProfiles,
  storeSavedBulkLoadProfile,
  type SavedBulkLoadProfileRecord,
} from '@/lib/api/processes'
import { useQContext } from '@/lib/context/q-context'
import { cn } from '@/lib/utils/cn'

import { HoverTooltip } from '@/components/widgets/HoverTooltip'
import { useProcessStep } from './ProcessStepContext'
import { BulkLoadMapping, type BulkLoadProfile, type FileDescription } from './bulk-load-models'
import { diffBulkLoadMappings, isProfileOwner, splitProfilesByOwner } from './saved-bulk-load-profile-utils'

/** Props for {@link SavedBulkLoadProfiles}. */
export interface SavedBulkLoadProfilesProps {
  tableName: string
  isBulkEdit: boolean
  /** The saved profile in use, if any. */
  current: SavedBulkLoadProfileRecord | null
  /** The mapping on screen (compared with the saved profile for its unsaved changes). */
  mapping: BulkLoadMapping
  /** The uploaded file (for column names in the list of changes). */
  file: FileDescription
  /** Whether profiles can be chosen here (the file mapping screen); other screens manage the one in use. */
  allowSelecting: boolean
  /** Show the profile status unless the hosting summary already presents it. */
  showCurrent?: boolean
  /** The current mapping as a v1 profile, for saving. */
  profileToSave: () => BulkLoadProfile
  /** A profile was chosen, or `null` for a new (empty) mapping; the host applies its mapping. */
  onSelect?: (profile: SavedBulkLoadProfileRecord | null) => void
  /** Restore the backend's suggested mapping (not a saved profile). */
  onResetToSuggested?: () => void
  /** The profile in use changed: saved (the record) or deleted (`null`). */
  onChange: (profile: SavedBulkLoadProfileRecord | null) => void
}

/** Dialog shown by a profile action. */
type DialogKind = 'saveNew' | 'saveAs' | 'rename' | 'update' | 'delete'

const NOT_OWNER_TEXT = 'You may not save changes to this bulk load profile, because you are not its owner.'
const menuItem = 'flex w-full items-center px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent focus:bg-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const linkButton = 'rounded px-1 text-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const quietLinkButton = 'rounded px-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const rule = <span aria-hidden="true" className="inline-block h-4 w-px bg-border" />

/**
 * Render the saved bulk load profile menu, status and dialogs.
 * @param props - {@link SavedBulkLoadProfilesProps}
 * @returns The controls, or nothing when the application has no saved profiles.
 */
export function SavedBulkLoadProfiles({
  tableName, isBulkEdit, current, mapping, file, allowSelecting, showCurrent = true, profileToSave, onSelect, onResetToSuggested, onChange,
}: SavedBulkLoadProfilesProps) {
  const { instance, isWorking } = useProcessStep()
  const { userId } = useQContext()
  const queryClient = useQueryClient()
  const baseId = useId()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const canStore = Boolean(instance?.processes?.storeSavedBulkLoadProfile)
  const canQuery = Boolean(instance?.processes?.querySavedBulkLoadProfile)
  const canDelete = Boolean(instance?.processes?.deleteSavedBulkLoadProfile)
  const queryKey = useMemo(() => ['qqq', 'savedBulkLoadProfiles', tableName, isBulkEdit], [tableName, isBulkEdit])
  const profiles = useQuery({
    queryKey,
    queryFn: () => querySavedBulkLoadProfiles(tableName, isBulkEdit),
    enabled: allowSelecting && canQuery,
  })
  const { yours, shared } = useMemo(() => splitProfilesByOwner(profiles.data ?? [], userId), [profiles.data, userId])

  ////////////////////////////////////////////////////////////////////
  // the unsaved changes: the mapping on screen against the saved    //
  // profile's mapping                                               //
  ////////////////////////////////////////////////////////////////////
  const diffs = useMemo(() => {
    if (!current) return []
    try {
      const base = BulkLoadMapping.fromProfile(mapping.tableStructure, JSON.parse(current.mappingJson) as BulkLoadProfile, file)
      return diffBulkLoadMappings(file, base, mapping)
    } catch {
      return []
    }
  }, [current, file, mapping])

  if (!canQuery && !canStore) return null

  const action = isBulkEdit ? 'Edit' : 'Load'
  const lower = action.toLowerCase()
  const isOwner = !current || isProfileOwner(current, userId)
  const modified = diffs.length > 0

  /**
   * Open a profile action's dialog.
   * @param kind - The action.
   * @param opener - The control to return focus to after the dialog.
   */
  const openDialog = (kind: DialogKind, opener: HTMLElement) => {
    dialogReturnFocusRef.current = opener.closest('[role="menu"]') ? triggerRef.current : opener
    setOpen(false)
    setMessage(null)
    setDialogError(null)
    setName(kind === 'rename' && current ? current.label : '')
    setDialog(kind)
  }

  /**
   * Choose a profile (or a new, empty mapping) from the menu.
   * @param profile - The profile, or `null`.
   */
  const choose = (profile: SavedBulkLoadProfileRecord | null) => {
    setOpen(false)
    setMessage(null)
    onSelect?.(profile)
    onChange(profile)
  }

  /** Run the open dialog's action: store (insert, update or rename) or delete. */
  const submit = async () => {
    if (!dialog || busy) return
    const needsName = dialog === 'saveNew' || dialog === 'saveAs' || dialog === 'rename'
    if (needsName && !name.trim()) return
    setBusy(true)
    setDialogError(null)
    try {
      if (dialog === 'delete' && current) {
        await deleteSavedBulkLoadProfile(current.id)
        await queryClient.invalidateQueries({ queryKey })
        setDialog(null)
        setMessage('Profile Deleted.')
        ////////////////////////////////////////////////////////////////
        // as in Material: the mapping screen starts a new profile     //
        ////////////////////////////////////////////////////////////////
        if (allowSelecting) onSelect?.(null)
        onChange(null)
        return
      }
      const mappingJson = JSON.stringify(profileToSave())
      const stored = await storeSavedBulkLoadProfile({
        id: (dialog === 'update' || dialog === 'rename') && current ? current.id : undefined,
        label: dialog === 'update' && current ? current.label : name.trim(),
        tableName,
        isBulkEdit,
        mappingJson,
      })
      await queryClient.invalidateQueries({ queryKey })
      setDialog(null)
      setMessage('Profile Saved.')
      onChange(stored)
    } catch (failure) {
      setDialogError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }

  const needsName = dialog === 'saveNew' || dialog === 'saveAs' || dialog === 'rename'
  const title = dialog === 'delete' ? `Delete Bulk ${action} Profile`
    : dialog === 'saveAs' ? `Save Bulk ${action} Profile As`
      : dialog === 'rename' ? `Rename Bulk ${action} Profile`
        : dialog === 'update' ? `Update Existing Bulk ${action} Profile`
          : `Save New Bulk ${action} Profile`
  const profileItem = (profile: SavedBulkLoadProfileRecord, group: 'yours' | 'shared') => (
    <DropdownMenuPrimitive.Item asChild key={profile.id}>
      <button type="button" role="menuitem" className={cn(menuItem, 'pl-8', current?.id === profile.id && 'font-semibold text-primary')}
        onClick={() => choose(profile)} data-qqq-id={`saved-bulk-load-profile-${group}-${profile.id}`}>
        {profile.label}
      </button>
    </DropdownMenuPrimitive.Item>
  )
  const buttonTone = !current ? 'border-input bg-background text-foreground hover:bg-accent'
    : modified ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
      : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'

  return (
    <section aria-label={`Saved Bulk ${action} Profiles`} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border p-3 text-sm" data-qqq-id="saved-bulk-load-profiles">
      <h4 className="w-full font-semibold text-foreground">{`Saved Bulk ${action} Profiles`}</h4>
      {showCurrent && (
        <p className="w-full text-muted-foreground" data-qqq-id="saved-bulk-load-profile-current">
          {current ? `You are using the bulk ${lower} profile: ${current.label}` : `You are not using a saved bulk ${lower} profile.`}
        </p>
      )}
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            disabled={isWorking}
            aria-haspopup="menu"
            aria-expanded={open}
            className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50', buttonTone)}
            data-qqq-id="button-saved-bulk-load-profiles"
            data-profile-state={!current ? 'none' : modified ? 'modified' : 'saved'}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {`Saved Bulk ${action} Profiles`}
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content aria-label={`Saved bulk ${lower} profiles`} aria-labelledby={undefined} align="start" sideOffset={4} collisionPadding={8}
            onInteractOutside={event => {
              const target = event.detail.originalEvent.target
              if (target instanceof Node && triggerRef.current?.contains(target)) event.preventDefault()
            }}
            onCloseAutoFocus={event => { if (dialog !== null) event.preventDefault() }}
            className="z-[160] max-h-[var(--radix-dropdown-menu-content-available-height)] w-80 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-sm"
            data-qqq-id="menu-saved-bulk-load-profiles">
            <p className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{`Bulk ${action} Profile Actions`}</p>
            {!allowSelecting && (
              <>
                <p className="px-4 py-1.5 text-sm text-popover-foreground" data-qqq-id="saved-bulk-load-profile-in-use">
                  {current
                    ? <>{`You are using the bulk ${lower} profile: `}<b>{current.label}</b>. You can manage this profile on this screen.</>
                    : `You are not using a saved bulk ${lower} profile. You can save your profile on this screen.`}
                </p>
                <div role="separator" className="my-1 border-t border-border" />
              </>
            )}
            {canStore && (
              <DropdownMenuPrimitive.Item asChild disabled={!isOwner}>
                <button type="button" role="menuitem" className={menuItem} disabled={!isOwner}
                  title={!isOwner ? NOT_OWNER_TEXT : 'Save your current mapping, for quick re-use at a later time.'}
                  onClick={event => openDialog(current ? 'update' : 'saveNew', event.currentTarget)} data-qqq-id="saved-bulk-load-profile-action-save">
                  {current ? 'Save...' : 'Save As...'}
                </button>
              </DropdownMenuPrimitive.Item>
            )}
            {canStore && current && (
              <DropdownMenuPrimitive.Item asChild disabled={!isOwner}>
                <button type="button" role="menuitem" className={menuItem} disabled={!isOwner}
                  title={!isOwner ? NOT_OWNER_TEXT : `Change the name for this saved bulk ${lower} profile.`}
                  onClick={event => openDialog('rename', event.currentTarget)} data-qqq-id="saved-bulk-load-profile-action-rename">
                  Rename...
                </button>
              </DropdownMenuPrimitive.Item>
            )}
            {canStore && current && (
              <DropdownMenuPrimitive.Item asChild>
                <button type="button" role="menuitem" className={menuItem}
                  title={`Save a new copy of this bulk ${lower} profile, with a different name, separate from the original.`}
                  onClick={event => openDialog('saveAs', event.currentTarget)} data-qqq-id="saved-bulk-load-profile-action-save-as">
                  Save As...
                </button>
              </DropdownMenuPrimitive.Item>
            )}
            {canDelete && current && (
              <DropdownMenuPrimitive.Item asChild disabled={!isOwner}>
                <button type="button" role="menuitem" className={menuItem} disabled={!isOwner}
                  title={!isOwner ? NOT_OWNER_TEXT : `Delete this saved bulk ${lower} profile.`}
                  onClick={event => openDialog('delete', event.currentTarget)} data-qqq-id="saved-bulk-load-profile-action-delete">
                  Delete...
                </button>
              </DropdownMenuPrimitive.Item>
            )}
            {allowSelecting && (
              <DropdownMenuPrimitive.Item asChild>
                <button type="button" role="menuitem" className={menuItem}
                  title={`Create a new blank bulk ${lower} profile for this table, removing all mappings.`}
                  onClick={() => choose(null)} data-qqq-id="saved-bulk-load-profile-action-new">
                  {`New Bulk ${action} Profile`}
                </button>
              </DropdownMenuPrimitive.Item>
            )}
            {allowSelecting && canQuery && (
              <>
                <div role="separator" className="my-1 border-t border-border" />
                <p id={`${baseId}-yours`} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{`Your Saved Bulk ${action} Profiles`}</p>
                <div role="group" aria-labelledby={`${baseId}-yours`} data-qqq-id="saved-bulk-load-profiles-yours">
                  {profiles.isLoading ? <p className="px-4 py-2 text-sm text-muted-foreground">Loading...</p>
                    : profiles.isError ? <p role="alert" className="px-4 py-2 text-sm text-destructive">{`Saved bulk ${lower} profiles could not be loaded.`}</p>
                      : yours.length ? yours.map((profile) => profileItem(profile, 'yours'))
                        : <p className="px-4 py-2 text-sm italic text-muted-foreground">{`You do not have any saved bulk ${lower} profiles for this table.`}</p>}
                </div>
                <p id={`${baseId}-shared`} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{`Bulk ${action} Profiles Shared with you`}</p>
                <div role="group" aria-labelledby={`${baseId}-shared`} data-qqq-id="saved-bulk-load-profiles-shared">
                  {!profiles.isLoading && !profiles.isError && (shared.length ? shared.map((profile) => profileItem(profile, 'shared'))
                    : <p className="px-4 py-2 text-sm italic text-muted-foreground">{`You do not have any bulk ${lower} profiles shared with you for this table.`}</p>)}
                </div>
              </>
            )}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-qqq-id="saved-bulk-load-profile-status">
        {message && <span role="status" className="text-green-700 dark:text-green-400" data-qqq-id="saved-bulk-load-profile-message">{message}</span>}
        {!current && (
          <>
            {canStore && (
              <button type="button" className={linkButton} disabled={isWorking} title={`Unsaved Mapping: you are not using a saved bulk ${lower} profile.`}
                onClick={event => openDialog('saveNew', event.currentTarget)} data-qqq-id="saved-bulk-load-profile-save-new">
                {`Save Bulk ${action} Profile As…`}
              </button>
            )}
            {allowSelecting && (
              <>
                {canStore && rule}
                <span className="pl-1 text-muted-foreground">Reset to:</span>
                <button type="button" className={quietLinkButton} disabled={isWorking} onClick={() => choose(null)} data-qqq-id="saved-bulk-load-profile-reset-empty">
                  Empty Mapping
                </button>
                {rule}
                <button type="button" className={quietLinkButton} disabled={isWorking} onClick={() => { setMessage(null); onResetToSuggested?.() }} data-qqq-id="saved-bulk-load-profile-reset-suggested">
                  Suggested Mapping
                </button>
              </>
            )}
          </>
        )}
        {current && modified && (
          <>
            <HoverTooltip
              qqqId="saved-bulk-load-profile-changes"
              content={(
                <span className="block">
                  <b>Unsaved Changes</b>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {diffs.map((diff, index) => <li key={index}>{diff}</li>)}
                  </ul>
                  {!isOwner && <i className="mt-1 block">{NOT_OWNER_TEXT}</i>}
                </span>
              )}
            >
              <span className="font-medium text-foreground" data-qqq-id="saved-bulk-load-profile-change-count">
                {`${diffs.length} Unsaved Change${diffs.length === 1 ? '' : 's'}`}
              </span>
            </HoverTooltip>
            {isOwner && canStore && (
              <button type="button" className={linkButton} disabled={isWorking} onClick={event => openDialog('update', event.currentTarget)} data-qqq-id="saved-bulk-load-profile-save-changes">
                {'Save…'}
              </button>
            )}
            {allowSelecting && (
              <>
                {rule}
                <button type="button" className={quietLinkButton} disabled={isWorking} onClick={() => choose(current)} data-qqq-id="saved-bulk-load-profile-reset-changes">
                  Reset All Changes
                </button>
              </>
            )}
          </>
        )}
      </div>

      <DialogPrimitive.Root open={dialog !== null} onOpenChange={(next) => { if (!next) setDialog(null) }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content aria-describedby={undefined} data-qqq-id="dialog-saved-bulk-load-profile"
            onCloseAutoFocus={event => {
              event.preventDefault()
              const target = dialogReturnFocusRef.current
              if (target?.isConnected) target.focus()
              else triggerRef.current?.focus()
            }}
            onOpenAutoFocus={(event) => {
              ////////////////////////////////////////////////////////////////////////
              // the name field, the Save button of an update (so Enter saves), or //
              // Cancel before a delete                                             //
              ////////////////////////////////////////////////////////////////////////
              event.preventDefault()
              const target = dialog === 'delete' ? cancelButtonRef.current : dialog === 'update' ? saveButtonRef.current : nameInputRef.current
              target?.focus()
            }}
            onKeyDown={(event) => {
              //////////////////////////////////////////////////////////////////
              // Enter saves (not in the delete dialog, which needs the button) //
              //////////////////////////////////////////////////////////////////
              if (event.key === 'Enter' && dialog !== 'delete' && !(event.target instanceof HTMLButtonElement)) {
                event.preventDefault()
                void submit()
              }
            }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg focus:outline-none">
            <div className="mb-4 flex items-center justify-between gap-2">
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Close" data-qqq-id="button-close-saved-bulk-load-profile-dialog">
                <X className="h-4 w-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            {dialogError && <p role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-qqq-id="saved-bulk-load-profile-error">{dialogError}</p>}
            {needsName ? (
              <div className="space-y-2">
                <label htmlFor={`${baseId}-name`} className="block text-sm text-foreground">
                  {dialog === 'rename' ? `Enter a new name for this saved bulk ${lower} profile.` : `Enter a name for this new saved bulk ${lower} profile.`}
                </label>
                <input ref={nameInputRef} id={`${baseId}-name`} type="text" value={name} maxLength={100}
                  placeholder={`Bulk ${action} Profile Name`}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setName(event.target.value)}
                  aria-required="true" aria-invalid={Boolean(dialogError) || undefined}
                  className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  data-qqq-id="input-bulk-load-profile-name" />
              </div>
            ) : (
              <p className="text-sm text-foreground">
                {dialog === 'delete'
                  ? `Are you sure you want to delete the bulk ${lower} profile '${current?.label ?? ''}'?`
                  : `Are you sure you want to update the bulk ${lower} profile '${current?.label ?? ''}'?`}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <DialogPrimitive.Close ref={cancelButtonRef} className="rounded border border-input px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring" data-qqq-id="button-cancel-saved-bulk-load-profile">
                Cancel
              </DialogPrimitive.Close>
              <button ref={saveButtonRef} type="button" onClick={() => { void submit() }} disabled={busy || (needsName && !name.trim())}
                className={cn('rounded px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 disabled:opacity-50',
                  dialog === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive' : 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring')}
                data-qqq-id={dialog === 'delete' ? 'button-confirm-delete-bulk-load-profile' : 'button-confirm-save-bulk-load-profile'}>
                {dialog === 'delete' ? 'Delete' : 'Save'}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  )
}

/**
 * Read a saved profile from the `savedBulkLoadProfileRecord` process value.
 * @param value - Process value (a serialized record).
 * @returns The profile, or `null`.
 */
export function readSavedProfile(value: unknown): SavedBulkLoadProfileRecord | null {
  const values = value && typeof value === 'object' ? (value as { values?: SavedBulkLoadProfileRecord }).values : undefined
  return values && typeof values.id === 'number' ? values : null
}
