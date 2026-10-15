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
 * @file HelpMenu — the one Help entry in the header (WCAG 3.2.6 Consistent Help): search help,
 * keyboard shortcuts, feature slots (What's new) and Report a bug. On compact screens the same
 * items open from the account menu.
 */

'use client'

import React from 'react'
import { HelpCircle, Keyboard, Search } from 'lucide-react'

import { useHelpPanel } from '@/components/help/HelpPanelProvider'
import { ReportBugMenuItems } from '@/components/qa-capture/ReportBugMenuItems'
import { useSingleKeyShortcutsEnabled } from '@/lib/keyboard/single-key-shortcuts'
import { HEADER_MENU_ITEM_CLASS, HeaderMenu } from './HeaderMenu'

/** Props for {@link HelpMenuItems} and {@link HelpMenu}. */
export interface HelpMenuItemsProps {
  /** Opens the search box scoped to help articles. */
  onSearchHelp: () => void
  /** Opens the keyboard shortcuts sheet. */
  onShortcuts: () => void
  /**
   * More help items from installed features (for example What's new), rendered before Report a
   * bug. Each must have a `menuitem` role; call `close` when chosen.
   */
  extraItems?: (close: (then?: () => void) => void) => React.ReactNode
}

/**
 * The Help items, for the Help menu and the compact account menu.
 *
 * @param props - Component properties.
 * @param props.close - Closes the enclosing menu.
 * @returns The items.
 */
export function HelpMenuItems({ onSearchHelp, onShortcuts, extraItems, close }: HelpMenuItemsProps & { close: (then?: () => void) => void }) {
  const { searchEnabled } = useHelpPanel()
  const singleKeys = useSingleKeyShortcutsEnabled()
  return (
    <>
      {searchEnabled && (
        <button type="button" role="menuitem" className={HEADER_MENU_ITEM_CLASS} data-qqq-id="menu-item-search-help"
          onClick={() => close(onSearchHelp)}>
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Search help…
        </button>
      )}
      <button type="button" role="menuitem" className={HEADER_MENU_ITEM_CLASS} data-qqq-id="menu-item-keyboard-shortcuts"
        onClick={() => close(onShortcuts)}>
        <Keyboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">Keyboard shortcuts</span>
        {singleKeys && <kbd className="rounded border border-border px-1.5 font-mono text-xs text-muted-foreground" aria-hidden="true">?</kbd>}
      </button>
      {extraItems?.(close)}
      <ReportBugMenuItems onSelect={() => close()} />
    </>
  )
}

/**
 * The header Help button and menu, always in the same place on every page.
 *
 * @param props - Component properties.
 * @returns The Help menu.
 */
export function HelpMenu(props: HelpMenuItemsProps) {
  return (
    <HeaderMenu label="Help" qqqId="button-help" trigger={<HelpCircle className="h-5 w-5" aria-hidden="true" />}>
      {(close) => <HelpMenuItems {...props} close={close} />}
    </HeaderMenu>
  )
}
