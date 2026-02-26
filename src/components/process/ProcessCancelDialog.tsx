'use client'

// ProcessCancelDialog — confirmation dialog before cancelling an in-flight process
// Uses native dialog/modal pattern with focus trap and accessible markup

import React, { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export interface ProcessCancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

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

  // Handle backdrop click
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
