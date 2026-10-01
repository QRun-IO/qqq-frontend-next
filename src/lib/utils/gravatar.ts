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
 * @file gravatar — the Gravatar image URL for the signed-in user, as the Material dashboard
 * builds it (`https://www.gravatar.com/avatar/{md5(email)}?d={branding.gravatarDefault}`).
 * MD5 here only names an avatar image (Gravatar's key); it is not used for any security purpose.
 */

/** Per-round shift amounts of MD5. */
const SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]
/** MD5 round constants: floor(|sin(i + 1)| * 2^32). */
const CONSTANTS = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0)

/**
 * The MD5 digest of a string's UTF-8 bytes (RFC 1321).
 *
 * @param text - The input.
 * @returns The digest as 32 lowercase hex characters.
 */
export function md5Hex(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  const bitLength = bytes.length * 8
  view.setUint32(padded.length - 8, bitLength >>> 0, true)
  view.setUint32(padded.length - 4, Math.floor(bitLength / 2 ** 32), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) => view.getUint32(offset + index * 4, true))
    let a = a0
    let b = b0
    let c = c0
    let d = d0
    for (let step = 0; step < 64; step++) {
      let mixed: number
      let wordIndex: number
      if (step < 16) {
        mixed = (b & c) | (~b & d)
        wordIndex = step
      } else if (step < 32) {
        mixed = (d & b) | (~d & c)
        wordIndex = (5 * step + 1) % 16
      } else if (step < 48) {
        mixed = b ^ c ^ d
        wordIndex = (3 * step + 5) % 16
      } else {
        mixed = c ^ (b | ~d)
        wordIndex = (7 * step) % 16
      }
      mixed = (mixed + a + CONSTANTS[step] + words[wordIndex]) >>> 0
      a = d
      d = c
      c = b
      const shift = SHIFTS[(step >> 4) * 4 + (step % 4)]
      b = (b + ((mixed << shift) | (mixed >>> (32 - shift)))) >>> 0
    }
    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }
  return [a0, b0, c0, d0]
    .map((word) => Array.from({ length: 4 }, (_, index) => ((word >>> (index * 8)) & 0xff).toString(16).padStart(2, '0')).join(''))
    .join('')
}

/**
 * The Gravatar URL for a user, as Material builds it: the MD5 of the email (or of `user`
 * without one), with the instance's default-image setting.
 *
 * @param email - The user's email address.
 * @param gravatarDefault - `branding.gravatarDefault` (Gravatar's `d` parameter), if any.
 * @returns The image URL.
 */
export function gravatarUrl(email: string | undefined, gravatarDefault?: string): string {
  const hash = md5Hex((email || 'user').trim().toLowerCase())
  return `https://www.gravatar.com/avatar/${hash}${gravatarDefault ? `?d=${encodeURIComponent(gravatarDefault)}` : ''}`
}
