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

/** @file Ephemeral presence leases with focus changes, polling fallback and realtime refresh. */
'use client'
import { useContext, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PresenceSnapshot, PresenceViewer } from '@/types/collaboration'
import { renewPresence, leavePresence, getPresence, beaconPresence } from '@/lib/api/collaboration'
import { queryKeys } from '@/lib/query-client'
import { QContext } from '@/lib/context/q-context'
import { useRealtimeChannel } from './use-realtime-channel'

/** Deduplicates tabs, excludes the current user, and prefers editing leases.
 * @param viewers - Snapshot entries.
 * @param userId - Current identity.
 * @returns Other people.
 */
export function otherViewers(viewers: PresenceViewer[], userId?: string) {
  const merged = new Map<string, PresenceViewer>()
  for (const viewer of viewers)
    if (viewer.userId !== userId && (!merged.has(viewer.userId) || viewer.mode === 'EDITING'))
      merged.set(viewer.userId, viewer)
  return [...merged.values()]
}
/** Owns a per-mounted-surface lease, distinct from the shared SSE connection.
 * @param table - Parent table.
 * @param pk - Optional record.
 * @param editing - Form open.
 * @param fieldName - Focused form field.
 * @param enabled - PRESENCE is installed and enabled.
 * @returns Other viewers and query state.
 */
export function useCollaborationPresence(
  table: string,
  pk?: string,
  editing = false,
  fieldName?: string,
  enabled = true
) {
  const [connectionId] = useState(() => crypto.randomUUID())
  const [ended, setEnded] = useState(false)
  const userId = useContext(QContext)?.userId
  const cache = useQueryClient()
  const key = queryKeys.collaborationResource(table, pk ?? '', 'presence')
  const query = useQuery({
    queryKey: key,
    queryFn: () => getPresence({ table, pk }),
    enabled: enabled && !ended,
    refetchInterval: 20000,
  })
  useRealtimeChannel(
    pk ? `record:${table}:${pk}` : `table:${table}`,
    ({ event, data }) => {
      if (event === 'session-ended') setEnded(true)
      if (
        event === 'presence.changed' &&
        data.table === table &&
        String(data.pk ?? '') === (pk ?? '') &&
        Array.isArray(data.viewers)
      )
        cache.setQueryData(key, data as unknown as PresenceSnapshot)
    },
    enabled && !ended
  )
  useEffect(() => {
    if (!enabled || ended) return
    const input = {
      connectionId,
      table,
      pk,
      mode: editing ? ('EDITING' as const) : ('VIEWING' as const),
      fieldName,
    }
    const heartbeat = () => {
      void renewPresence(input)
        .then((snapshot) =>
          cache.setQueryData(queryKeys.collaborationResource(table, pk ?? '', 'presence'), snapshot)
        )
        .catch(() => undefined)
    }
    heartbeat()
    const timer = setInterval(heartbeat, 20000)
    const hide = () => beaconPresence(input)
    window.addEventListener('pagehide', hide)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', hide)
    }
  }, [connectionId, table, pk, editing, fieldName, enabled, ended, cache])
  useEffect(() => {
    if (!enabled || ended) return
    return () => {
      void leavePresence({ connectionId, table, pk }).catch(() => undefined)
    }
  }, [connectionId, table, pk, enabled, ended])
  return { ...query, viewers: otherViewers(query.data?.viewers ?? [], userId) }
}
