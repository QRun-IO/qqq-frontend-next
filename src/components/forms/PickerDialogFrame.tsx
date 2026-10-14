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
 * @file PickerDialogFrame — the chrome shared by the picker dialog family: the media/record picker
 * of a possible value source ({@link RecordPickerDialog}) and the related-record picker
 * ({@link RelatedRecordPickerDialog}). A modal over an overlay (full screen on phones), a header
 * with the title, optional actions and Close, then the dialog's own body. Escape closes it and
 * focus is trapped while it is open (Radix); focus returns to the opener on close.
 */

'use client'

import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { iconButtonClass } from '@/components/ui/controls'

/** Props for {@link PickerDialogFrame}. */
export interface PickerDialogFrameProps {
  /** Dialog title. */
  title: string
  /** `data-qqq-id` of the dialog (its close button is `{id-prefix}-close`). */
  dataQqqId: string
  /** Prefix of the close button's `data-qqq-id` (default: `dataQqqId` without `-dialog`). */
  idPrefix?: string
  /** Header actions, before Close. */
  headerActions?: React.ReactNode
  /** Extra data attributes for the content element. */
  dataAttributes?: Record<string, string | boolean | undefined>
  /** Called when Escape, the overlay or Close dismisses the dialog. */
  onClose: () => void
  /** Escape handling before the dialog closes (e.g. leave a sub-step first); call `preventDefault` to keep it open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void
  /** The dialog body. */
  children: React.ReactNode
}

/**
 * The picker dialog chrome.
 *
 * @param props - See {@link PickerDialogFrameProps}.
 * @returns The open dialog.
 */
export function PickerDialogFrame({ title, dataQqqId, idPrefix, headerActions, dataAttributes, onClose, onEscapeKeyDown, children }: PickerDialogFrameProps) {
  const restoreFocus = useRestoreFocus(true)
  const prefix = idPrefix ?? dataQqqId.replace(/-dialog$/, '')
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-black/80" />
        <Dialog.Content
          onCloseAutoFocus={restoreFocus}
          onEscapeKeyDown={onEscapeKeyDown}
          aria-describedby={undefined}
          className="fixed inset-0 z-[2001] flex flex-col overflow-hidden border border-border bg-card text-foreground shadow-xl focus:outline-none sm:inset-6 sm:rounded-lg"
          data-qqq-id={dataQqqId}
          {...Object.fromEntries(Object.entries(dataAttributes ?? {}).map(([key, value]) => [key, value === false ? undefined : value]))}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</Dialog.Title>
            {headerActions}
            <Dialog.Close className={iconButtonClass()} aria-label="Close" data-qqq-id={`${prefix}-close`}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** The dialog's own Close primitive, for footers (Cancel buttons). */
export const PickerDialogClose = Dialog.Close

export default PickerDialogFrame
