'use client'

// KeyboardShortcutsDialog — "?" help dialog showing available keyboard shortcuts
// Organized by context: Global, Table Query, Record View
// Uses Radix Dialog primitive with project design tokens

import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

interface ShortcutEntry {
  keys: string[]
  description: string
}

interface ShortcutSection {
  title: string
  shortcuts: ShortcutEntry[]
}

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

interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          data-qqq-id="keyboard-shortcuts-overlay"
        />
        <Dialog.Content
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
