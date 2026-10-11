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
 * @file use-container-width — the live content width of an element, for layouts that adapt to
 * the space they are given (a panel, a card) rather than to the viewport.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Tracks an element's content-box width with a `ResizeObserver`.
 *
 * @returns A callback ref for the element and its width in CSS pixels; 0 until measured, and
 *   always 0 where `ResizeObserver` is unavailable (callers then keep their full layout).
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(): [(element: T | null) => void, number] {
  const [element, setElement] = useState<T | null>(null)
  const [width, setWidth] = useState(0)
  const ref = useCallback((node: T | null) => setElement(node), [])

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0)
      // ignore sub-pixel jitter so a re-layout cannot loop on its own size change
      setWidth((previous) => (Math.abs(previous - next) < 2 ? previous : next))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [ref, width]
}
