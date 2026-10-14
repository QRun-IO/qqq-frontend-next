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
 * @file useStreamAnnouncer — screen reader announcements for a streaming reply, throttled to
 * whole sentences (at most one announcement per interval) and the rest on completion, instead
 * of every token.
 */

'use client'

import { useEffect, useRef, useState } from 'react'

import type { AssistantMessage } from '@/types/assistant'
import { messageText } from './message-reducer'

/** Minimum time between two announcements while text streams. */
export const ANNOUNCE_INTERVAL_MS = 1500

/**
 * The length of `text` up to and including its last sentence end (`.`, `!`, `?` or a line
 * break, followed by whitespace or the end).
 *
 * @param text - Text not yet announced.
 * @returns The length to announce, 0 when no sentence is complete.
 */
export function completeSentenceLength(text: string): number {
  let end = 0
  const pattern = /[.!?](?=\s|$)|\n/g
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) end = match.index + 1
  return end
}

/**
 * Tracks the latest assistant reply and returns the text to put in a polite live region.
 *
 * @param messages - The visible conversation's messages.
 * @returns The current announcement.
 */
export function useStreamAnnouncer(messages: AssistantMessage[]): string {
  const [announcement, setAnnouncement] = useState('')
  const [tick, setTick] = useState(0)
  const state = useRef<{ id: number | null; spoken: number; at: number; streaming: boolean }>({ id: null, spoken: 0, at: 0, streaming: false })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  useEffect(() => {
    const reply = [...messages].reverse().find((message) => message.role === 'ASSISTANT')
    if (!reply) return
    const current = state.current
    const text = messageText(reply)
    if (current.id !== reply.id) {
      // a new reply (or the temporary id replaced by the server's): keep what was already spoken
      const continued = current.streaming && reply.status !== 'COMPLETE' && text.length >= current.spoken
      state.current = { id: reply.id, spoken: continued ? current.spoken : 0, at: continued ? current.at : 0, streaming: reply.status === 'STREAMING' }
    }
    const tracked = state.current
    if (reply.status === 'STREAMING') {
      tracked.streaming = true
      const pending = text.slice(tracked.spoken)
      const length = completeSentenceLength(pending)
      if (!length) return
      const wait = tracked.at + ANNOUNCE_INTERVAL_MS - Date.now()
      if (wait > 0) {
        if (!timer.current) timer.current = setTimeout(() => { timer.current = null; setTick((value) => value + 1) }, wait)
        return
      }
      tracked.spoken += length
      tracked.at = Date.now()
      setAnnouncement(pending.slice(0, length).trim())
      return
    }
    if (!tracked.streaming) return
    // finished: announce the rest, or how it ended
    tracked.streaming = false
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const rest = text.slice(tracked.spoken).trim()
    tracked.spoken = text.length
    if (reply.status === 'CANCELLED') setAnnouncement(rest ? `${rest} Stopped.` : 'Stopped.')
    else if (reply.status === 'ERROR') setAnnouncement('The reply did not finish.')
    else setAnnouncement(rest || 'Reply complete.')
  }, [messages, tick])

  return announcement
}
