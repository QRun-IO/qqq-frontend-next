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
 * @file KeyboardShortcutsDialog — "?" help dialog listing available keyboard shortcuts grouped by context.
 */

'use client'

import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'

/**
 * Describes a single keyboard shortcut with its key combination and action description.
 */
interface ShortcutEntry {
  /** Ordered array of key labels (e.g. `['⌘', 'K']`). */
  keys: string[]
  /** Human-readable description of the action triggered by the shortcut. */
  description: string
}

/**
 * A named group of related keyboard shortcuts shown under a section header.
 */
interface ShortcutSection {
  /** Section heading (e.g. `"Global"`, `"Table Query Page"`). */
  title: string
  /** List of shortcuts belonging to this section. */
  shortcuts: ShortcutEntry[]
}

/** Static list of all keyboard shortcut sections displayed in the dialog. */
const shortcutSections: ShortcutSection[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['.'], description: 'Quick Navigation' },
      { keys: ['/'], description: 'Search Records' },
      { keys: ['?'], description: 'Keyboard Shortcuts' },
      { keys: ['\u2318', 'K'], description: 'Command Palette' },
    ],
  },
  {
    title: 'Table Query Page',
    shortcuts: [
      { keys: ['n'], description: 'New Record' },
      { keys: ['r'], description: 'Refresh' },
      { keys: ['f'], description: 'Toggle Filters' },
    ],
  },
  {
    title: 'Record View Page',
    shortcuts: [
      { keys: ['n'], description: 'New Record' },
      { keys: ['e'], description: 'Edit' },
      { keys: ['c'], description: 'Copy' },
      { keys: ['d'], description: 'Delete' },
    ],
  },
]

/**
 * Renders a styled keyboard key badge using the `<kbd>` HTML element.
 *
 * @param children - The key label to display (e.g. `"⌘"`, `"K"`, `"esc"`).
 * @returns A `<kbd>` element with a minimum 24 px square size, monospace font,
 *   and muted background/border using project design tokens.
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded border',
        'border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground'
      )}
    >
      {children}
    </kbd>
  )
}

/**
 * Props for the KeyboardShortcutsDialog component.
 */
interface KeyboardShortcutsDialogProps {
  /** Whether the dialog is currently open. */
  open: boolean
  /** Called when the dialog should close. */
  onClose: () => void
}

/**
 * Modal dialog listing all keyboard shortcuts organized by contextual section.
 *
 * Triggered by pressing `?` anywhere in the application (when focus is not in
 * a text field). Closes via the X button, the close prop, or Escape key. Uses
 * the Radix `Dialog` primitive with project design tokens and the `Kbd` badge
 * component to render key labels.
 *
 * @param props - Component properties.
 * @returns A Radix Dialog portal with a sticky header, scrollable shortcut
 *   sections (max 60 vh), and a footer reminder. Each section groups related
 *   shortcuts under a heading with {@link Kbd} badges for each key combination.
 */
export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  const restoreFocus = useRestoreFocus(open)
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          data-qqq-id="keyboard-shortcuts-overlay"
        />
        <Dialog.Content
          onCloseAutoFocus={restoreFocus}
          className={cn(
            'fixed left-1/2 top-1/2 z-[2001] w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-card shadow-lg',
            'focus:outline-none'
          )}
          data-qqq-id="keyboard-shortcuts-dialog"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <Dialog.Title className="text-base font-semibold text-foreground">
              Keyboard Shortcuts
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Close keyboard shortcuts"
                data-qqq-id="button-keyboard-shortcuts-close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Shortcut sections */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            {shortcutSections.map((section, sectionIndex) => (
              <div key={section.title} className={cn(sectionIndex > 0 && 'mt-5')}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-foreground">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {keyIndex > 0 && (
                              <span className="text-xs text-muted-foreground">+</span>
                            )}
                            <Kbd>{key}</Kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-3">
            <p className="text-center text-xs text-muted-foreground">
              Press <Kbd>?</Kbd> anytime to show this dialog
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
