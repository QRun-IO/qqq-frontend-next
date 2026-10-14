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

/** @file Lazy record presence, sharing and ownership controls. */
'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QRecord, QTableMetaData } from '@/types'
import { useCollaborationPresence } from '@/lib/hooks/use-collaboration-presence'
import { useRealtimeChannel } from '@/lib/hooks/use-realtime-channel'
import { getRecordFeatures, putAssignment } from '@/lib/api/collaboration'
import { queryKeys } from '@/lib/query-client'
import { PresenceAvatars } from './PresenceAvatars'
import { CollaborationDialog, collaborationButton } from './CollaborationDialog'
import { PeoplePicker } from './PeoplePicker'
const Share = dynamic(() => import('./ShareDialog').then((m) => m.ShareDialog), { ssr: false })
/** Metadata field values take precedence over the qbit assignment summary.
 * @param props - Table, record and extension availability.
 * @returns Header controls.
 */
export function RecordCollaborationHeader({
  table,
  record,
  available,
}: {
  table: QTableMetaData
  record: QRecord
  available: boolean
}) {
  const pk = String(record.values[table.primaryKeyField])
  const target = { table: table.name, pk }
  const features = table.recordFeatures
  const [share, setShare] = useState(false)
  const [assign, setAssign] = useState(false)
  const [role, setRole] = useState<'ownerUserId' | 'assigneeUserId'>('assigneeUserId')
  const [selected, setSelected] = useState<string[]>([])
  const cache = useQueryClient()
  const realtime = features?.features?.some((f) => f === 'PRESENCE' || f === 'FOLLOW') === true
  useRealtimeChannel(`record:${table.name}:${pk}`, undefined, realtime)
  useRealtimeChannel('user:me', undefined, available)
  const presence = useCollaborationPresence(
    table.name,
    pk,
    false,
    undefined,
    available && features?.features?.includes('PRESENCE')
  )
  const summary = useQuery({
    queryKey: queryKeys.collaborationResource(table.name, pk, 'features'),
    queryFn: () => getRecordFeatures(target),
    enabled: available && !!features,
  })
  const assignment = useMutation({
    mutationFn: () => putAssignment(target, { [role]: selected[0] ?? null }),
    onSuccess: () => {
      setAssign(false)
      void cache.invalidateQueries({ queryKey: queryKeys.collaborationRecord(table.name, pk) })
      void cache.invalidateQueries({ queryKey: queryKeys.tableRecord(table.name, pk) })
      void cache.invalidateQueries({ queryKey: queryKeys.collaborationMyWork() })
    },
  })
  const ownerField = features?.ownership?.ownerFieldName
  const assigneeField = features?.ownership?.assigneeFieldName
  const owner = ownerField
    ? (record.displayValues?.[ownerField] ?? record.values[ownerField])
    : summary.data?.owner
  const assignee = assigneeField
    ? (record.displayValues?.[assigneeField] ?? record.values[assigneeField])
    : summary.data?.assignee
  const capabilities = summary.data?.capabilities ?? features?.capabilities
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
      data-qqq-id="record-collaboration-header"
    >
      {presence.viewers.length > 0 && <PresenceAvatars viewers={presence.viewers} />}
      {(owner != null || assignee != null) && (
        <dl className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {owner != null && (
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="break-words">{String(owner)}</dd>
            </div>
          )}
          {assignee != null && (
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Assignee</dt>
              <dd className="break-words">{String(assignee)}</dd>
            </div>
          )}
        </dl>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {available && capabilities?.assign === true && (
          <button
            type="button"
            className={collaborationButton}
            onClick={() => setAssign(true)}
            data-qqq-id="record-assign"
          >
            Assign
          </button>
        )}
        {available && features?.features?.includes('SHARING') && (
          <button
            type="button"
            className={collaborationButton}
            onClick={() => setShare(true)}
            data-qqq-id="record-share"
          >
            Share
          </button>
        )}
      </div>
      {share && (
        <Share
          record={target}
          canShare={capabilities?.share === true}
          onClose={() => setShare(false)}
        />
      )}
      {assign && (
        <CollaborationDialog title="Assign record" open onOpenChange={setAssign}>
          <label className="block">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className={collaborationButton}
              data-qqq-id="assignment-role"
            >
              <option value="assigneeUserId">Assignee</option>
              <option value="ownerUserId">Owner</option>
            </select>
          </label>
          <PeoplePicker record={target} selected={selected} onChange={setSelected} requireRead />
          <button
            className={collaborationButton}
            disabled={assignment.isPending || !selected.length}
            onClick={() => assignment.mutate()}
            data-qqq-id="assignment-save"
          >
            Assign
          </button>
          {assignment.isError && <p role="alert">{assignment.error.message}</p>}
        </CollaborationDialog>
      )}
    </div>
  )
}
/** Table view lease and people count.
 * @param props - Table metadata.
 * @returns Count and avatars.
 */
export function TablePresence({ table, available }: { table: QTableMetaData; available: boolean }) {
  const enabled = available && table.recordFeatures?.features?.includes('PRESENCE') === true
  useRealtimeChannel(`table:${table.name}`)
  useRealtimeChannel('user:me', undefined, available)
  const presence = useCollaborationPresence(table.name, undefined, false, undefined, enabled)
  if (!enabled) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-qqq-id="table-presence">
      <PresenceAvatars viewers={presence.viewers} />
      <span>{presence.viewers.length} people viewing</span>
    </div>
  )
}
