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
 * @file use-media-query — whether a CSS media query matches, kept in sync with the viewport.
 */
'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** The phone layout breakpoint: below Tailwind's `md` (768 px). */
export const PHONE_MEDIA_QUERY = '(max-width: 767px)'

/**
 * Tracks a media query, so a component can mount only the layout that is shown
 * instead of rendering every layout and hiding the others with CSS.
 *
 * @param query - A media query, for example {@link PHONE_MEDIA_QUERY}.
 * @returns Whether the query matches; `false` when rendering without a window.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const list = mediaQueryList(query)
    list?.addEventListener?.('change', onChange)
    return () => list?.removeEventListener?.('change', onChange)
  }, [query])
  return useSyncExternalStore(subscribe, () => mediaQueryList(query)?.matches ?? false, () => false)
}

/**
 * The media query list, when the environment supports `matchMedia`.
 *
 * @param query - A media query.
 * @returns The list, or undefined without `matchMedia` (some embedded and test environments).
 */
function mediaQueryList(query: string): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function' ? (window.matchMedia(query) ?? undefined) : undefined
}
