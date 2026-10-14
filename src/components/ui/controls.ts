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
 * @file The standard control styles (the variants catalogued in `Button.stories.tsx`): buttons,
 * inputs, selects, tabs, menus and alerts. Every color is a theme token (or a token-paired
 * `dark:` variant), so a control drawn with these classes follows light and dark mode.
 */

import { cn } from '@/lib/utils/cn'

const FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-50'

/** Secondary button: Cancel, Back and other secondary actions. */
export const BUTTON_CLASS = cn(
  'inline-flex items-center justify-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground',
  'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  DISABLED
)

/** Primary button: Save, Run and other primary actions. */
export const PRIMARY_BUTTON_CLASS = cn(
  'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
  'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  DISABLED
)

/** Single-line text input. */
export const INPUT_CLASS =
  'w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'

/** Error message box. */
export const ALERT_CLASS =
  'whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'

/** Warning message box. */
export const WARNING_CLASS =
  'rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'

/** Visual size of a {@link buttonClass} button. */
export type ButtonSize = 'sm' | 'md'

/** Visual variant of a {@link buttonClass} button. */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'danger' | 'ghost'

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Hover darkens the fill (a translucent fill would lighten it on light surfaces and drop the
  // label below 4.5:1). The dark theme's brighter red is darkened behind white text likewise.
  primary:
    'bg-primary text-primary-foreground shadow-sm hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)]',
  secondary: 'border border-input bg-card text-foreground shadow-sm hover:bg-accent',
  destructive:
    'border border-destructive/40 bg-card text-destructive shadow-sm hover:bg-destructive/10',
  danger:
    'bg-destructive text-destructive-foreground shadow-sm hover:bg-[color-mix(in_srgb,var(--color-destructive)_85%,black)] dark:bg-[color-mix(in_srgb,var(--color-destructive)_75%,black)] dark:hover:bg-[color-mix(in_srgb,var(--color-destructive)_65%,black)]',
  ghost: 'text-foreground hover:bg-accent',
}

/**
 * Classes of a standard button.
 *
 * @param variant - Primary (filled), secondary (bordered), destructive (bordered, red text),
 *   danger (filled red: the confirming button of an irreversible action) or ghost.
 * @param size - `sm` for toolbars and inline actions, `md` for forms and dialogs.
 * @returns The class string.
 */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors',
    BUTTON_SIZES[size],
    BUTTON_VARIANTS[variant],
    FOCUS,
    DISABLED
  )
}

/**
 * Classes of a square icon-only button (give it an `aria-label`).
 *
 * @param variant - Ghost (default) or destructive.
 * @returns The class string.
 */
export function iconButtonClass(variant: 'ghost' | 'destructive' = 'ghost'): string {
  return cn(
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
    variant === 'destructive'
      ? 'text-destructive hover:bg-destructive/10'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
    FOCUS,
    DISABLED
  )
}

/** Native select, matching {@link INPUT_CLASS}. */
export const SELECT_CLASS =
  'h-8 min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

/** Native checkbox or radio. */
export const CHECKBOX_CLASS =
  'h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary focus:ring-ring'

/** Field label above or beside a control. */
export const LABEL_CLASS = 'text-sm font-medium text-foreground'

/** Tab bar (`role="tablist"`): an underlined row, as on the record view and script viewer. */
export const TAB_LIST_CLASS = 'flex gap-1 overflow-x-auto border-b border-border'

/**
 * Classes of one tab in a {@link TAB_LIST_CLASS} bar.
 *
 * @param selected - Whether the tab is the selected one.
 * @returns The class string.
 */
export function tabClass(selected: boolean): string {
  return cn(
    '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    selected
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  )
}

/** Dropdown menu panel. */
export const MENU_CONTENT_CLASS =
  'z-50 min-w-40 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-md'

/** Dropdown menu item. */
export const MENU_ITEM_CLASS =
  'flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-popover-foreground outline-none hover:bg-accent focus:bg-accent data-[highlighted]:bg-accent'

/** Small neutral badge (status, mode). */
export const BADGE_CLASS =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'

/** Card surface (sections, notebook cells). */
export const CARD_CLASS = 'rounded-lg border border-border bg-card text-card-foreground'
