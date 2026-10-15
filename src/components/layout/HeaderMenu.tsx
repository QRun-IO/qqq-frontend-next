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
 * @file HeaderMenu — a header button that opens a menu below it (Help, Account). Items are any
 * elements with a `menuitem` role, so feature slots (Report a bug, What's new) plug in as they are.
 */

'use client'

import React, { useCallback, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'

import { cn } from '@/lib/utils/cn'

/** Every header icon button: 40 px square, 44 px for coarse pointers (WCAG 2.5.8 with margin; Apple HIG). */
export const HEADER_BUTTON_CLASS = cn(
  'relative flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg px-2.5 text-foreground/70',
  'pointer-coarse:h-11 pointer-coarse:min-w-11',
  'hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
)

/** A menu row: full width, 44 px tall on touch. */
export const HEADER_MENU_ITEM_CLASS = cn(
  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-foreground pointer-coarse:min-h-11',
  'hover:bg-accent transition-colors focus:outline-none focus:bg-accent',
  'disabled:cursor-not-allowed disabled:opacity-60'
)

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled]), [role="menuitemradio"]:not([disabled])'

/** Props for {@link HeaderMenu}. */
export interface HeaderMenuProps {
  /** The trigger's accessible name (also its tooltip). */
  label: string
  /** The trigger's content (an icon, an avatar, optional text). */
  trigger: React.ReactNode
  /** Menu content; call `close` from an item that should close the menu. */
  children: (close: () => void) => React.ReactNode
  /** Stable hook for CSS and tests, on the trigger (`{qqqId}`) and the menu (`{qqqId}-menu`). */
  qqqId: string
  /** Extra classes for the trigger. */
  triggerClassName?: string
  /** Extra classes for the menu panel. */
  menuClassName?: string
}

/**
 * A header button with a dropdown menu. Opens below the button, aligned to its end; moves focus to
 * the first item; ArrowUp/ArrowDown/Home/End move between items; Escape or a choice closes it and
 * focus returns to the button.
 *
 * @param props - Component properties.
 * @returns The trigger and, while open, its menu.
 */
export function HeaderMenu({ label, trigger, children, qqqId, triggerClassName, menuClassName }: HeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  /**
   * Moves focus between the menu's items with the arrow, Home and End keys.
   *
   * @param event - Keydown inside the menu.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    let next: number | null = null
    if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length
    else if (event.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next === null) return
    event.preventDefault()
    items[next].focus()
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(HEADER_BUTTON_CLASS, triggerClassName)}
          data-qqq-id={qqqId}
        >
          {trigger}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={menuRef}
          role="menu"
          aria-label={label}
          align="end"
          sideOffset={6}
          collisionPadding={16}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus()
          }}
          className={cn(
            'z-[160] w-72 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg',
            'animate-in fade-in-0 slide-in-from-top-2 duration-150',
            menuClassName
          )}
          data-qqq-id={`${qqqId}-menu`}
        >
          {children(close)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * A thin rule between groups of menu items.
 *
 * @returns The separator.
 */
export function HeaderMenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />
}
