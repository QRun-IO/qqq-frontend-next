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
import { useContext, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import type { PresenceSnapshot, PresenceViewer } from '@/types/collaboration'
import {
  openPresenceLease,
  renewPresence,
  leavePresence,
  getPresence,
  beaconPresence,
} from '@/lib/api/collaboration'
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
  const focus = useRef({ editing, fieldName })
  focus.current = { editing, fieldName }
  const refresh = useRef<() => void>(() => undefined)
  const [ended, setEnded] = useState(false)
  const [renewalFailed, setRenewalFailed] = useState(false)
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
      if (
        event === 'session-ended' ||
        (event === 'channel-revoked' &&
          data.channel === (pk ? `record:${table}:${pk}` : `table:${table}`))
      ) {
        setEnded(true)
        cache.setQueryData(key, { table, pk, viewers: [] })
      }
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
    let active = true
    let visible = document.visibilityState !== 'hidden'
    let connectionId: string | undefined
    let sequence = 0
    let generation = 0
    let opening = false
    const heartbeat = async (rejoining = false) => {
      if (!active || !visible || opening) return
      const requestGeneration = generation
      let requestSequence = sequence
      try {
        if (!connectionId) {
          opening = true
          const lease = await openPresenceLease({ table, pk })
          if (!active || !visible || generation !== requestGeneration) {
            void leavePresence({ table, pk, connectionId: lease.connectionId, sequence: 1 }).catch(
              () => undefined
            )
            return
          }
          opening = false
          connectionId = lease.connectionId
          sequence = 0
        }
        requestSequence = ++sequence
        const snapshot = await renewPresence({
          table,
          pk,
          connectionId,
          sequence: requestSequence,
          mode: focus.current.editing ? 'EDITING' : 'VIEWING',
          fieldName: focus.current.fieldName,
        })
        if (active && visible && generation === requestGeneration && sequence === requestSequence) {
          setRenewalFailed(false)
          cache.setQueryData(queryKeys.collaborationResource(table, pk ?? '', 'presence'), snapshot)
        }
      } catch (error) {
        if (!active || !visible || generation !== requestGeneration || sequence !== requestSequence)
          return
        opening = false
        setRenewalFailed(true)
        if (
          isAxiosError(error) &&
          error.response?.status === 409 &&
          error.response.data?.code === 'PRESENCE_LEASE_EXPIRED'
        ) {
          connectionId = undefined
          generation++
          if (!rejoining) void heartbeat(true)
        }
      }
    }
    refresh.current = () => {
      void heartbeat()
    }
    void heartbeat()
    const timer = setInterval(() => {
      void heartbeat()
    }, 20000)
    const release = (beacon: boolean) => {
      generation++
      opening = false
      const previous = connectionId
      connectionId = undefined
      if (!previous) return
      const input = { table, pk, connectionId: previous, sequence: ++sequence }
      if (beacon)
        beaconPresence({
          ...input,
          mode: focus.current.editing ? 'EDITING' : 'VIEWING',
          fieldName: focus.current.fieldName,
        })
      else void leavePresence(input).catch(() => undefined)
    }
    const hide = () => {
      visible = false
      release(true)
    }
    const show = () => {
      visible = document.visibilityState !== 'hidden'
      void heartbeat()
    }
    const visibility = () => (document.visibilityState === 'hidden' ? hide() : show())
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      active = false
      release(false)
      refresh.current = () => undefined
      clearInterval(timer)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [table, pk, enabled, ended, cache])
  useEffect(() => {
    refresh.current()
  }, [editing, fieldName])
  return {
    ...query,
    unavailable: enabled && !ended && (query.isError || renewalFailed),
    viewers:
      enabled && !ended && !query.isError && !renewalFailed
        ? otherViewers(query.data?.viewers ?? [], userId)
        : [],
  }
}
