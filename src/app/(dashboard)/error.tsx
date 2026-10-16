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
 * @file Page error boundary — a page that throws is replaced inside the app shell, so the
 * navigation, header and assistant keep working.
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'

import { clientErrorDetails, reportClientError, type ClientErrorReport } from '@/lib/errors/client-errors'

/**
 * Whether the error means the session ended (the root boundary sends the user to log in).
 *
 * @param error - The thrown error.
 * @returns True for 401 / unauthorized / session expired.
 */
function isSessionError(error: Error): boolean {
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('401') || message.includes('unauthorized') || message.includes('session expired')
}

/**
 * The page-level fallback, rendered by Next.js inside the dashboard layout.
 *
 * @param props - The Next.js error boundary props.
 * @param props.error - The thrown error.
 * @param props.reset - Renders the page again.
 * @returns A card with Try again, Go home and the error's details.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [report, setReport] = useState<ClientErrorReport | null>(null)
  const sessionExpired = isSessionError(error)
  useEffect(() => {
    if (!sessionExpired) setReport(reportClientError(error, { scope: 'page' }))
  }, [error, sessionExpired])
  // the root boundary owns the "Session Expired" screen
  if (sessionExpired) throw error

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center shadow-sm" role="alert" data-qqq-id="page-error">
      <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-foreground">This page hit a problem</h1>
      <p className="mt-1 text-sm text-muted-foreground">The rest of the app still works. Try again, or go to another page.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
          data-qqq-id="button-page-try-again"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
          data-qqq-id="link-page-go-home"
        >
          Go home
        </Link>
      </div>
      {report && (
        <details className="mt-4 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Details</summary>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 font-mono" data-qqq-id="page-error-details">{clientErrorDetails(report)}</pre>
        </details>
      )}
    </div>
  )
}
