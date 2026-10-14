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

/** @file Opaque access request form; copy and responses never disclose record existence. */
'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { HANDLES_OWN_ERRORS } from '@/lib/query-client'
import { requestAccess } from '@/lib/api/collaboration'
import { collaborationButton, collaborationInput } from './CollaborationDialog'
/** Requests access to an opaque route target.
 * @param props - Target and optional share identity.
 * @returns Non-disclosing form.
 */
export function RequestAccess({
  tableName,
  recordId,
  shareId,
}: {
  tableName: string
  recordId: string
  shareId?: number
}) {
  const [message, setMessage] = useState('')
  const send = useMutation({
    meta: HANDLES_OWN_ERRORS,
    mutationFn: () => requestAccess({ tableName, recordId, shareId, message }),
  })
  return (
    <section
      className="mx-auto w-full max-w-lg space-y-3 rounded-xl border border-border bg-card p-5 text-left text-foreground"
      data-qqq-id="request-access"
    >
      <h1 className="text-lg font-semibold">Request access</h1>
      <p className="text-sm text-muted-foreground">
        This link is unavailable. You can ask an administrator to review your access.
      </p>
      {send.isSuccess ? (
        <p role="status">Your request has been submitted for review.</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            send.mutate()
          }}
        >
          <label className="block text-sm">
            Message
            <textarea
              className={collaborationInput}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              data-qqq-id="access-message"
            />
          </label>
          <button
            className={collaborationButton}
            disabled={send.isPending || !tableName || !recordId}
            data-qqq-id="access-submit"
          >
            Request access
          </button>
          {send.isError && (
            <p role="alert">
              We could not submit your request. Please try again or contact an administrator.
            </p>
          )}
        </form>
      )}
    </section>
  )
}
/** Prefills a shared access-request link without loading the target record.
 * @returns Access request page.
 */
export function RequestAccessPage() {
  const params = useSearchParams()
  const raw = params.get('shareId')
  const shareId =
    raw && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : undefined
  return (
    <RequestAccess
      tableName={params.get('tableName') ?? ''}
      recordId={params.get('recordId') ?? ''}
      shareId={shareId}
    />
  )
}
