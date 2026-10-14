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

// Tests for the incremental server-sent events parser

import { describe, expect, it } from 'vitest'

import { SseParser, type SseEvent } from './sse-parser'

/**
 * Feeds chunks to a new parser.
 *
 * @param chunks - Stream chunks.
 * @returns Every event dispatched.
 */
function parse(...chunks: string[]): SseEvent[] {
  const parser = new SseParser()
  return [...chunks.flatMap((chunk) => parser.push(chunk)), ...parser.end()]
}

const STREAM = 'id: 1\nevent: text.delta\ndata: {"seq":1,"text":"Hi"}\n\nid: 2\nevent: message.end\ndata: {"seq":2}\n\n'

describe('SseParser', () => {
  it('parses id, event and data fields', () => {
    expect(parse(STREAM)).toEqual([
      { event: 'text.delta', data: '{"seq":1,"text":"Hi"}', id: '1' },
      { event: 'message.end', data: '{"seq":2}', id: '2' },
    ])
  })

  it('gives the same events however the stream is split, including one character at a time', () => {
    const expected = parse(STREAM)
    expect(parse(...STREAM.split(''))).toEqual(expected)
    for (let cut = 1; cut < STREAM.length; cut++) {
      expect(parse(STREAM.slice(0, cut), STREAM.slice(cut))).toEqual(expected)
    }
  })

  it('accepts CRLF and CR line endings, also with the CR and LF in different chunks', () => {
    const crlf = STREAM.replace(/\n/g, '\r\n')
    expect(parse(crlf)).toEqual(parse(STREAM))
    expect(parse(...crlf.split(''))).toEqual(parse(STREAM))
    expect(parse(STREAM.replace(/\n/g, '\r'))).toEqual(parse(STREAM))
    expect(parse('data: a\r', '\n\r', '\n')).toEqual([{ event: 'message', data: 'a', id: undefined }])
  })

  it('joins multi-line data with newlines', () => {
    expect(parse('data: line one\ndata: line two\ndata:\n\n')).toEqual([
      { event: 'message', data: 'line one\nline two\n', id: undefined },
    ])
  })

  it('removes exactly one space after the colon and treats a line without a colon as a field name', () => {
    expect(parse('data:  two spaces\n\n')[0].data).toBe(' two spaces')
    expect(parse('data:none\n\n')[0].data).toBe('none')
    expect(parse('data\n\n')).toEqual([{ event: 'message', data: '', id: undefined }])
  })

  it('skips comment lines (keep-alives) and unknown fields', () => {
    expect(parse(': ping\nfoo: bar\ndata: x\n\n')).toEqual([{ event: 'message', data: 'x', id: undefined }])
  })

  it('does not dispatch an event without data, and resets the event type afterwards', () => {
    expect(parse('event: lonely\n\ndata: y\n\n')).toEqual([{ event: 'message', data: 'y', id: undefined }])
  })

  it('keeps the last event id across events and ignores ids containing NUL', () => {
    expect(parse('id: 7\ndata: a\n\ndata: b\n\nid: 8\0\ndata: c\n\n').map((event) => event.id)).toEqual(['7', '7', '7'])
  })

  it('reads retry only when it is all digits', () => {
    expect(parse('retry: 2500\ndata: a\n\nretry: soon\ndata: b\n\n')).toEqual([
      { event: 'message', data: 'a', id: undefined, retry: 2500 },
      { event: 'message', data: 'b', id: undefined },
    ])
  })

  it('drops a byte order mark at the start of the stream only', () => {
    expect(parse('﻿data: a\n\n')).toEqual([{ event: 'message', data: 'a', id: undefined }])
    expect(parse('', '﻿data: a\n\n')[0].data).toBe('a')
  })

  it('discards a final event that has no blank line', () => {
    expect(parse('data: complete\n\ndata: partial\n')).toEqual([{ event: 'message', data: 'complete', id: undefined }])
  })

  it('keeps unicode split across chunks intact once decoded', () => {
    const bytes = new TextEncoder().encode('data: héllo ✓\n\n')
    const decoder = new TextDecoder()
    const parser = new SseParser()
    const events = [...bytes].flatMap((byte) => parser.push(decoder.decode(new Uint8Array([byte]), { stream: true })))
    expect(events).toEqual([{ event: 'message', data: 'héllo ✓', id: undefined }])
  })
})
