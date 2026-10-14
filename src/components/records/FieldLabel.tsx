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

import type { QFieldMetaData } from '@/types'

import { VIEW_SCREEN_HELP_ROLES } from '@/lib/utils/help-utils'

import { HelpIcon } from '@/components/help/HelpIcon'

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
  /** Help slot key shown in help-authoring mode (`?helpHelp`), e.g. `table:person;field:email`. */
  helpKey?: string
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
 * @returns A plain `<span>` when no help applies, otherwise the label with a focusable help button.
 */
export function FieldLabel({
  field,
  className,
  'data-qqq-id': dataQqqId,
  id,
  helpRoles = VIEW_SCREEN_HELP_ROLES,
  helpKey,
}: FieldLabelProps) {
  return <span className={className} data-qqq-id={dataQqqId}>
    <span className="inline-flex items-center">
      <span id={id}>{field.label}</span>
      <HelpIcon label={field.label} helpContents={field.helpContents} roles={helpRoles} helpKey={helpKey}
        data-qqq-id={`field-help-${field.name}`} tooltipId={`field-help-tooltip-${field.name}`} />
    </span>
  </span>
}
