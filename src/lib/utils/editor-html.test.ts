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

// Engine-neutral rich-text values (REC-020 in Firefox, #649)

import { describe, expect, it } from 'vitest'

import { normalizeEditorHtml } from './editor-html'

describe('normalizeEditorHtml', () => {
  it.each([
    ['Plain&nbsp;<b>Strong</b>', 'Plain <b>Strong</b>'],
    ['<b>Plain&nbsp;</b>Strong', '<b>Plain </b>Strong'],
    ['<b>Plain</b>&nbsp;Strong', '<b>Plain</b> Strong'],
    ['one&nbsp;two', 'one two'],
    ['one <i>two</i>', 'one <i>two</i>'],
  ])('replaces the editing space in %s', (input, expected) => {
    expect(normalizeEditorHtml(input)).toBe(expected)
  })

  it.each([
    'a&nbsp;&nbsp;b',
    '&nbsp;leading',
    'trailing&nbsp;',
    'line&nbsp;<br>next',
    '<p>&nbsp;</p>',
    'Plain <b>Strong</b>',
  ])('keeps meaningful non-breaking spaces in %s', (input) => {
    expect(normalizeEditorHtml(input)).toBe(input)
  })
})
