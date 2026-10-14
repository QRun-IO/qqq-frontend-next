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

/** @file Shared accessible collaboration dialog and compact controls. */
'use client'
import { useRef, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
export const collaborationButton =
  'min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent disabled:opacity-50'
export const collaborationInput =
  'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm'
/** Focus-trapped dialog sized for phones and desktop.
 * @param props - Dialog state and contents.
 * @returns Modal.
 */
export function CollaborationDialog({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const returnFocus = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  if (open && !wasOpen.current && typeof document !== 'undefined')
    returnFocus.current = document.activeElement as HTMLElement
  wasOpen.current = open
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[170] bg-black/40" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (returnFocus.current?.isConnected) returnFocus.current.focus()
          }}
          className="fixed left-1/2 top-1/2 z-[171] max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 text-foreground shadow-xl"
          aria-describedby={undefined}
          data-qqq-id="collaboration-dialog"
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close
              className={collaborationButton}
              aria-label="Close dialog"
              data-qqq-id="collaboration-dialog-close"
            >
              Close
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
