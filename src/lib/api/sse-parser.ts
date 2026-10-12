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
 * @file sse-parser — incremental `text/event-stream` parser (WHATWG HTML "event stream
 * interpretation"): fed arbitrary text chunks, it emits complete events. `EventSource`
 * cannot POST, so streamed API responses are read with `fetch` and parsed here.
 */

/** One dispatched server-sent event. */
export interface SseEvent {
  /** The `event:` field, or `message` when absent. */
  event: string
  /** The `data:` lines joined with `\n`. */
  data: string
  /** The last `id:` seen on the stream (it persists across events), or `undefined`. */
  id?: string
  /** The `retry:` reconnection delay of this event, in milliseconds. */
  retry?: number
}

/**
 * Incremental SSE parser. Lines may end in `\n`, `\r\n` or `\r`, and chunks may split
 * anywhere, including between a `\r` and its `\n`. Comment lines (`:`) are skipped
 * (servers use them as keep-alives), and an event without data is not dispatched.
 */
export class SseParser {
  /** Text received but not yet ending in a line break. */
  private buffer = ''
  /** Whether the previous chunk ended with `\r` (its `\n` may start the next chunk). */
  private pendingCarriageReturn = false
  /** Whether the stream's first character has been seen (a leading BOM is dropped). */
  private started = false
  private dataLines: string[] = []
  private eventType = ''
  private lastEventId: string | undefined
  private retry: number | undefined

  /**
   * Parses one chunk of the stream.
   *
   * @param chunk - Decoded text, of any length.
   * @returns The events completed by this chunk, in order.
   */
  push(chunk: string): SseEvent[] {
    let text = chunk
    if (!this.started && text.length > 0) {
      this.started = true
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    }
    if (this.pendingCarriageReturn && text.startsWith('\n')) text = text.slice(1)
    this.pendingCarriageReturn = false

    const events: SseEvent[] = []
    this.buffer += text
    let start = 0
    for (let index = 0; index < this.buffer.length; index++) {
      const char = this.buffer[index]
      if (char !== '\n' && char !== '\r') continue
      const event = this.processLine(this.buffer.slice(start, index))
      if (event) events.push(event)
      if (char === '\r') {
        if (index + 1 === this.buffer.length) this.pendingCarriageReturn = true
        else if (this.buffer[index + 1] === '\n') index++
      }
      start = index + 1
    }
    this.buffer = this.buffer.slice(start)
    return events
  }

  /**
   * Ends the stream. A final event without its blank line is discarded, as the
   * specification requires.
   *
   * @returns Always empty; kept so callers can treat `end` like `push`.
   */
  end(): SseEvent[] {
    this.buffer = ''
    this.dataLines = []
    this.eventType = ''
    this.retry = undefined
    return []
  }

  /**
   * Applies one line to the pending event.
   *
   * @param line - The line without its terminator.
   * @returns The dispatched event when the line is blank and data is pending.
   */
  private processLine(line: string): SseEvent | null {
    if (line === '') return this.dispatch()
    if (line.startsWith(':')) return null
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    switch (field) {
      case 'data':
        this.dataLines.push(value)
        break
      case 'event':
        this.eventType = value
        break
      case 'id':
        if (!value.includes('\0')) this.lastEventId = value
        break
      case 'retry':
        if (/^\d+$/.test(value)) this.retry = Number(value)
        break
      default:
        break
    }
    return null
  }

  /**
   * Completes the pending event and resets the per-event fields.
   *
   * @returns The event, or null when no data line was received.
   */
  private dispatch(): SseEvent | null {
    const hasData = this.dataLines.length > 0
    const event: SseEvent = {
      event: this.eventType || 'message',
      data: this.dataLines.join('\n'),
      id: this.lastEventId,
      ...(this.retry !== undefined ? { retry: this.retry } : {}),
    }
    this.dataLines = []
    this.eventType = ''
    this.retry = undefined
    return hasData ? event : null
  }
}
