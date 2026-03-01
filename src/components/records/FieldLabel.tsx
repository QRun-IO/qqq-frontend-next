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
 * @file FieldLabel — renders a field label with an optional help-text tooltip.
 */

'use client'

import React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import type { QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

interface FieldLabelProps {
  /**
   * Field metadata from which `label` and `helpContents` are read.
   * The tooltip is suppressed when `helpContents` is empty or undefined.
   */
  field: QFieldMetaData
  className?: string
  /** data-qqq-id attribute for CSS customization hooks */
  'data-qqq-id'?: string
  /** Optional id for aria-labelledby linkage */
  id?: string
}

/**
 * Renders a field's `label` as an inline span with an optional help-text
 * tooltip driven by the field's `helpContents` metadata.
 *
 * Used by {@link RecordViewSection} and {@link RecordViewHeader} to render
 * every field label in the record detail view. When `helpContents` has at
 * least one entry, the label gains `cursor-help` styling, `tabIndex={0}` for
 * keyboard accessibility, and a Radix Tooltip that pops up on hover or focus.
 * The tooltip is suppressed entirely when `helpContents` is empty or undefined.
 *
 * @param props - Component properties.
 * @returns A plain `<span>` when the field has no help text, or a `<span>`
 *   wrapped in a Radix TooltipProvider + Tooltip when help text is present.
 */
export function FieldLabel({
  field,
  className,
  'data-qqq-id': dataQqqId,
  id,
}: FieldLabelProps) {
  const helpText = field.helpContents?.[0]?.content

  if (!helpText) {
    return (
      <span
        className={className}
        data-qqq-id={dataQqqId}
        id={id}
      >
        {field.label}
      </span>
    )
  }

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span
            className={cn(className, 'cursor-help')}
            data-qqq-id={dataQqqId}
            id={id}
            tabIndex={0}
          >
            {field.label}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={4}
            className={cn(
              'z-50 max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm shadow-md',
              'text-foreground',
              'animate-in fade-in-0 zoom-in-95'
            )}
          >
            {helpText}
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
