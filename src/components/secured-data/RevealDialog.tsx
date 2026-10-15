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

/** @file Lazy loaded audited reveal dialog. */
'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getRevealOptions,
  revealField,
  type RevealResult,
  type RevealTarget,
} from '@/lib/api/secured-data'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import * as Dialog from '@radix-ui/react-dialog'

/**
 * Ask for the server-required reason and display refusal errors without closing.
 * @param props - Component inputs.
 * @returns The rendered UI or current secured-data context.
 */
export default function RevealDialog({
  target,
  onClose,
  onSuccess,
  returnFocus,
}: {
  returnFocus?: HTMLElement | null
  target: RevealTarget
  onClose: () => void
  onSuccess: (result: RevealResult) => void
}) {
  const [reason, setReason] = useState('')
  const [reasonText, setReasonText] = useState('')
  const options = useQuery({
    queryKey: queryKeys.revealOptions(target.tableName, target.fieldName),
    queryFn: () => getRevealOptions(target.tableName, target.fieldName),
    staleTime: 0,
    gcTime: 0,
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: () => revealField({ ...target, reason, reasonText: reasonText.trim() }),
    onSuccess: (result) => onSuccess(result),
    meta: HANDLES_OWN_ERRORS,
    gcTime: 0,
  })
  const policy = options.data
  const textRequired = policy?.requireFreeText || (!reason && policy?.allowFreeText)
  const valid =
    !!policy &&
    policy.remainingToday !== 0 &&
    (policy.reasons.includes(reason) || (policy.allowFreeText && !!reasonText.trim())) &&
    (!textRequired || !!reasonText.trim())
  const error = options.error ?? mutation.error
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            if (returnFocus?.isConnected) {
              event.preventDefault()
              returnFocus.focus()
            }
          }}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto"
          data-qqq-id="reveal-dialog"
        >
          <div className="space-y-2">
            <Dialog.Title className="text-lg font-semibold">Reveal restricted value</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              This access is audited. Choose a reason for viewing this value.
            </Dialog.Description>
          </div>
          {options.isPending && <p role="status">Loading reveal options…</p>}
          {policy && (
            <form
              className="min-w-0 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (valid && !mutation.isPending) mutation.mutate()
              }}
            >
              {policy.reasons.length > 0 && (
                <div className="space-y-1">
                  <label htmlFor="reveal-reason">Reason</label>
                  <select
                    id="reveal-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    data-qqq-id="reveal-reason"
                    className="min-h-11 w-full min-w-0 rounded border border-input bg-background px-2 text-foreground"
                  >
                    <option value="">Select a reason</option>
                    {policy.reasons.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
              )}
              {(policy.allowFreeText || policy.requireFreeText) && (
                <div className="space-y-1">
                  <label htmlFor="reveal-reason-text">
                    Additional reason{textRequired ? ' (required)' : ''}
                  </label>
                  <textarea
                    id="reveal-reason-text"
                    value={reasonText}
                    required={textRequired}
                    aria-required={!!textRequired}
                    maxLength={500}
                    onChange={(event) => setReasonText(event.target.value)}
                    data-qqq-id="reveal-reason-text"
                    className="min-h-24 w-full rounded border border-input bg-background p-2 text-foreground"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Visible for {policy.durationMinutes} minutes.{' '}
                {policy.remainingToday === null
                  ? 'No daily limit.'
                  : `${policy.remainingToday} reveals remaining today.`}
              </p>
              {policy.remainingToday === 0 && (
                <p role="alert" className="text-sm text-destructive">
                  Your daily reveal allowance has been reached.
                </p>
              )}
              {error && (
                <p role="alert" className="break-words text-sm text-destructive">
                  {getErrorMessage(error)}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={mutation.isPending}
                  data-qqq-id="reveal-cancel"
                  className="min-h-11 rounded border border-input px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!valid || mutation.isPending}
                  data-qqq-id="reveal-submit"
                  className="min-h-11 rounded bg-primary px-4 text-primary-foreground disabled:opacity-50"
                >
                  {mutation.isPending ? 'Revealing…' : 'Reveal value'}
                </button>
              </div>
            </form>
          )}
          {!policy && error && (
            <p role="alert" className="text-destructive">
              {getErrorMessage(error)}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
