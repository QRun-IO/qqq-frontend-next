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
import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useQContext } from '@/lib/context/q-context'
import { realtimeClient, type RealtimeChannel, type RealtimeEvent } from '@/lib/realtime/client'
import { invalidateRealtime } from '@/lib/realtime/invalidate'
const bridges = new WeakMap<QueryClient, { count: number; off: () => void }>()
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
  const { userId } = useQContext()
  const cache = useQueryClient()
  const callback = useRef(receive)
  callback.current = receive
  useEffect(() => {
    if (!enabled) return
    const client = realtimeClient(String(userId ?? 'anonymous'))
    let bridge = bridges.get(cache)
    if (!bridge) {
      bridge = { count: 0, off: client.onEvent((event) => invalidateRealtime(cache, event)) }
      bridges.set(cache, bridge)
    }
    bridge.count++
    const off = client.onEvent((event) => callback.current?.(event))
    const release = client.subscribe(channel)
    return () => {
      off()
      release()
      if (--bridge.count === 0) {
        bridge.off()
        bridges.delete(cache)
      }
    }
  }, [channel, enabled, userId, cache])
}
