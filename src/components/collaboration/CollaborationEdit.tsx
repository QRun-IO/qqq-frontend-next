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

/** @file Live edit warnings and optimistic-conflict review without replacing unsaved values. */
'use client'
import { useContext, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { QRecord, QTableMetaData } from '@/types'
import type { PresenceViewer } from '@/types/collaboration'
import { getRecord } from '@/lib/api/tables'
import { searchPeople } from '@/lib/api/collaboration'
import { QContext } from '@/lib/context/q-context'
import { useRealtimeChannel } from '@/lib/hooks/use-realtime-channel'
import { useCollaborationPresence } from '@/lib/hooks/use-collaboration-presence'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { recordVersion } from '@/lib/utils/record-version'
import { CollaborationDialog, collaborationButton } from './CollaborationDialog'
import { PresenceAvatars } from './PresenceAvatars'

export interface CollaborationEditProps {
  table: QTableMetaData
  pk: string
  fieldName?: string
  /** Qbit installed: presence, actor names and notifications. */
  available: boolean
  /** Table publishes record events (PRESENCE or FOLLOW). */
  realtime: boolean
  error: Error | null
  getValues: () => Record<string, unknown>
  onViewers: (viewers: PresenceViewer[]) => void
  onOverwrite: (version: string) => void
  onReload: (record: QRecord) => void
  pending: boolean
}
interface Conflict {
  fields: string[]
  actor?: string
  version?: string
  rejected: boolean
}
/** Extracts only the documented 409 fields.
 * @param error - Failed update.
 * @returns Conflict or null.
 */
export function recordConflict(error: Error | null): Conflict | null {
  if (getErrorStatusCode(error) !== 409) return null
  const data = (error as Error & { response?: { data?: Record<string, unknown> } }).response?.data
  if (!data) return null
  return {
    fields: Array.isArray(data.changedFields)
      ? data.changedFields.filter((f): f is string => typeof f === 'string')
      : [],
    actor: data.modifiedByUserId == null ? undefined : String(data.modifiedByUserId),
    version: data.currentVersion == null ? undefined : String(data.currentVersion),
    rejected: true,
  }
}
/** Presence and a shared dialog for stream warnings and server save conflicts.
 * @param props - Form accessors and write callbacks.
 * @returns Warning and review dialog.
 */
export function CollaborationEdit({
  table,
  pk,
  fieldName,
  available,
  realtime,
  error,
  getValues,
  onViewers,
  onOverwrite,
  onReload,
  pending,
}: CollaborationEditProps) {
  const userId = useContext(QContext)?.userId
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [open, setOpen] = useState(false)
  const presence = useCollaborationPresence(
    table.name,
    pk,
    true,
    fieldName,
    available && table.recordFeatures?.features?.includes('PRESENCE')
  )
  const signature = JSON.stringify(presence.viewers)
  useEffect(() => {
    onViewers(JSON.parse(signature) as PresenceViewer[])
  }, [signature, onViewers])
  useRealtimeChannel(
    `record:${table.name}:${pk}`,
    ({ event, data }) => {
      if (
        event === 'record.changed' &&
        data.table === table.name &&
        String(data.pk) === pk &&
        data.changedBy !== userId
      )
        setConflict((previous) =>
          // A pending 409 keeps its server version; a later hint only refreshes the warning.
          previous?.rejected
            ? previous
            : {
                fields: Array.isArray(data.fields)
                  ? data.fields.filter(
                      (f): f is string => typeof f === 'string' && !!table.fields[f]
                    )
                  : [],
                actor: typeof data.changedBy === 'string' ? data.changedBy : undefined,
                rejected: false,
              }
        )
    },
    realtime
  )
  useEffect(() => {
    const next = recordConflict(error)
    if (next) {
      setConflict(next)
      setOpen(true)
    }
  }, [error])
  const current = useQuery({
    queryKey: ['qqq', 'conflict-review', table.name, pk, conflict],
    queryFn: () => getRecord(table.name, pk),
    enabled: open,
    staleTime: 0,
  })
  const actor = useQuery({
    queryKey: ['qqq', 'collaboration', 'actor', conflict?.actor],
    queryFn: () => searchPeople(conflict?.actor ?? ''),
    enabled: available && !!conflict?.actor,
  })
  const name =
    actor.data?.items.find((p) => p.userId === conflict?.actor)?.displayName ||
    conflict?.actor ||
    'Someone'
  const fields = (
    conflict?.fields.length
      ? conflict.fields
      : Object.keys(table.fields).filter(
          (field) =>
            current.data &&
            JSON.stringify(current.data.values[field]) !== JSON.stringify(getValues()[field])
        )
  ).filter(
    (field) =>
      !!table.fields[field] &&
      !table.fields[field].isHidden &&
      table.fields[field].type !== 'PASSWORD'
  )
  const version = current.data
    ? (recordVersion(table, current.data) ?? conflict?.version)
    : undefined
  return (
    <div className="space-y-3">
      <PresenceAvatars viewers={presence.viewers} />
      {presence.unavailable && <span role="status">Presence temporarily unavailable</span>}
      {conflict && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
          data-qqq-id="conflict-banner"
        >
          <p>
            {name} saved changes
            {fields.length ? ` to ${fields.map((f) => table.fields[f].label).join(', ')}` : ''}.
            Your edits are not saved yet.
          </p>
          <button
            type="button"
            className={collaborationButton}
            onClick={() => setOpen(true)}
            data-qqq-id="conflict-review"
          >
            Review changes
          </button>
        </div>
      )}
      <CollaborationDialog title="Review changes" open={open} onOpenChange={setOpen}>
        {current.isPending && <p role="status">Loading current values…</p>}
        {current.isError && (
          <p role="alert">
            Could not load current values.{' '}
            <button
              type="button"
              className={collaborationButton}
              onClick={() => current.refetch()}
              data-qqq-id="conflict-retry"
            >
              Retry
            </button>
          </p>
        )}
        {current.data && (
          <div className="space-y-3" data-qqq-id="conflict-values">
            {fields.map((field) => (
              <section key={field} className="min-w-0 rounded border border-border p-3">
                <h3 className="font-semibold">{table.fields[field].label}</h3>
                <dl className="grid grid-cols-1 gap-2 break-words text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Theirs</dt>
                    <dd>
                      {String(
                        current.data.displayValues?.[field] ?? current.data.values[field] ?? '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Yours</dt>
                    <dd>{String(getValues()[field] ?? '—')}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {conflict?.rejected && (
            <button
              type="button"
              disabled={pending || version === undefined || !current.isSuccess}
              className={collaborationButton}
              onClick={() => {
                if (version === undefined) return
                // Re-sends with the version just read; another 409 reopens the review.
                setOpen(false)
                setConflict(null)
                onOverwrite(version)
              }}
              data-qqq-id="conflict-overwrite"
            >
              Keep mine (overwrite)
            </button>
          )}
          <button
            type="button"
            disabled={pending || !current.isSuccess}
            className={collaborationButton}
            onClick={() => {
              if (current.data) {
                onReload(current.data)
                setConflict(null)
                setOpen(false)
              }
            }}
            data-qqq-id="conflict-use-theirs"
          >
            Use theirs
          </button>
        </div>
      </CollaborationDialog>
    </div>
  )
}
