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
 * @file SavedBulkLoadProfiles — choose, save, update and delete saved bulk load
 * profiles on the bulk load screens, through the store/query/delete saved bulk
 * load profile processes (shown only when the application defines them).
 */

'use client'

import React, { useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteSavedBulkLoadProfile,
  querySavedBulkLoadProfiles,
  storeSavedBulkLoadProfile,
  type SavedBulkLoadProfileRecord,
} from '@/lib/api/processes'

import { useProcessStep } from './ProcessStepContext'
import type { BulkLoadProfile } from './bulk-load-models'

/** Props for {@link SavedBulkLoadProfiles}. */
export interface SavedBulkLoadProfilesProps {
  tableName: string
  isBulkEdit: boolean
  /** The saved profile in use, if any. */
  current: SavedBulkLoadProfileRecord | null
  /** Whether a saved profile can be chosen here (the file mapping screen). */
  allowSelecting: boolean
  /** The current mapping as a v1 profile, for saving. */
  profileToSave: () => BulkLoadProfile
  /** A profile was chosen (or `null` for none). */
  onSelect?: (profile: SavedBulkLoadProfileRecord | null) => void
  /** A profile was saved, deleted (`null`) or chosen. */
  onChange: (profile: SavedBulkLoadProfileRecord | null) => void
  /** Whether to state which profile is in use (off when the host screen already does). */
  showCurrent?: boolean
}

const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const inputClass = 'rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Render the saved bulk load profile controls.
 * @param props - {@link SavedBulkLoadProfilesProps}
 * @returns The controls, or nothing when the application has no saved profiles.
 */
export function SavedBulkLoadProfiles({ tableName, isBulkEdit, current, allowSelecting, profileToSave, onSelect, onChange, showCurrent = true }: SavedBulkLoadProfilesProps) {
  const { instance, isWorking } = useProcessStep()
  const queryClient = useQueryClient()
  const nameId = useId()
  const [mode, setMode] = useState<'idle' | 'saveAs' | 'confirmDelete'>('idle')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canStore = Boolean(instance?.processes?.storeSavedBulkLoadProfile)
  const canQuery = Boolean(instance?.processes?.querySavedBulkLoadProfile)
  const canDelete = Boolean(instance?.processes?.deleteSavedBulkLoadProfile)
  const queryKey = ['qqq', 'savedBulkLoadProfiles', tableName, isBulkEdit]
  const profiles = useQuery({
    queryKey,
    queryFn: () => querySavedBulkLoadProfiles(tableName, isBulkEdit),
    enabled: allowSelecting && canQuery,
  })

  if (!canStore && !canQuery) return null
  const action = isBulkEdit ? 'Edit' : 'Load'

  /**
   * Run a profile change, reporting its outcome.
   * @param work - The change.
   * @param success - Message on success.
   */
  const run = async (work: () => Promise<SavedBulkLoadProfileRecord | null>, success: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const profile = await work()
      await queryClient.invalidateQueries({ queryKey })
      onChange(profile)
      setMode('idle')
      setMessage(success)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The profile could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const store = (label: string, id?: number) => run(
    () => storeSavedBulkLoadProfile({ id, label, tableName, isBulkEdit, mappingJson: JSON.stringify(profileToSave()) }),
    'Profile Saved.'
  )

  return (
    <section aria-label={`Saved Bulk ${action} Profiles`} className="space-y-2 rounded-xl border border-border p-3 text-sm" data-qqq-id="saved-bulk-load-profiles">
      <h4 className="font-semibold text-foreground">{`Saved Bulk ${action} Profiles`}</h4>
      {showCurrent && (
        <p className="text-muted-foreground" data-qqq-id="saved-bulk-load-profile-current">
          {current ? `You are using the bulk ${action.toLowerCase()} profile: ${current.label}` : `You are not using a saved bulk ${action.toLowerCase()} profile.`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {allowSelecting && canQuery && (
          <select
            aria-label={`Saved bulk ${action.toLowerCase()} profile`}
            value={current?.id ?? ''}
            disabled={isWorking || busy}
            onChange={(event) => {
              const chosen = (profiles.data ?? []).find((profile) => String(profile.id) === event.target.value) ?? null
              onSelect?.(chosen)
              onChange(chosen)
              setMessage(null)
            }}
            className={inputClass}
            data-qqq-id="select-saved-bulk-load-profile"
          >
            <option value="">{`New bulk ${action.toLowerCase()} profile`}</option>
            {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
          </select>
        )}
        {canStore && current && (
          <button type="button" className={buttonClass} disabled={isWorking || busy} onClick={() => { void store(current.label, current.id) }} data-qqq-id="button-save-bulk-load-profile">
            Save
          </button>
        )}
        {canStore && (
          <button type="button" className={buttonClass} disabled={isWorking || busy} onClick={() => { setMode('saveAs'); setName(''); setError(null) }} data-qqq-id="button-save-as-bulk-load-profile">
            Save As...
          </button>
        )}
        {canDelete && current && (
          <button type="button" className={buttonClass} disabled={isWorking || busy} onClick={() => setMode('confirmDelete')} data-qqq-id="button-delete-bulk-load-profile">
            Delete...
          </button>
        )}
      </div>
      {mode === 'saveAs' && (
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor={nameId} className="flex flex-col gap-1">
            Profile Name
            <input id={nameId} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} data-qqq-id="input-bulk-load-profile-name" />
          </label>
          <button type="button" className={buttonClass} disabled={busy || !name.trim()} onClick={() => { void store(name.trim()) }} data-qqq-id="button-confirm-save-bulk-load-profile">
            Save Profile
          </button>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => setMode('idle')}>Cancel</button>
        </div>
      )}
      {mode === 'confirmDelete' && current && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm delete">
          <span>{`Delete the profile ${current.label}?`}</span>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => { void run(async () => { await deleteSavedBulkLoadProfile(current.id); return null }, 'Profile Deleted.') }} data-qqq-id="button-confirm-delete-bulk-load-profile">
            Delete Profile
          </button>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => setMode('idle')}>Keep</button>
        </div>
      )}
      {message && <p role="status" className="text-green-700" data-qqq-id="saved-bulk-load-profile-message">{message}</p>}
      {error && <p role="alert" className="text-destructive" data-qqq-id="saved-bulk-load-profile-error">{error}</p>}
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
