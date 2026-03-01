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
 * @file UnsavedChangesDialog — accessible confirmation modal preventing accidental loss of unsaved form data.
 */

'use client'

// UnsavedChangesDialog — confirmation dialog shown when navigating away with unsaved form changes
// Uses Radix AlertDialog primitives for accessible modal behavior

import React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link UnsavedChangesDialog} component.
 */
interface UnsavedChangesDialogProps {
  /** Controls dialog visibility; when `false` the component renders nothing. */
  open: boolean
  /** Called when the user clicks "Stay" or dismisses the dialog (Escape / overlay click). */
  onStay: () => void
  /** Called when the user clicks "Leave", confirming that unsaved changes can be discarded. */
  onLeave: () => void
}

/**
 * Accessible confirmation dialog that warns users before they navigate away
 * from a form with unsaved changes.
 *
 * Built on Radix `AlertDialog` primitives which handle focus trapping,
 * `aria-modal`, and initial focus automatically.  Pressing Escape or clicking
 * the overlay calls `onStay`, keeping the user on the current page.
 *
 * @param props - See {@link UnsavedChangesDialogProps}.
 * @returns The rendered confirmation dialog, or null when `open` is false.
 */
export function UnsavedChangesDialog({ open, onStay, onLeave }: UnsavedChangesDialogProps) {
  // Radix AlertDialog manages focus automatically (focus trap + initial focus).
  // Manual focus management via useEffect/ref.focus() races with Radix's
  // internal focus trap and is intentionally omitted here.

  if (!open) return null

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onStay() }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50"
          onClick={onStay}
        />
        <AlertDialogPrimitive.Content
          data-qqq-id="unsaved-changes-dialog"
          aria-describedby="unsaved-changes-description"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-background shadow-lg',
            'focus:outline-none'
          )}
          onEscapeKeyDown={onStay}
        >
          <AlertDialogPrimitive.Title className="sr-only">
            Unsaved Changes
          </AlertDialogPrimitive.Title>

          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                <AlertTriangle className="h-5 w-5 text-yellow-600" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Unsaved Changes
              </h2>
            </div>
            <p
              id="unsaved-changes-description"
              className="text-sm text-muted-foreground"
            >
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 rounded-b-xl bg-muted px-6 py-4">
            <button
              type="button"
              onClick={onStay}
              data-qqq-id="unsaved-changes-stay"
              className={cn(
                'inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium',
                'text-foreground bg-background hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
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
                'text-destructive-foreground bg-destructive hover:bg-destructive/90',
                'focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2',
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
