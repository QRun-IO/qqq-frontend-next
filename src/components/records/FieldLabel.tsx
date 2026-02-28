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

'use client'

// FieldLabel — renders a field label with optional help text tooltip
// When a field has helpContents with content, hovering the label shows a tooltip

import React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import type { QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

interface FieldLabelProps {
  field: QFieldMetaData
  className?: string
  /** data-qqq-id attribute for CSS customization hooks */
  'data-qqq-id'?: string
  /** Optional id for aria-labelledby linkage */
  id?: string
}

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
