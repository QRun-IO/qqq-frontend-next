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
 * @file InlineFailure — the small, quiet fallback a failed part of a page shows in place, with
 * its details behind a toggle, so the rest of the page keeps working.
 */

'use client'

import React, { useId, useState } from 'react'
import { AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react'

import { clientErrorDetails, type ClientErrorReport } from '@/lib/errors/client-errors'
import { cn } from '@/lib/utils/cn'

/** Props of {@link InlineFailure}. */
export interface InlineFailureProps {
  /** What could not be shown, as a sentence. */
  message: string
  /** The report (its details are shown behind the toggle). */
  report?: ClientErrorReport | null
  /** The error, when no report was built. */
  error?: Error | null
  /** Shows a Retry button. */
  onRetry?: () => void
  /** The `data-qqq-id`. */
  qqqId?: string
  className?: string
}

/**
 * A one-line failure notice with a details toggle and an optional Retry.
 *
 * @param props - See {@link InlineFailureProps}.
 * @returns The notice.
 */
export function InlineFailure({ message, report, error, onRetry, qqqId = 'inline-failure', className }: InlineFailureProps) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const details = report ? clientErrorDetails(report) : error ? `${error.name}: ${error.message}` : null
  return (
    <div className={cn('rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground', className)} role="status" data-qqq-id={qqqId}>
      <div className="flex flex-wrap items-start gap-1.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 break-words">{message}</span>
        {details && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={detailsId}
            className="inline-flex items-center gap-0.5 rounded px-1 font-medium text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
            data-qqq-id={`${qqqId}-details-toggle`}
          >
            Details
            <ChevronRight className={cn('h-3 w-3 motion-safe:transition-transform', open && 'rotate-90')} aria-hidden="true" />
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded px-1 font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
            data-qqq-id={`${qqqId}-retry`}
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
      {details && (
        <pre id={detailsId} hidden={!open} className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-1.5 font-mono text-[11px]" data-qqq-id={`${qqqId}-details`}>
          {details}
        </pre>
      )}
    </div>
  )
}
