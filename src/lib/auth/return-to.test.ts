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

import { describe, expect, it } from 'vitest'
import { safeReturnTo } from './return-to'

const ORIGIN = 'https://qqq.example'

describe('safeReturnTo (open-redirect guard, QRun-IO/qqq#669)', () => {
  it('keeps in-app paths with their query and hash, without decoding them again', () => {
    expect(safeReturnTo('/app/person?filter=%7B%22a%22%3A1%7D#top', ORIGIN)).toBe('/app/person?filter=%7B%22a%22%3A1%7D#top')
  })

  it.each([
    'https://evil.example/steal',
    '//evil.example/steal',
    '/\\evil.example',
    'javascript:alert(1)',
    'app/person',
    '',
  ])('rejects %j', (value) => {
    expect(safeReturnTo(value, ORIGIN)).toBe('/')
  })

  it('never returns to the sign-in pages themselves', () => {
    expect(safeReturnTo('/login?returnTo=%2Fapp', ORIGIN)).toBe('/')
    expect(safeReturnTo('/token?code=x', ORIGIN)).toBe('/')
    expect(safeReturnTo('/callback', ORIGIN, '/app')).toBe('/app')
  })

  it('uses the fallback for missing values', () => {
    expect(safeReturnTo(null, ORIGIN, '/app')).toBe('/app')
  })
})
