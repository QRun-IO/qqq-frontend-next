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
 * @file AssistantPanelFailure — what the assistant panel shows when it crashes: the page keeps
 * working, and the user can retry, copy the details or report a bug.
 */

'use client'

import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Bug, Copy, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'

import { clientErrorDetails, type ClientErrorReport } from '@/lib/errors/client-errors'
import { useQaCaptureCapability } from '@/lib/hooks/use-qa-capture'
import type { RouteMetaData } from '@/lib/qa-capture/route-context'
import { queryKeys } from '@/lib/query-client'
import { useAssistant } from './assistant-context'

const BUTTON = 'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 pointer-coarse:min-h-11'

/**
 * Starts a QA capture bug report, when QA capture is enabled for this user.
 *
 * @returns The action, or null when reporting is unavailable.
 */
function useReportBug(): { busy: boolean; report: () => Promise<void> } | null {
  const capability = useQaCaptureCapability()
  const client = useQueryClient()
  const [busy, setBusy] = useState(false)
  if (!capability?.enabled || !capability.canReport) return null
  return {
    busy,
    report: async () => {
      if (busy) return
      setBusy(true)
      try {
        // loaded on demand: this card ships with the app shell
        const { startBugReport } = await import('@/lib/qa-capture/report')
        await startBugReport({ capability, metaData: client.getQueryData<RouteMetaData>(queryKeys.metadataAll()) })
      } catch (error) {
        toast.error(error instanceof Error && error.message ? `Could not start the bug report: ${error.message}` : 'Could not start the bug report.')
      } finally {
        setBusy(false)
      }
    },
  }
}

/**
 * The crashed panel's replacement: a small card with Retry, Copy details, Report a bug and Close.
 * Shown only while the panel is open; the page around it is untouched.
 *
 * @param props - The failure.
 * @param props.report - The report built for the crash (null until it is built).
 * @param props.error - The error.
 * @param props.onRetry - Mounts the panel again.
 * @returns The card, or null when the panel is closed.
 */
export function AssistantPanelFailure({ report, error, onRetry }: { report: ClientErrorReport | null; error: Error; onRetry: () => void }) {
  const assistant = useAssistant()
  const bug = useReportBug()
  if (!assistant?.open) return null
  const details = report ? clientErrorDetails(report) : `${error.name}: ${error.message}`

  /** Copies the details for a bug report. */
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details)
      toast.success('Details copied')
    } catch {
      toast.error('Could not copy the details.')
    }
  }

  return (
    <aside
      className="fixed bottom-4 right-4 z-[var(--qqq-z-modal,1000)] w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-lg"
      role="alert"
      aria-label="Assistant"
      data-qqq-id="assistant-panel-error"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">The assistant hit a problem</p>
          <p className="mt-0.5 text-xs text-muted-foreground">The rest of the page still works. Retry to reopen the assistant; your conversations are kept.</p>
        </div>
        <button
          type="button"
          onClick={() => assistant.setOpen(false)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11 pointer-coarse:w-11"
          aria-label="Close assistant"
          data-qqq-id="assistant-panel-error-close"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className={BUTTON} data-qqq-id="assistant-panel-error-retry">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Retry
        </button>
        <button type="button" onClick={() => void copy()} className={BUTTON} data-qqq-id="assistant-panel-error-copy">
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />Copy details
        </button>
        {bug && (
          <button type="button" onClick={() => void bug.report()} disabled={bug.busy} className={BUTTON} data-qqq-id="assistant-panel-error-report">
            <Bug className="h-3.5 w-3.5" aria-hidden="true" />{bug.busy ? 'Starting...' : 'Report a bug'}
          </button>
        )}
      </div>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">Details</summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-1.5 font-mono text-[11px]" data-qqq-id="assistant-panel-error-details">{details}</pre>
      </details>
    </aside>
  )
}
