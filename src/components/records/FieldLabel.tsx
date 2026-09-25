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
import { selectHelpContent, VIEW_SCREEN_HELP_ROLES } from '@/lib/utils/help-utils'
import { HelpContent } from './HelpContent'

interface FieldLabelProps {
  /**
   * Field metadata from which `label` and `helpContents` are read.
   * The tooltip is suppressed when no help content applies to `helpRoles`.
   */
  field: QFieldMetaData
  className?: string
  /** data-qqq-id attribute for CSS customization hooks */
  'data-qqq-id'?: string
  /** Optional id for aria-labelledby linkage */
  id?: string
  /** Screen roles used to choose the help entry, most specific first (defaults to the view screen). */
  helpRoles?: readonly string[]
}

/**
 * Renders a field's `label` as an inline span with an optional help tooltip
 * (heading = the field label) for the help content that applies to the screen.
 *
 * @param props - Component properties.
 * @param props.field - Field metadata providing `label` and `helpContents`.
 * @param props.className - Optional additional CSS classes for the label span.
 * @param props.'data-qqq-id' - Optional `data-qqq-id` attribute for CSS customization hooks.
 * @param props.id - Optional DOM `id` for `aria-labelledby` linkage.
 * @param props.helpRoles - Screen roles for choosing the help entry.
 * @returns A plain `<span>` when no help applies, otherwise a focusable label with a Radix tooltip.
 */
export function FieldLabel({
  field,
  className,
  'data-qqq-id': dataQqqId,
  id,
  helpRoles = VIEW_SCREEN_HELP_ROLES,
}: FieldLabelProps) {
  const helpContent = selectHelpContent(field.helpContents, helpRoles)

  if (!helpContent) {
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
            className={cn(className, 'cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-4')}
            data-qqq-id={dataQqqId}
            data-has-help="true"
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
            data-qqq-id={`field-help-tooltip-${field.name}`}
            className={cn(
              'z-50 max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm shadow-md',
              'text-foreground',
              'animate-in fade-in-0 zoom-in-95'
            )}
          >
            <p className="mb-1 font-semibold">{field.label}</p>
            <HelpContent helpContent={helpContent} />
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
