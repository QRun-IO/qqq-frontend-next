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
 * @file NavResizeHandle — the drag handle on the desktop navigation's right edge that sets its
 * width: pointer drag, double-click to reset, and arrow/Home/End keys as a focusable separator.
 */

'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  NAV_WIDTH_DEFAULT,
  NAV_WIDTH_MIN,
  NAV_WIDTH_VAR,
  clampNavWidth,
  maxNavWidth,
  navWidthForKey,
  readNavWidth,
  writeNavWidth,
} from '@/lib/utils/nav-width'

/** Props for {@link NavResizeHandle}. */
export interface NavResizeHandleProps {
  /** Id of the resized navigation, for `aria-controls`. */
  controls?: string
}

/** An in-progress drag: where it started and the width waiting for the next animation frame. */
interface Drag {
  startX: number
  startWidth: number
  next: number
  frame: number
}

/**
 * The navigation's resize handle, a vertical `separator` straddling its parent panel's right
 * border. It sets the panel's width through the {@link NAV_WIDTH_VAR} custom property.
 *
 * While dragging, the width is written to a CSS custom property once per animation frame, so
 * the page reflows without a React render per pixel; the chosen width is remembered in
 * localStorage when the drag ends. The stored width is applied before the first paint.
 *
 * @param props - Component properties.
 * @returns The focusable handle element.
 */
export function NavResizeHandle({ controls }: NavResizeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [width, setWidth] = useState(NAV_WIDTH_DEFAULT)
  const [max, setMax] = useState(() => maxNavWidth(typeof window === 'undefined' ? 1920 : window.innerWidth))

  /**
   * The resized panel: the handle's parent (read from the handle's own ref, which is attached
   * before this component's layout effect runs, unlike a ref on the parent).
   *
   * @returns The panel element, or `null` before mount.
   */
  const panel = () => handleRef.current?.parentElement ?? null

  /**
   * The panel's rendered width.
   *
   * @returns Width in px (0 while hidden, below the desktop breakpoint).
   */
  const measure = () => Math.round(panel()?.getBoundingClientRect().width ?? 0)

  /**
   * Shows a width (or the default, for `null`) and, unless only previewing, remembers it.
   *
   * @param next - Width in px, or `null` for the default.
   * @param persist - Whether to store it.
   */
  const apply = (next: number | null, persist = true) => {
    const style = panel()?.style
    if (next === null) style?.removeProperty(NAV_WIDTH_VAR)
    else style?.setProperty(NAV_WIDTH_VAR, `${next}px`)
    if (persist) {
      writeNavWidth(next)
      setWidth(measure() || next || NAV_WIDTH_DEFAULT)
    }
  }

  // Restore the stored width before the first paint (no flash of the default width)
  useLayoutEffect(() => {
    const stored = readNavWidth()
    if (stored !== null) panel()?.style.setProperty(NAV_WIDTH_VAR, `${stored}px`)
    const shown = measure()
    if (shown) setWidth(shown)
    // Mount only: the stored width is read once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The maximum follows the window (the CSS clamps the width itself)
  useEffect(() => {
    const onResize = () => setMax(maxNavWidth(window.innerWidth))
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const startWidth = measure() || width
    drag.current = { startX: event.clientX, startWidth, next: startWidth, frame: 0 }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current) return
    current.next = clampNavWidth(current.startWidth + event.clientX - current.startX, window.innerWidth)
    if (current.frame) return
    current.frame = requestAnimationFrame(() => {
      current.frame = 0
      apply(current.next, false)
      handleRef.current?.setAttribute('aria-valuenow', String(current.next))
    })
  }

  const endDrag = () => {
    const current = drag.current
    if (!current) return
    drag.current = null
    cancelAnimationFrame(current.frame)
    if (current.next !== current.startWidth) apply(current.next)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const next = navWidthForKey(event.key, event.shiftKey, width, window.innerWidth)
    if (next === null) return
    event.preventDefault()
    apply(next)
  }

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize navigation"
      aria-controls={controls}
      aria-valuenow={Math.min(width, max)}
      aria-valuemin={NAV_WIDTH_MIN}
      aria-valuemax={max}
      tabIndex={0}
      title="Drag to resize; double-click to reset"
      className="group absolute inset-y-0 -right-1 z-10 flex w-2 cursor-col-resize touch-none justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={() => apply(null)}
      onKeyDown={onKeyDown}
      data-qqq-id="sidebar-resize-handle"
    >
      <span aria-hidden="true" className="h-full w-1 bg-transparent group-hover:bg-primary/40 group-focus-visible:bg-primary/60 group-active:bg-primary" />
    </div>
  )
}
