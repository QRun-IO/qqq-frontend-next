'use client'

// UnsavedChangesDialog — confirmation dialog shown when navigating away with unsaved form changes
// Uses Radix AlertDialog primitives for accessible modal behavior

import React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

interface UnsavedChangesDialogProps {
  open: boolean
  onStay: () => void
  onLeave: () => void
}

export function UnsavedChangesDialog({ open, onStay, onLeave }: UnsavedChangesDialogProps) {
  // Radix AlertDialog manages focus automatically (focus trap + initial focus).
  // Manual focus management via useEffect/ref.focus() races with Radix's
  // internal focus trap and is intentionally omitted here.

  if (!open) return null

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onStay() }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70"
          onClick={onStay}
        />
        <AlertDialogPrimitive.Content
          data-qqq-id="unsaved-changes-dialog"
          aria-describedby="unsaved-changes-description"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-lg bg-white shadow-xl dark:bg-gray-900 dark:border dark:border-gray-700',
            'focus:outline-none'
          )}
          onEscapeKeyDown={onStay}
        >
          <AlertDialogPrimitive.Title className="sr-only">
            Unsaved Changes
          </AlertDialogPrimitive.Title>

          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Unsaved Changes
              </h2>
            </div>
            <p
              id="unsaved-changes-description"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 rounded-b-lg bg-gray-50 px-6 py-4 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={onStay}
              data-qqq-id="unsaved-changes-stay"
              className={cn(
                'inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium',
                'text-gray-700 bg-white hover:bg-gray-50',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                'dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700',
                'transition-colors duration-150'
              )}
            >
              Stay
            </button>
            <button
              type="button"
              onClick={onLeave}
              data-qqq-id="unsaved-changes-leave"
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-white bg-red-600 hover:bg-red-700',
                'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
                'transition-colors duration-150'
              )}
            >
              Leave
            </button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
