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

/** @file Authenticated realtime transport; shares the existing incremental SSE parser. */
import apiClient, { CLIENT_CHANNEL_HEADER, userTimeZoneHeader } from './client'
import { anyAbortSignal } from '@/lib/utils/abort'
import { SseParser, type SseEvent } from './sse-parser'

/** Reads named events until disconnect or abort.
 * @param signal - Stream lifetime.
 * @param lastEventId - Replay cursor.
 * @param receive - Event consumer.
 * @returns Stream completion.
 */
export async function readRealtimeStream(
  signal: AbortSignal,
  lastEventId: string,
  receive: (event: SseEvent) => void
) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL || '/qqq/v1'}/realtime/stream`,
    {
      // the session's signal too: logout ends the stream before its response can land
      signal: anyAbortSignal([signal, apiClient.sessionSignal()]),
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream',
        ...CLIENT_CHANNEL_HEADER,
        ...userTimeZoneHeader(),
        ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
      },
    }
  )
  if (response.status === 401) {
    apiClient.notifyUnauthorized()
    receive({ event: 'session-ended', data: '{}' })
    return
  }
  if (!response.ok || !response.body) throw new Error('Realtime connection unavailable')
  const reader = response.body.getReader()
  const parser = new SseParser()
  const decoder = new TextDecoder()
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      if (done) break
      for (const event of parser.push(decoder.decode(value, { stream: true }))) receive(event)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
/** Updates the connection's channel set.
 * @param connectionId - Server-issued connection.
 * @param add - New channels.
 * @param remove - Released channels.
 * @returns Active and refused subscriptions.
 */
export const updateRealtimeSubscriptions = (
  connectionId: string,
  add: string[],
  remove: string[]
) =>
  apiClient.post<{ active: string[]; refused: string[] }>('/realtime/subscriptions', {
    connectionId,
    add,
    remove,
  })
