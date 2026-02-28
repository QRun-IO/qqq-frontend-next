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
 * ProcessCancelDialog — confirmation dialog shown before cancelling an in-flight process.
 *
 * Uses the native HTML `<dialog>` element for built-in focus trapping and
 * Escape-key handling.  The "Stay on Page" button receives focus by default so
 * an accidental Enter key press does not confirm cancellation.
 */
'use client'

// ProcessCancelDialog — confirmation dialog before cancelling an in-flight process
// Uses native dialog/modal pattern with focus trap and accessible markup

import React, { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link ProcessCancelDialog} component.
 */
export interface ProcessCancelDialogProps {
  /** Whether the dialog is currently open. */
  open: boolean
  /**
   * Called when the open state should change (backdrop click, Escape key, or
   * the "Stay on Page" button).
   *
   * @param open - The new open state.
   */
  onOpenChange: (open: boolean) => void
  /** Called after the dialog closes when the user confirms cancellation. */
  onConfirm: () => void
}

/**
 * Renders a modal confirmation dialog asking the user whether to cancel the process.
 *
 * Opens and closes the native `<dialog>` imperatively via `showModal()` / `close()`
 * in sync with the `open` prop.  Escape key and backdrop clicks both close without
 * confirming.
 *
 * @param props - {@link ProcessCancelDialogProps}
 */
export function ProcessCancelDialog({
  open,
  onOpenChange,
  onConfirm,
}: ProcessCancelDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      // Focus the cancel (stay) button by default so accidental Enter does not confirm.
      // Wrap in requestAnimationFrame so focus management completes in all browsers.
      requestAnimationFrame(() => {
        cancelButtonRef.current?.focus()
      })
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Handle native close event (e.g., Escape key)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      onOpenChange(false)
    }

    dialog.addEventListener('close', handleClose)
    return () => {
      dialog.removeEventListener('close', handleClose)
    }
  }, [onOpenChange])

  /**
   * Closes the dialog when the user clicks the backdrop (outside the content area).
   *
   * @param e - The mouse event on the `<dialog>` element itself.
   */
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onOpenChange(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-xl border border-border bg-card p-0 shadow-lg backdrop:bg-black/50"
      data-qqq-id="process-cancel-dialog"
      aria-labelledby="cancel-dialog-title"
      aria-describedby="cancel-dialog-description"
    >
      <div className="w-full max-w-md p-6">
        {/* Icon and title */}
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100">
            <AlertTriangle
              className="h-5 w-5 text-yellow-600"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="cancel-dialog-title"
              className="text-base font-semibold text-foreground"
            >
              Cancel Process?
            </h2>
            <p
              id="cancel-dialog-description"
              className="mt-1 text-sm text-muted-foreground"
            >
              Are you sure you want to cancel? Any unsaved progress will be lost.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={() => onOpenChange(false)}
            data-qqq-id="cancel-dialog-stay"
            className={cn(
              'inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'transition-colors duration-150'
            )}
          >
            Stay on Page
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
            data-qqq-id="cancel-dialog-confirm"
            className={cn(
              'inline-flex items-center rounded-md px-4 py-2 text-sm font-medium',
              'text-destructive-foreground bg-destructive hover:bg-destructive/90',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'transition-colors duration-150'
            )}
          >
            Cancel Process
          </button>
        </div>
      </div>
    </dialog>
  )
}
