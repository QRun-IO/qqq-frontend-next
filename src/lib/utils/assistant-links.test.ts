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

// Tests for assistant link safety and page context

import { describe, expect, it } from 'vitest'

import type { QInstance } from '@/types'
import { assistantPageInfo, internalAppHref } from './assistant-links'
import { readAssistantDeepLink } from './assistant-deep-link'
import { serializeFilter } from './filter-utils'

const ORIGIN = 'https://app.example.com'

describe('internalAppHref', () => {
  it.each([
    ['/app/person/1', '/app/person/1'],
    ['/app', '/app'],
    ['/app/person?filter=abc#audit', '/app/person?filter=abc#audit'],
    ['https://app.example.com/app/person/2', '/app/person/2'],
    ['  /app/person  ', '/app/person'],
  ])('keeps the same-origin app path %s', (href, expected) => {
    expect(internalAppHref(href, ORIGIN)).toBe(expected)
  })

  it.each([
    'https://evil.example.com/app/person',
    '//evil.example.com/app/person',
    '/\\evil.example.com/app',
    'javascript:alert(1)',
    'data:text/html,<script>',
    'mailto:a@b.c',
    '/admin',
    '/application',
    'app/person',
    '/app/person\u0000',
    '\u0001/app',
    '',
    '   ',
    'http://[::1',
  ])('refuses %s', (href) => {
    expect(internalAppHref(href, ORIGIN)).toBeNull()
  })

  it('refuses non-strings and defaults to the window origin', () => {
    expect(internalAppHref(undefined)).toBeNull()
    expect(internalAppHref(null)).toBeNull()
    expect(internalAppHref(`${window.location.origin}/app/x`)).toBe('/app/x')
  })
})

const META = {
  tables: {
    person: { name: 'person', label: 'People' },
  },
} as unknown as QInstance

describe('assistantPageInfo', () => {
  it('describes a table query screen', () => {
    expect(assistantPageInfo('/app/person', '', META)).toEqual({ context: { route: '/app/person', tableName: 'person' }, label: 'People' })
  })

  it('adds the query filter and marks the chip filtered', () => {
    const filter = serializeFilter({ criteria: [{ fieldName: 'status', operator: 'EQUALS', values: ['Active'] }], booleanOperator: 'AND' })
    const info = assistantPageInfo('/app/person', `?filter=${encodeURIComponent(filter)}`, META)
    expect(info?.label).toBe('People (filtered)')
    expect(info?.context.filter).toMatchObject({ criteria: [{ fieldName: 'status', operator: 'EQUALS', values: ['Active'] }], booleanOperator: 'AND' })
  })

  it('ignores an empty filter and treats a saved view as the table', () => {
    const empty = serializeFilter({ criteria: [] })
    expect(assistantPageInfo('/app/person', `?filter=${empty}`, META)?.label).toBe('People')
    expect(assistantPageInfo('/app/person/savedView/3', '', META)?.context).toEqual({ route: '/app/person/savedView/3', tableName: 'person' })
  })

  it('describes a record screen, with the record label when known', () => {
    expect(assistantPageInfo('/app/person/7', '', META)).toEqual({ context: { route: '/app/person/7', tableName: 'person', recordId: '7' }, label: 'People #7' })
    expect(assistantPageInfo('/app/person/7/edit', '', META, 'Alice')?.label).toBe('Alice (People)')
  })

  it('describes other table screens by the table only', () => {
    expect(assistantPageInfo('/app/person/create', '', META)).toEqual({ context: { route: '/app/person/create', tableName: 'person' }, label: 'People' })
  })

  it('returns null away from table screens', () => {
    expect(assistantPageInfo('/app', '', META)).toBeNull()
    expect(assistantPageInfo('/login', '', META)).toBeNull()
    expect(assistantPageInfo('/app/crm', '', META)).toBeNull()
    expect(assistantPageInfo('/app/person', '', undefined)).toBeNull()
    expect(assistantPageInfo('/app/%E0%A4%A', '', META)).toBeNull()
  })
})

describe('readAssistantDeepLink', () => {
  it('reads the prompt and strips both parameters, keeping the others', () => {
    expect(readAssistantDeepLink('?assistant=open&assistantPrompt=Tell%20me%20about%20this%20record.&tab=2'))
      .toEqual({ prompt: 'Tell me about this record.', remainingSearch: '?tab=2' })
    expect(readAssistantDeepLink('assistant=open')).toEqual({ prompt: '', remainingSearch: '' })
  })

  it('ignores a missing or different assistant parameter', () => {
    expect(readAssistantDeepLink('')).toBeNull()
    expect(readAssistantDeepLink('?assistant=close&assistantPrompt=x')).toBeNull()
  })
})
