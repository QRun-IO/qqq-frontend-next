'use client'

/**
 * Global error boundary — Next.js `error.tsx` component that catches unhandled
 * exceptions at the route level.
 *
 * Detects 401 / session-expired conditions and renders a "Session Expired"
 * card with a login link. All other errors render a generic error card with
 * a "Try Again" button (which invokes `reset()` to re-render the segment)
 * and a "Go Home" link.
 */

import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Renders the global route-level error UI.
 *
 * Next.js automatically passes `error` and `reset` when any Server or Client
 * Component in the route segment throws an unhandled error.
 *
 * @param error - The thrown error, optionally decorated with a `digest` ID from Next.js.
 * @param reset - Next.js callback that retries rendering the failed route segment.
 * @returns A full-screen card describing the error with recovery actions.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  const is401 =
    error.message?.includes('401') ||
    error.message?.toLowerCase().includes('unauthorized') ||
    error.message?.toLowerCase().includes('session expired')

  if (is401) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-foreground">
              Session Expired
            </h1>
            <p className="text-muted-foreground">
              Your session has expired. Please log in again to continue.
            </p>
            <Link
              href="/login"
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-qqq-id="button-go-to-login"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred.'}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-qqq-id="button-try-again"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try Again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-qqq-id="link-go-home"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
