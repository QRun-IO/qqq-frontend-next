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
 * @file GotoRecordDialog — Material's "Go To" record lookup: open a record by its primary key
 * or one of the table's `materialDashboard.gotoFieldNames` unique keys.
 */

'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronsRight, CornerDownRight, Loader2, X } from 'lucide-react'

import type { QTableMetaData } from '@/types'
import { queryRecords, type TableVariant } from '@/lib/api/tables'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import {
  GOTO_MULTIPLE_MESSAGE,
  GOTO_NOT_CONFIGURED_MESSAGE,
  GOTO_NOT_FOUND_MESSAGE,
  gotoFilter,
  gotoOptions,
  hasGotoFieldNames,
} from '@/lib/utils/goto-utils'

/**
 * Props for {@link GotoRecordDialog}.
 */
export interface GotoRecordDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Table whose records are looked up. */
  tableMetaData: QTableMetaData
  /** Backend variant lookups run against (tables whose backend uses variants). */
  tableVariant?: TableVariant | null
  /** When false the dialog cannot be dismissed (a table that can only be read by key). */
  mayClose?: boolean
  /** Called when the user dismisses the dialog. */
  onClose: () => void
}

/**
 * The lookup dialog: one row of inputs per option, each with its own Go button; Enter in an
 * input submits that option. One match opens the record; none or several show Material's message.
 *
 * @param props - Component properties.
 * @returns The dialog.
 */
export function GotoRecordDialog({ open, tableMetaData, tableVariant, mayClose = true, onClose }: GotoRecordDialogProps) {
  const router = useRouter()
  const options = useMemo(() => gotoOptions(tableMetaData), [tableMetaData])
  const [values, setValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const restoreFocus = useRestoreFocus(open)

  useEffect(() => {
    if (open) {
      setValues({})
      setMessage(null)
      setPending(null)
    }
  }, [open])

  const close = () => {
    if (mayClose) onClose()
  }

  const go = async (optionIndex: number) => {
    const filter = gotoFilter(options[optionIndex], values)
    if (!filter || pending !== null) return
    setMessage(null)
    setPending(optionIndex)
    try {
      const { records } = await queryRecords(tableMetaData.name, { filter, ...(tableVariant ? { tableVariant } : {}) })
      if (records.length === 1) {
        const id = records[0].values[tableMetaData.primaryKeyField]
        router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(id))}`)
        onClose()
        return
      }
      setMessage(records.length === 0 ? GOTO_NOT_FOUND_MESSAGE : GOTO_MULTIPLE_MESSAGE)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error && error.message ? error.message : String(error)}`)
    } finally {
      setPending(null)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) close() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          data-qqq-id="goto-dialog"
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card shadow-lg focus:outline-none"
          onOpenAutoFocus={(e) => { e.preventDefault(); firstInputRef.current?.focus() }}
          onCloseAutoFocus={restoreFocus}
          onEscapeKeyDown={(e) => { if (!mayClose) e.preventDefault() }}
          onInteractOutside={(e) => { if (!mayClose) e.preventDefault() }}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Go To...</DialogPrimitive.Title>
            {mayClose && (
              <DialogPrimitive.Close asChild>
                <button type="button" aria-label="Close dialog" className="rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </DialogPrimitive.Close>
            )}
          </div>

          <div className="space-y-4 px-6 py-4">
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Find a {tableMetaData.label} record by any of these fields.
            </DialogPrimitive.Description>
            {options.map((option, optionIndex) => {
              const keyLabel = option.map((field) => field.label).join(' and ')
              return (
                <form
                  key={option.map((field) => field.name).join('+')}
                  aria-label={`Go to by ${keyLabel}`}
                  data-qqq-id={`goto-option-${optionIndex}`}
                  className="flex flex-col gap-2 rounded-md border border-border p-3"
                  onSubmit={(e) => { e.preventDefault(); void go(optionIndex) }}
                >
                  {option.map((field, fieldIndex) => {
                    const inputId = `goto-input-${optionIndex}-${field.name}`
                    return (
                      <div key={field.name} className="flex items-center gap-3">
                        <label htmlFor={inputId} className="w-1/3 text-right text-sm font-medium text-foreground">{field.label}</label>
                        <input
                          ref={optionIndex === 0 && fieldIndex === 0 ? firstInputRef : undefined}
                          id={inputId}
                          type="text"
                          autoComplete="off"
                          value={values[field.name] ?? ''}
                          onChange={(e) => {
                            const value = e.target.value
                            setValues((current) => ({ ...current, [field.name]: value }))
                          }}
                          onFocus={(e) => e.target.select()}
                          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                          data-qqq-id={`goto-input-${field.name}`}
                        />
                      </div>
                    )
                  })}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!gotoFilter(option, values) || pending !== null}
                      aria-label={`Go to the ${tableMetaData.label} record with this ${keyLabel}`}
                      data-qqq-id={`goto-submit-${optionIndex}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending === optionIndex
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <ChevronsRight className="h-4 w-4" aria-hidden="true" />}
                      Go
                    </button>
                  </div>
                </form>
              )
            })}
            {(message || options.length === 0) && (
              <p role="alert" data-qqq-id="goto-message" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {message ?? GOTO_NOT_CONFIGURED_MESSAGE}
              </p>
            )}
          </div>

          {mayClose && (
            <div className="flex items-center justify-end rounded-b-lg border-t border-border bg-muted px-6 py-4">
              <button type="button" onClick={close} data-qqq-id="goto-close"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                Close
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Props for {@link GotoRecordButton}.
 */
export interface GotoRecordButtonProps {
  /** Table whose records are looked up. */
  tableMetaData: QTableMetaData
  /** Backend variant lookups run against. */
  tableVariant?: TableVariant | null
  /** Extra classes for the button. */
  className?: string
}

/**
 * The "Go To..." button and its dialog, shown only when the table configures Go To keys.
 *
 * @param props - Component properties.
 * @returns The button and dialog, or null.
 */
export function GotoRecordButton({ tableMetaData, tableVariant, className }: GotoRecordButtonProps) {
  const [open, setOpen] = useState(false)
  if (!hasGotoFieldNames(tableMetaData)) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Go to a ${tableMetaData.label} record`}
        data-qqq-id="button-goto"
        className={className ?? 'flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'}
      >
        <CornerDownRight className="h-4 w-4" aria-hidden="true" />
        Go To...
      </button>
      <GotoRecordDialog open={open} tableMetaData={tableMetaData} tableVariant={tableVariant} onClose={() => setOpen(false)} />
    </>
  )
}
