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
 * @file AssistantHeaderTip — hover and keyboard-focus tooltip for the assistant panel's icon buttons.
 */

'use client'

import React from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'

/**
 * Wraps one icon button so its label shows as a tooltip on hover and on keyboard focus. The button
 * keeps its own `aria-label`; the tooltip is a visual duplicate for sighted users.
 *
 * @param props - Component props.
 * @param props.label - Tooltip text.
 * @param props.children - The single button element.
 * @returns The button with a tooltip.
 */
export function HeaderTip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={4} className="z-[var(--qqq-z-tooltip,3000)] rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow" data-qqq-id="assistant-tooltip">
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
