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

// Tests for the resizable navigation's width limits, keyboard steps and persistence

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NAV_WIDTH_DEFAULT,
  NAV_WIDTH_KEY,
  NAV_WIDTH_MAX,
  NAV_WIDTH_MIN,
  clampNavWidth,
  maxNavWidth,
  navWidthForKey,
  readNavWidth,
  writeNavWidth,
} from './nav-width'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('maxNavWidth', () => {
  it('is 480 px on a wide window', () => {
    expect(maxNavWidth(1920)).toBe(NAV_WIDTH_MAX)
  })

  it('is 40% of a narrower window', () => {
    expect(maxNavWidth(1024)).toBe(409)
  })

  it('never drops below the minimum', () => {
    expect(maxNavWidth(400)).toBe(NAV_WIDTH_MIN)
  })
})

describe('clampNavWidth', () => {
  it('keeps a width inside the limits', () => {
    expect(clampNavWidth(300, 1440)).toBe(300)
  })

  it('raises a width below the minimum', () => {
    expect(clampNavWidth(120, 1440)).toBe(NAV_WIDTH_MIN)
  })

  it('lowers a width above the maximum for the viewport', () => {
    expect(clampNavWidth(900, 1440)).toBe(NAV_WIDTH_MAX)
    expect(clampNavWidth(470, 1024)).toBe(409)
  })

  it('rounds fractional widths and falls back to the default for non-numbers', () => {
    expect(clampNavWidth(300.6, 1440)).toBe(301)
    expect(clampNavWidth(NaN, 1440)).toBe(NAV_WIDTH_DEFAULT)
  })
})

describe('navWidthForKey', () => {
  it('steps 16 px with the arrows and 64 px with Shift', () => {
    expect(navWidthForKey('ArrowRight', false, 256, 1440)).toBe(272)
    expect(navWidthForKey('ArrowLeft', false, 256, 1440)).toBe(240)
    expect(navWidthForKey('ArrowRight', true, 256, 1440)).toBe(320)
    expect(navWidthForKey('ArrowLeft', true, 256, 1440)).toBe(200)
  })

  it('stops at the limits', () => {
    expect(navWidthForKey('ArrowLeft', true, 210, 1440)).toBe(NAV_WIDTH_MIN)
    expect(navWidthForKey('ArrowRight', true, 470, 1440)).toBe(NAV_WIDTH_MAX)
  })

  it('jumps to the minimum with Home and the maximum with End', () => {
    expect(navWidthForKey('Home', false, 300, 1440)).toBe(NAV_WIDTH_MIN)
    expect(navWidthForKey('End', false, 300, 1440)).toBe(NAV_WIDTH_MAX)
    expect(navWidthForKey('End', false, 300, 1024)).toBe(409)
  })

  it('ignores other keys', () => {
    expect(navWidthForKey('Enter', false, 300, 1440)).toBeNull()
    expect(navWidthForKey('ArrowUp', false, 300, 1440)).toBeNull()
  })
})

describe('persistence', () => {
  it('reads nothing when no width is stored', () => {
    expect(readNavWidth()).toBeNull()
  })

  it('stores and reads back a width', () => {
    writeNavWidth(333)
    expect(localStorage.getItem(NAV_WIDTH_KEY)).toBe('333')
    expect(readNavWidth()).toBe(333)
  })

  it('forgets the width when cleared', () => {
    writeNavWidth(333)
    writeNavWidth(null)
    expect(localStorage.getItem(NAV_WIDTH_KEY)).toBeNull()
    expect(readNavWidth()).toBeNull()
  })

  it('ignores a corrupt stored value', () => {
    localStorage.setItem(NAV_WIDTH_KEY, 'wide')
    expect(readNavWidth()).toBeNull()
    localStorage.setItem(NAV_WIDTH_KEY, '-5')
    expect(readNavWidth()).toBeNull()
  })

  it('does not throw when storage is unavailable', () => {
    localStorage.setItem(NAV_WIDTH_KEY, '300')
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new Error('denied') })
    expect(readNavWidth()).toBeNull()
    expect(() => writeNavWidth(320)).not.toThrow()
    expect(() => writeNavWidth(null)).not.toThrow()
  })
})
