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
 * @file AssistantPendingActionCard — a write the assistant proposed (create, update or delete a
 * record). Nothing changes until the user confirms; the server then runs the write through the
 * UI API with the user's own session, so the same permissions, record locks and validation apply.
 * The card loads the action's current state, so a reloaded conversation shows the outcome.
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Check, PencilLine, Plus, Trash2, X } from 'lucide-react'

import type { AssistantPendingAction, AssistantPendingActionRender } from '@/types/assistant'
import { confirmAssistantAction, getAssistantAction, rejectAssistantAction } from '@/lib/api/assistant'
import { internalAppHref } from '@/lib/utils/assistant-links'
import { getErrorMessage } from '@/lib/utils/error-utils'

/** What a finished action says, by status. */
const STATUS_TEXT: Record<AssistantPendingAction['status'], string> = {
  PENDING: 'Waiting for your confirmation',
  RUNNING: 'Saving…',
  EXECUTED: 'Done',
  FAILED: 'Not saved',
  REJECTED: 'Cancelled, nothing changed',
  EXPIRED: 'Expired, nothing changed',
}

/**
 * The confirmation card of one proposed write.
 *
 * @param props - Component properties.
 * @param props.render - The `pending_action` payload of the tool result.
 * @returns The card.
 */
export default function AssistantPendingActionCard({ render }: { render: AssistantPendingActionRender }) {
  const [action, setAction] = useState<AssistantPendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    let live = true
    getAssistantAction(render.actionId)
      .then((loaded) => {
        if (live) setAction(loaded)
      })
      .catch((e: unknown) => {
        if (live) setError(getErrorMessage(e, 'Could not load this action.'))
      })
    return () => {
      live = false
    }
  }, [render.actionId])

  const status = action?.status ?? 'PENDING'
  const pending = status === 'PENDING'
  const Icon = render.toolName === 'delete_record' ? Trash2 : render.toolName === 'create_record' ? Plus : PencilLine
  const verb = render.toolName === 'delete_record' ? 'Delete' : render.toolName === 'create_record' ? 'Create' : 'Save'
  const resultHref = internalAppHref(action?.href ?? render.href)
  const tone = status === 'EXECUTED' ? 'text-emerald-700 dark:text-emerald-400' : status === 'FAILED' ? 'text-destructive' : 'text-muted-foreground'

  /**
   * Confirms or cancels.
   *
   * @param confirm - True to run the write.
   */
  async function decide(confirm: boolean) {
    setBusy(true)
    setError(null)
    try {
      const decided = confirm ? await confirmAssistantAction(render.actionId) : await rejectAssistantAction(render.actionId)
      setAction(decided)
      // the record screens on the page show the saved values without a reload
      if (decided.status === 'EXECUTED') await queryClient.invalidateQueries()
    } catch (e) {
      setError(getErrorMessage(e, confirm ? 'The change could not be saved.' : 'The action could not be cancelled.'))
      getAssistantAction(render.actionId).then(setAction).catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card" data-qqq-id="assistant-pending-action" role="group" aria-label={`Proposed change: ${render.summary}`}>
      <div className="flex items-start gap-2 border-b border-border px-3 py-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground break-words">{render.summary}</p>
          <p className={`text-xs ${tone}`} aria-live="polite" data-qqq-id="assistant-pending-action-status">
            {STATUS_TEXT[status]}
            {action?.resultSummary && status !== 'PENDING' ? ` · ${action.resultSummary}` : ''}
          </p>
        </div>
      </div>
      {render.changes.length > 0 && (
        <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 px-3 py-2 text-xs">
          {render.changes.map((change) => (
            <React.Fragment key={change.field}>
              <dt className="truncate text-muted-foreground">{change.label}</dt>
              <dd className="break-words text-foreground">{change.value ?? <span className="text-muted-foreground">(empty)</span>}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      {(error || action?.message) && status !== 'EXECUTED' && (
        <p className="px-3 pb-2 text-xs text-destructive" role="alert">{error ?? action?.message}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        {pending ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide(true)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${render.toolName === 'delete_record' ? 'bg-destructive text-white hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
              data-qqq-id="assistant-pending-action-confirm"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {busy ? 'Working…' : verb}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide(false)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              data-qqq-id="assistant-pending-action-cancel"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </button>
          </>
        ) : null}
        {resultHref && status !== 'REJECTED' && status !== 'EXPIRED' && (
          <Link href={resultHref} className="ml-auto inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline pointer-coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Open {render.tableLabel}
          </Link>
        )}
      </div>
    </div>
  )
}
