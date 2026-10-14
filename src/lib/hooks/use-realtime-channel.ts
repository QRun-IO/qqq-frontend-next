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

/** @file Lazy realtime subscription hooks. Import only from feature chunks. */
'use client'
import { useContext, useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { QContext } from '@/lib/context/q-context'
import {
  realtimeClient,
  type RealtimeChannel,
  type RealtimeClient,
  type RealtimeEvent,
} from '@/lib/realtime/client'
import { invalidateRealtime } from '@/lib/realtime/invalidate'
/** One cache-invalidation bridge per (realtime client, query cache), shared by every hook. */
const bridges = new WeakMap<RealtimeClient, Map<QueryClient, { count: number; off: () => void }>>()
/** Retains the bridge that applies realtime hints to the cache.
 * @param client - Session realtime client.
 * @param cache - Query cache.
 * @returns Release.
 */
function retainBridge(client: RealtimeClient, cache: QueryClient) {
  let byCache = bridges.get(client)
  if (!byCache) bridges.set(client, (byCache = new Map()))
  let bridge = byCache.get(cache)
  if (!bridge) {
    bridge = { count: 0, off: client.onEvent((event) => invalidateRealtime(cache, event)) }
    byCache.set(cache, bridge)
  }
  const retained = bridge
  retained.count++
  return () => {
    if (--retained.count === 0) {
      retained.off()
      byCache.delete(cache)
    }
  }
}
/** Retains one channel and forwards its hints to the cache and optional consumer.
 * @param channel - Record, table or current user channel.
 * @param receive - Optional event listener.
 * @param enabled - Whether the feature is mounted and available.
 */
export function useRealtimeChannel(
  channel: RealtimeChannel,
  receive?: (event: RealtimeEvent) => void,
  enabled = true
) {
  const userId = useContext(QContext)?.userId
  const cache = useQueryClient()
  const callback = useRef(receive)
  useEffect(() => {
    callback.current = receive
  })
  useEffect(() => {
    if (!enabled) return
    const client = realtimeClient(String(userId ?? 'anonymous'))
    const releaseBridge = retainBridge(client, cache)
    const off = client.onEvent((event) => callback.current?.(event))
    const release = client.subscribe(channel)
    return () => {
      off()
      release()
      releaseBridge()
    }
  }, [channel, enabled, userId, cache])
}
