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
 * @file Header controls of widgets that edit inside a form: a text link button with a
 * tooltip explaining why it is disabled, and a labelled switch (Material's
 * `HeaderLinkButtonComponent` and `HeaderToggleComponent` in `Widget.tsx`).
 */
'use client'

import React, { useId } from 'react'

import { cn } from '@/lib/utils/cn'
import { HoverTooltip } from './HoverTooltip'

/** Props for {@link WidgetHeaderLinkButton}. */
export interface WidgetHeaderLinkButtonProps {
  /** Button text, e.g. "Edit Filters and Columns". */
  label: string
  /** Called on click. */
  onClick: () => void
  /** When true the button is disabled. */
  disabled?: boolean
  /** Why the button is disabled, shown as its tooltip while disabled. */
  disabledTooltip?: string | null
  /** `data-qqq-id` of the button. */
  qqqId: string
}

/**
 * A text-style button for a widget header. While disabled with a reason, the reason is
 * its tooltip (on a focusable wrapper, since a disabled button takes no focus or hover).
 *
 * @param props - See {@link WidgetHeaderLinkButtonProps}.
 * @returns The button.
 */
export function WidgetHeaderLinkButton({ label, onClick, disabled = false, disabledTooltip, qqqId }: WidgetHeaderLinkButtonProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-qqq-id={qqqId}
      className={cn(
        'inline-flex min-h-9 items-center rounded-md px-2 text-sm font-medium text-primary hover:underline',
        'focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:min-h-11',
        'disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline'
      )}
    >
      {label}
    </button>
  )
  if (disabled && disabledTooltip) {
    return <HoverTooltip content={disabledTooltip} qqqId={`${qqqId}-tooltip`}>{button}</HoverTooltip>
  }
  return button
}

/** Props for {@link WidgetHeaderToggle}. */
export interface WidgetHeaderToggleProps {
  /** Switch label, e.g. "Use Pivot Table?". */
  label: string
  /** Whether the switch is on. */
  checked: boolean
  /** Called with the new state. */
  onChange: (checked: boolean) => void
  /** When true the switch is disabled. */
  disabled?: boolean
  /** `data-qqq-id` of the switch. */
  qqqId: string
}

/**
 * A labelled on/off switch for a widget header (`role="switch"`).
 *
 * @param props - See {@link WidgetHeaderToggleProps}.
 * @returns The switch with its label.
 */
export function WidgetHeaderToggle({ label, checked, onChange, disabled = false, qqqId }: WidgetHeaderToggleProps) {
  const id = useId()
  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={id} className={cn('text-sm font-medium text-foreground', disabled && 'opacity-50')}>{label}</label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        data-qqq-id={qqqId}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          checked ? 'bg-primary' : 'bg-muted',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          aria-hidden="true"
          className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-5' : 'translate-x-0')}
        />
      </button>
    </span>
  )
}
