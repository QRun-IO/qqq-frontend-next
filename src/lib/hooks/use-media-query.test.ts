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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { PHONE_MEDIA_QUERY, useMediaQuery } from './use-media-query'

/** Installs a controllable matchMedia and returns a function that changes the match. */
function controllableMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  const original = window.matchMedia
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    get matches() { return matches },
    media,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia
  return {
    set(next: boolean) { matches = next; listeners.forEach((listener) => listener()) },
    listenerCount: () => listeners.size,
    restore() { window.matchMedia = original },
  }
}

describe('useMediaQuery', () => {
  let media: ReturnType<typeof controllableMatchMedia> | undefined
  afterEach(() => media?.restore())

  it('reports the current match and follows viewport changes', () => {
    media = controllableMatchMedia(false)
    const { result, unmount } = renderHook(() => useMediaQuery(PHONE_MEDIA_QUERY))
    expect(result.current).toBe(false)
    act(() => media!.set(true))
    expect(result.current).toBe(true)
    unmount()
    expect(media.listenerCount()).toBe(0)
  })
})
