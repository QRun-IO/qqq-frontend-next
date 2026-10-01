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

// Tests for the Gravatar URL and its MD5 digest (RFC 1321 test vectors)

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { gravatarUrl, md5Hex } from './gravatar'

describe('md5Hex', () => {
  it.each([
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    ['12345678901234567890123456789012345678901234567890123456789012345678901234567890', '57edf4a22be3c955ac49da2e2107b67a'],
    ['The quick brown fox jumps over the lazy dog', '9e107d9d372bb6826bd81d3542a419d6'],
    ['user', 'ee11cbb19052e40b07aac0ca060c23ee'],
  ])('digests %j', (input, digest) => {
    expect(md5Hex(input)).toBe(digest)
  })

  it('matches Node crypto for UTF-8 text and every padding boundary', () => {
    for (const length of [54, 55, 56, 57, 63, 64, 65, 119, 120, 128]) {
      const text = 'x'.repeat(length)
      expect(md5Hex(text)).toBe(createHash('md5').update(text, 'utf8').digest('hex'))
    }
    for (const text of ['élève@exemple.fr', '日本', '\u{1F600} smile']) {
      expect(md5Hex(text)).toBe(createHash('md5').update(text, 'utf8').digest('hex'))
    }
  })
})

describe('gravatarUrl', () => {
  it('hashes the trimmed, lowercased email and adds the default-image setting', () => {
    expect(gravatarUrl(' Test@Example.com ')).toBe(`https://www.gravatar.com/avatar/${md5Hex('test@example.com')}`)
    expect(gravatarUrl('test@example.com', 'identicon')).toBe(`https://www.gravatar.com/avatar/${md5Hex('test@example.com')}?d=identicon`)
    expect(gravatarUrl(undefined, 'mp')).toBe('https://www.gravatar.com/avatar/ee11cbb19052e40b07aac0ca060c23ee?d=mp')
  })
})
