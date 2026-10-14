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

/** @file Consistent keyboard and touch accessible contextual help. */
'use client'

import React, { useId, useRef } from 'react'

import * as Tooltip from '@radix-ui/react-tooltip'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Info } from 'lucide-react'

import type { QHelpContent } from '@/types'

import { useHelpHelpActive } from '@/lib/context/q-context'
import { useFocusSafeTooltip } from '@/lib/hooks/use-focus-safe-tooltip'
import { serializeFilter } from '@/lib/utils/filter-utils'
import { helpSummary, selectHelpContent, VIEW_SCREEN_HELP_ROLES } from '@/lib/utils/help-utils'

import { HELP_CONTENT_TABLE, useHelpPanel } from './HelpPanelProvider'

/** Properties shared by field, section, title and menu help slots. */
export interface HelpIconProps {
  label: string
  helpContents?: QHelpContent[]
  helpContent?: QHelpContent
  helpKey?: string
  roles?: readonly string[]
  'data-qqq-id'?: string
  tooltipId?: string
  descriptionId?: string
  /** Participate in a Radix action menu's arrow-key navigation. */
  menuItem?: boolean
}

/**
 * Renders a summary tooltip, a long-help panel trigger, and permission-gated author link.
 * @param props - Label, content, role precedence and stable customization hooks.
 * @returns A small help control, or null when no help applies.
 */
export function HelpIcon({
  label,
  helpContents,
  helpContent,
  helpKey,
  roles = VIEW_SCREEN_HELP_ROLES,
  'data-qqq-id': qqqId,
  tooltipId,
  descriptionId,
  menuItem,
}: HelpIconProps) {
  const generatedId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltip = useFocusSafeTooltip()
  const authorMode = useHelpHelpActive()
  const { openHelp, canAuthor } = useHelpPanel()
  const selected = helpContent ?? selectHelpContent(helpContents, roles)
  const summary = selected ? helpSummary(selected) : ''
  const suffix = authorMode ? ` [${helpKey ?? '?'}]` : ''
  const longHelp = Boolean(selected?.content?.trim() || selected?.contentAsHtml?.trim())
  const id = descriptionId ?? generatedId
  if (!selected && !authorMode) return null
  const open = () => {
    // Safari does not focus buttons on pointer activation; make the return target explicit.
    buttonRef.current?.focus()
    tooltip.onBlur()
    openHelp({
      key: helpKey,
      label,
      helpContent: selected
        ? longHelp
          ? selected
          : { ...selected, content: summary, format: 'TEXT' }
        : { content: `[${helpKey ?? '?'}]`, format: 'TEXT' },
    })
  }
  // Add: the create screen with the key and role preset. Edit: the help rows for this key (one per role).
  const authorHref = selected
    ? `/app/${HELP_CONTENT_TABLE}?filter=${encodeURIComponent(serializeFilter({ criteria: [{ fieldName: 'key', operator: 'EQUALS', values: [helpKey ?? ''] }] }))}`
    : `/app/${HELP_CONTENT_TABLE}/create#/defaultValues=${encodeURIComponent(JSON.stringify({ key: helpKey, role: roles[0] }))}`
  const button = (
    <button
      ref={buttonRef}
      type="button"
      aria-label={`Help for ${label}`}
      aria-describedby={id}
      data-qqq-id={qqqId ?? `help-${helpKey}`}
      onClick={open}
      className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:min-w-11"
    >
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
  return (
    <span
      className="inline-flex max-w-full flex-wrap items-center gap-1 align-middle"
      data-help-key={helpKey}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
      }}
    >
      <span id={id} hidden>
        {summary}
        {suffix}
      </span>
      <Tooltip.Provider delayDuration={300}>
        <Tooltip.Root open={tooltip.open} onOpenChange={tooltip.onOpenChange}>
          <Tooltip.Trigger
            asChild
            onFocus={tooltip.onFocus}
            onBlur={tooltip.onBlur}
            onKeyDown={tooltip.onKeyDown}
          >
            {menuItem ? (
              <DropdownMenu.Item asChild onSelect={(event) => event.preventDefault()}>
                {button}
              </DropdownMenu.Item>
            ) : (
              button
            )}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              data-help-surface="true"
              sideOffset={4}
              data-qqq-id={tooltipId ?? `${qqqId ?? 'help'}-tooltip`}
              className="z-[var(--qqq-z-toast,2000)] max-w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md"
            >
              <p className="font-semibold">{label}</p>
              <p>
                {summary}
                {suffix}
              </p>
              {longHelp && (
                <button
                  type="button"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={open}
                  className="mt-2 text-primary underline"
                  data-qqq-id="help-more"
                >
                  More help
                </button>
              )}
              <Tooltip.Arrow className="fill-border" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      {canAuthor && helpKey && (
        <span className="text-xs text-muted-foreground">
          <code className="break-all">{helpKey}</code>{' '}
          <a href={authorHref} data-qqq-id="help-author-link" className="text-primary underline">
            {selected ? 'Edit help' : 'Add help'}
          </a>
        </span>
      )}
    </span>
  )
}
