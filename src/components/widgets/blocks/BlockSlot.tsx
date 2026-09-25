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
 * @file BlockSlot — wraps one "slot" of a QQQ block with its optional link and tooltip.
 */
'use client'

import React, { createContext, useContext, useId } from 'react'
import Link from 'next/link'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import type { QqqBlockData, QqqBlockLink, QqqBlockTooltip, QqqCompositeData } from '../widget-types'
import { isPlainObject } from '../widget-types'
import { TOUCH_LINK } from '../widget-utils'

/**
 * Renders a nested composite (used for tooltips whose content is a composite).
 * Provided by `QqqComposite` so this module does not import it (no import cycle).
 */
export const NestedCompositeContext = createContext<((data: QqqCompositeData) => React.ReactNode) | null>(null)

/** Props accepted by {@link BlockSlot}. */
interface BlockSlotProps {
  /** The block whose link/tooltip maps are consulted. */
  block: QqqBlockData
  /** Slot name (e.g. `number`); empty for the whole block. */
  slot: string
  /** The slot's rendered content. */
  children: React.ReactNode
  /** Extra classes for the link element (e.g. full width for a progress bar). */
  linkClassName?: string
}

/**
 * Resolves the link and tooltip for a slot: the per-slot entries in `linkMap` /
 * `tooltipMap` (keyed by the upper-cased slot name) win over the block-level ones.
 *
 * @param block - The block.
 * @param slot - The slot name, or empty for the whole block.
 * @returns The effective link and tooltip.
 */
export function resolveSlot(block: QqqBlockData, slot: string): { link?: QqqBlockLink; tooltip?: QqqBlockTooltip } {
  const key = slot.toUpperCase()
  const slotLink = slot && isPlainObject(block.linkMap) ? block.linkMap[key] : undefined
  const slotTooltip = slot && isPlainObject(block.tooltipMap) ? block.tooltipMap[key] : undefined
  const link = isPlainObject(slotLink) ? slotLink : isPlainObject(block.link) ? block.link : undefined
  const tooltip = isPlainObject(slotTooltip) ? slotTooltip : isPlainObject(block.tooltip) ? block.tooltip : undefined
  return { link, tooltip }
}

/**
 * Maps a backend tooltip placement (e.g. `BOTTOM`) to a Radix side.
 *
 * @param placement - The serialized placement.
 * @returns The Radix side, defaulting to bottom.
 */
function tooltipSide(placement: unknown): 'top' | 'right' | 'bottom' | 'left' {
  const side = typeof placement === 'string' ? placement.toLowerCase() : ''
  return side === 'top' || side === 'right' || side === 'left' ? side : 'bottom'
}

/**
 * Wraps slot content with its link (internal paths use `next/link`, other URLs a
 * plain anchor) and its tooltip. The tooltip text is always the element's
 * accessible description (a hidden element referenced by `aria-describedby`) and
 * is shown visually in a Radix tooltip (`role="tooltip"`) on hover or focus. A
 * tooltip with `blockData` renders that composite as the tooltip content.
 *
 * @param props - See {@link BlockSlotProps}.
 * @returns The slot content, wrapped as needed.
 */
export function BlockSlot({ block, slot, children, linkClassName }: BlockSlotProps) {
  const renderNested = useContext(NestedCompositeContext)
  const descriptionId = useId()
  const { link, tooltip } = resolveSlot(block, slot)
  const slotAttribute = slot || 'block'

  const href = typeof link?.href === 'string' && link.href ? link.href : undefined
  const target = typeof link?.target === 'string' && link.target ? link.target : undefined
  const title = typeof tooltip?.title === 'string' && tooltip.title ? tooltip.title : undefined
  const nested = tooltip && isPlainObject(tooltip.blockData) ? tooltip.blockData : undefined
  const hasTooltip = Boolean(title || (nested && renderNested))

  const describedBy = hasTooltip && title ? descriptionId : undefined
  let content: React.ReactElement
  if (href) {
    const linkProps = {
      className: linkClassName ? `text-[#546E7A] ${TOUCH_LINK} ${linkClassName}` : `text-[#546E7A] ${TOUCH_LINK}`,
      target,
      rel: target === '_blank' ? 'noopener noreferrer' : undefined,
      'data-block-slot': slotAttribute,
      'aria-describedby': describedBy,
    }
    content = href.startsWith('/')
      ? <Link href={href} prefetch={false} {...linkProps}>{children}</Link>
      : <a href={href} {...linkProps}>{children}</a>
  } else if (hasTooltip) {
    content = (
      <span tabIndex={0} data-block-slot={slotAttribute} aria-describedby={describedBy} className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </span>
    )
  } else {
    return <span data-block-slot={slotAttribute}>{children}</span>
  }

  if (!hasTooltip) return content

  return (
    <>
      {title && <span id={descriptionId} hidden>{title}</span>}
      <TooltipPrimitive.Provider delayDuration={200}>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>{content}</TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side={tooltipSide(tooltip?.placement)}
              sideOffset={4}
              className="z-50 max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-md"
            >
              {nested && renderNested ? <div className="w-[200px]">{renderNested(nested)}</div> : title}
              <TooltipPrimitive.Arrow className="fill-border" />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    </>
  )
}
