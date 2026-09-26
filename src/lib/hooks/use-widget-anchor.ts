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
 * @file useWidgetAnchor — scrolls a dashboard to the widget named by the URL hash
 * (`#widgetName`; Material Dashboard gives each widget's grid item `id=widgetName`).
 */

'use client'

import { useEffect } from 'react'

import { useLocationHash } from './use-location-hash'

/** How long the dashboard keeps the anchored widget in view while widgets above it load. */
const SETTLE_MS = 3000

/**
 * When the URL hash names one of the dashboard's widgets, scrolls its grid item into view
 * (below the header, by the item's scroll margin) and keeps it there while the widgets load
 * and change the layout, until the user scrolls or the layout settles.
 *
 * @param widgetNames - Names of the widgets on the dashboard.
 */
export function useWidgetAnchor(widgetNames: string[]): void {
  const [hash] = useLocationHash()
  const names = widgetNames.join('\n')

  useEffect(() => {
    let name = hash.replace(/^#/, '')
    try {
      name = decodeURIComponent(name)
    } catch {
      // keep the raw hash
    }
    if (!name || !names.split('\n').includes(name)) return undefined
    const scroll = () => document.getElementById(name)?.scrollIntoView({ block: 'start' })
    scroll()
    const grid = document.getElementById(name)?.parentElement
    if (!grid || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => scroll())
    observer.observe(grid)
    const stop = () => observer.disconnect()
    const timer = window.setTimeout(stop, SETTLE_MS)
    const userEvents = ['wheel', 'touchstart', 'keydown'] as const
    userEvents.forEach((type) => window.addEventListener(type, stop, { once: true, passive: true }))
    return () => {
      stop()
      window.clearTimeout(timer)
      userEvents.forEach((type) => window.removeEventListener(type, stop))
    }
  }, [hash, names])
}
