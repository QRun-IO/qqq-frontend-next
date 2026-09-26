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
 * @file HoverTooltip — an accessible hover/focus tooltip for widget headers.
 */
'use client'

import React, { useId, useLayoutEffect, useRef, useState } from 'react'

/** Gap in px kept between an open tooltip and the viewport edge. */
const VIEWPORT_MARGIN = 8

/** Props accepted by {@link HoverTooltip}. */
interface HoverTooltipProps {
  /** Tooltip content (text or sanitized HTML element). */
  content: React.ReactNode
  /** The element the tooltip describes; wrapped in a focusable span. */
  children: React.ReactNode
  /** `data-qqq-id` of the tooltip element. */
  qqqId?: string
}

/**
 * Shows `content` in a `role="tooltip"` element while the trigger is hovered or
 * focused, or after it is tapped on a touch screen (where the trigger is a 44 px
 * target); the trigger references it with `aria-describedby`. It stays open while
 * any of these holds, so the pointer leaving a focused trigger (for example after
 * the layout moves it from under a resting pointer) does not hide it. Escape hides
 * it; so do the pointer leaving and focus leaving once neither still holds. The
 * open tooltip stays inside the viewport.
 *
 * @param props - See {@link HoverTooltipProps}.
 * @returns The trigger with its tooltip.
 */
export function HoverTooltip({ content, children, qqqId }: HoverTooltipProps) {
  const id = useId()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  // a tap where the browser does not focus the trigger
  const [tapped, setTapped] = useState(false)
  const open = hovered || focused || tapped
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)

  ///////////////////////////////////////////////////////////////////
  // keep an open tooltip inside the viewport (a phone is narrower  //
  // than the space to the right of a trigger near its edge)        //
  ///////////////////////////////////////////////////////////////////
  useLayoutEffect(() => {
    let next = 0
    if (open && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect()
      const overflow = rect.right + shift - (document.documentElement.clientWidth - VIEWPORT_MARGIN)
      if (overflow > 0) next = Math.min(overflow, Math.max(0, rect.left + shift - VIEWPORT_MARGIN))
    }
    if (next !== shift) setShift(next)
  }, [open, shift])

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setTapped(false) }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        setHovered(false)
        setFocused(false)
        setTapped(false)
      }}
    >
      {/* a tap focuses and clicks the trigger: both open the tooltip; tapping elsewhere (blur) closes it */}
      <span
        tabIndex={0}
        aria-describedby={id}
        onClick={() => setTapped(true)}
        className="inline-flex items-center rounded focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
        data-tooltip-trigger=""
      >
        {children}
      </span>
      <span
        ref={tooltipRef}
        id={id}
        role="tooltip"
        data-qqq-id={qqqId}
        hidden={!open}
        style={shift ? { transform: `translateX(-${shift}px)` } : undefined}
        className="absolute left-0 top-full z-50 mt-1 w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-md border border-border bg-popover px-3 py-2 text-xs font-normal text-popover-foreground shadow-md"
      >
        {content}
      </span>
    </span>
  )
}
