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

import React, { useId, useState } from 'react'

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
 * focused; the trigger references it with `aria-describedby`. Escape hides it.
 *
 * @param props - See {@link HoverTooltipProps}.
 * @returns The trigger with its tooltip.
 */
export function HoverTooltip({ content, children, qqqId }: HoverTooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}
    >
      <span tabIndex={0} aria-describedby={id} className="rounded focus:outline-none focus:ring-2 focus:ring-ring">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        data-qqq-id={qqqId}
        hidden={!open}
        className="absolute left-0 top-full z-50 mt-1 w-max max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-xs font-normal text-popover-foreground shadow-md"
      >
        {content}
      </span>
    </span>
  )
}
