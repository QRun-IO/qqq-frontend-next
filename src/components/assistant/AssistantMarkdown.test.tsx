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

// Markdown and streaming regressions for the owner's media breakdown.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AssistantMarkdown } from './AssistantMarkdown'
import { messageText, optimisticTurnMessages, reduceStreamEvent } from './message-reducer'
import { SseParser } from '@/lib/api/sse-parser'
import { toAssistantEvent } from '@/lib/api/assistant'

const ANSWER = 'Here is the breakdown:\n\n| Type | Count |\n|---|---|\n| JPEG (image/jpeg) | 81 |\n| PNG (image/png) | 20 |\n| WebP, GIF, SVG | 0 |\n\nYou can open the lists filtered by JPEG or PNG.'

describe('AssistantMarkdown', () => {
  it.each([false, true])('renders the exact answer as a table (streamed: %s)', (streamed) => {
    let text = ANSWER
    if (streamed) {
      const ids = { userId: -1, assistantId: -2 }
      let messages = optimisticTurnMessages('Count media', ids, '')
      for (let offset = 0; offset < ANSWER.length; offset += 7) {
        messages = reduceStreamEvent(messages, { type: 'text.delta', seq: offset + 1, messageId: -2, text: ANSWER.slice(offset, offset + 7) }, ids)
      }
      text = messageText(messages[1])
      expect(text).toBe(ANSWER)
    }
    render(<AssistantMarkdown text={text} />)
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(within(rows[0]).getAllByRole('columnheader')).toHaveLength(2)
    rows.slice(1).forEach((row) => expect(within(row).getAllByRole('cell')).toHaveLength(2))
    expect(within(table).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['JPEG (image/jpeg)', '81', 'PNG (image/png)', '20', 'WebP, GIF, SVG', '0'])
  })

  it('renders headings, lists, soft breaks, strikethrough and disabled task inputs', () => {
    const { container } = render(<AssistantMarkdown text={'# Heading\n\n- First\n- Second\n\nLine one\nLine two\n\n~~Removed~~\n\n- [x] Done'} />)
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    expect(screen.getAllByRole('list')[0].tagName).toBe('UL')
    expect(container.querySelector('p br')).toBeInTheDocument()
    expect(container.querySelector('del')).toHaveTextContent('Removed')
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('preserves GFM numeric alignment while still blocking HTML and image loads', () => {
    const { container } = render(<AssistantMarkdown text={'| Type | Count |\n|:---|---:|\n| JPEG | 81 |\n\n<script>alert(1)</script>\n\n![secret](https://evil.test/pixel)'} />)
    expect(screen.getByRole('columnheader', { name: 'Count' })).toHaveStyle({ textAlign: 'right' })
    expect(screen.getByRole('cell', { name: '81' })).toHaveStyle({ textAlign: 'right' })
    expect(container.querySelector('script, img')).toBeNull()
  })

  it('preserves multiline SSE data and escaped text newlines through API decoding', () => {
    const parser = new SseParser()
    const [frame] = parser.push('id: 1\nevent: text.delta\ndata: {"messageId":2,\ndata: "text":"first\\nsecond"}\n\n')
    expect(frame.data).toBe('{"messageId":2,\n"text":"first\\nsecond"}')
    expect(toAssistantEvent(frame).event).toEqual({ type: 'text.delta', seq: 1, messageId: 2, text: 'first\nsecond' })
  })
})
