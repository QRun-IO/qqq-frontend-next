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
 * @file HintTooltip — a small tooltip for query-screen controls (hover, keyboard focus, or a
 * tap on touch screens), used for the basic-mode reasons, quick-filter and criteria hints and
 * evaluated date expressions.
 */

'use client'

import React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { useFocusSafeTooltip } from '@/lib/hooks/use-focus-safe-tooltip'

/**
 * Props for HintTooltip.
 */
interface HintTooltipProps {
  /** The tooltip body; no tooltip is rendered when empty. */
  content: React.ReactNode
  /** The trigger: one element that can hold focus (a button, or an element with tabIndex). */
  children: React.ReactElement
  /** data-qqq-id of the tooltip body. */
  'data-qqq-id'?: string
  /** Preferred side. */
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Wraps a control with a tooltip that opens on hover, on keyboard focus, and on a tap.
 *
 * @param root0 - Component properties.
 * @returns The control with its tooltip.
 */
export function HintTooltip({ content, children, 'data-qqq-id': dataId, side = 'bottom' }: HintTooltipProps) {
  const state = useFocusSafeTooltip()
  if (content === null || content === undefined || content === false || content === '') return children
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root open={state.open} onOpenChange={state.onOpenChange}>
        <TooltipPrimitive.Trigger asChild onFocus={state.onFocus} onBlur={state.onBlur} onKeyDown={state.onKeyDown}
          onPointerDown={state.onPointerDown} onClick={state.onClick}>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content side={side} sideOffset={4} collisionPadding={8} data-qqq-id={dataId}
            className="z-[300] max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-md">
            {content}
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
