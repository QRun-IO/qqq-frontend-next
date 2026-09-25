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
 * @file ShareButton / ShareDialog — share a record of a shareable table with users or groups.
 *
 * Parity with the Material dashboard's ShareModal: shown on the record view of
 * tables that declare `shareableTableMetaData`; only the record's owner may share
 * (the button is disabled for others, and the backend enforces it); audiences come
 * from the table's audience possible-value source; existing shares are listed with
 * their scope (Read-Only / Read and Edit), which can be changed, and can be removed.
 */
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2, Trash2, UserPlus, X } from 'lucide-react'

import type { QRecord, QTableMetaData } from '@/types'
import { fetchPossibleValues } from '@/lib/api/possible-values'
import {
  deleteSharedRecord, editSharedRecord, getSharedRecords, insertSharedRecord, splitAudienceOption,
} from '@/lib/api/sharing'
import type { RecordShare, ShareableTableMetaData, ShareScope } from '@/lib/api/sharing'
import { useQContext } from '@/lib/context/q-context'
import { cn } from '@/lib/utils/cn'

/** Scopes offered when sharing. */
const SCOPES: Array<{ id: ShareScope; label: string }> = [
  { id: 'READ_ONLY', label: 'Read-Only' },
  { id: 'READ_WRITE', label: 'Read and Edit' },
]

/** Props accepted by {@link ShareButton}. */
interface ShareButtonProps {
  /** Metadata of the shareable table. */
  tableMetaData: QTableMetaData
  /** The record to share. */
  record: QRecord
}

/**
 * The record-view Share button; disabled with an explanation when the current
 * user does not own the record.
 *
 * @param props - See {@link ShareButtonProps}.
 * @returns The button and, when open, the dialog.
 */
export function ShareButton({ tableMetaData, record }: ShareButtonProps) {
  const { userId } = useQContext()
  const [open, setOpen] = useState(false)
  const sharing = tableMetaData.shareableTableMetaData as ShareableTableMetaData | undefined
  if (!sharing) return null
  const ownerField = sharing.thisTableOwnerIdFieldName
  const isOwner = !ownerField || (userId !== undefined && String(record.values[ownerField] ?? '') === userId)
  const reason = isOwner ? undefined : `Only the owner of a ${tableMetaData.label} may share it.`
  return (
    <>
      <span title={reason}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!isOwner}
          aria-describedby={reason ? 'share-disabled-reason' : undefined}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          data-qqq-id="button-share"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Share
        </button>
        {reason && <span id="share-disabled-reason" className="sr-only">{reason}</span>}
      </span>
      {open && <ShareDialog tableMetaData={tableMetaData} record={record} sharing={sharing} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Props accepted by {@link ShareDialog}. */
interface ShareDialogProps {
  tableMetaData: QTableMetaData
  record: QRecord
  sharing: ShareableTableMetaData
  onClose: () => void
}

/**
 * The share dialog: add a share, change a share's scope, remove a share.
 *
 * @param props - See {@link ShareDialogProps}.
 * @returns The modal dialog.
 */
export function ShareDialog({ tableMetaData, record, sharing, onClose }: ShareDialogProps) {
  const recordId = record.values[tableMetaData.primaryKeyField] as string | number
  const [shares, setShares] = useState<RecordShare[] | null>(null)
  const [audiences, setAudiences] = useState<Array<{ id: string; label: string }>>([])
  const [audience, setAudience] = useState('')
  const [scope, setScope] = useState<ShareScope>('READ_ONLY')
  const [status, setStatus] = useState<string | null>('Loading...')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setStatus('Loading...')
    try {
      setShares(await getSharedRecords(tableMetaData.name, recordId))
      setStatus(null)
    } catch (failure) {
      setStatus(null)
      setError(`Error loading: ${(failure as Error).message}`)
    }
  }, [tableMetaData.name, recordId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const source = sharing.audiencePossibleValueSourceName
    if (!source) return
    fetchPossibleValues(source).then((options) => setAudiences(options.map((option) => ({ id: String(option.id), label: option.label }))))
      .catch((failure: Error) => setError(`Error loading users and groups: ${failure.message}`))
  }, [sharing.audiencePossibleValueSourceName])

  /**
   * Runs one change, then reloads the share list.
   *
   * @param label - Status shown while running.
   * @param action - The change.
   * @param failurePrefix - Prefix for the error message.
   */
  async function change(label: string, action: () => Promise<void>, failurePrefix: string) {
    setBusy(true)
    setError(null)
    setStatus(label)
    try {
      await action()
      await load()
    } catch (failure) {
      setStatus(null)
      setError(`${failurePrefix}: ${(failure as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  /** Shares the record with the selected audience and scope. */
  async function handleShare() {
    const selected = splitAudienceOption(audience)
    if (!selected) return
    await change('Saving...', () => insertSharedRecord(tableMetaData.name, recordId, selected.audienceType, selected.audienceId, scope), 'Error sharing record')
    setAudience('')
  }

  const title = `Share ${tableMetaData.label}: ${record.recordLabel ?? String(recordId)}`

  return (
    <DialogPrimitive.Root open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg focus:outline-none"
          data-qqq-id="dialog-share"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">Select a user or a group to share this record with.</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded p-1 text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Close">
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="mt-2 min-h-[1.5rem] text-sm">
            {error && <p role="alert" className="text-destructive" data-qqq-id="share-error">{error}</p>}
            {!error && status && <p role="status" className="text-muted-foreground" data-qqq-id="share-status">{status}</p>}
          </div>

          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <label htmlFor="share-audience" className="block text-sm font-medium text-foreground">User or Group</label>
              <select
                id="share-audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-qqq-id="share-audience"
              >
                <option value="">Select a user or group</option>
                {audiences.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="share-scope" className="block text-sm font-medium text-foreground">Scope</label>
              <select
                id="share-scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as ShareScope)}
                disabled={busy}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-qqq-id="share-scope"
              >
                {SCOPES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={handleShare}
              disabled={busy || !splitAudienceOption(audience)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              data-qqq-id="button-share-save"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Share
            </button>
          </div>

          <section className="mt-6" aria-labelledby="current-shares-heading">
            <h3 id="current-shares-heading" className="text-sm font-semibold text-foreground">
              Current Shares{shares ? ` (${shares.length})` : ''}
            </h3>
            <ul className="mt-2 max-h-56 divide-y divide-border overflow-auto rounded-lg border border-border" data-qqq-id="share-list">
              {shares?.length === 0 && <li className="p-3 text-sm text-muted-foreground">This record is not shared.</li>}
              {shares?.map((share) => (
                <li key={share.shareId} className="flex items-center justify-between gap-3 p-3 text-sm" data-qqq-id={`share-${share.shareId}`}>
                  <span className="font-medium text-foreground">{share.audienceLabel}</span>
                  <span className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`share-scope-${share.shareId}`}>Scope for {share.audienceLabel}</label>
                    <select
                      id={`share-scope-${share.shareId}`}
                      value={share.scopeId}
                      disabled={busy}
                      onChange={(event) => change('Saving...', () => editSharedRecord(tableMetaData.name, recordId, share.shareId, event.target.value as ShareScope), 'Error editing shared record')}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      data-qqq-id={`share-scope-${share.shareId}`}
                    >
                      {SCOPES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => change('Deleting...', () => deleteSharedRecord(tableMetaData.name, recordId, share.shareId), 'Error deleting share')}
                      aria-label={`Remove share with ${share.audienceLabel}`}
                      className={cn('rounded p-1 text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50')}
                      data-qqq-id={`button-share-remove-${share.shareId}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id="button-share-done"
            >
              Done
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
