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
 * ProcessErrorState — full-page error display for a failed process execution.
 *
 * Shows a destructive icon, a human-readable error detail block, and action
 * buttons to go back or retry the process.
 */
'use client'

// ProcessErrorState — displays process errors with retry and back options

import React from 'react'
import { XCircle, RefreshCw, ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link ProcessErrorState} component.
 */
export interface ProcessErrorStateProps {
  /** The error message string to display; null renders no detail block. */
  error: string | null
  /** The technical process name, used as the `data-qqq-id` suffix. */
  processName: string
  /** Optional retry callback; when provided a Retry button is rendered. */
  onRetry?: () => void
  /** Called when the user clicks "Go Back" to exit the error view. */
  onCancel: () => void
}

/**
 * Renders an accessible error state for a failed process.
 *
 * The container is marked with `role="alert"` so screen readers announce it
 * immediately.  The Retry button only appears when an `onRetry` handler is
 * provided.
 *
 * @param props - {@link ProcessErrorStateProps}
 */
export function ProcessErrorState({
  error,
  processName,
  onRetry,
  onCancel,
}: ProcessErrorStateProps) {
  return (
    <div
      className="space-y-6 text-center"
      role="alert"
      data-qqq-id={`process-error-${processName}`}
    >
      {/* Error icon */}
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <XCircle
            className="h-10 w-10 text-destructive"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Error heading */}
      <div>
        <h3 className="text-xl font-semibold text-foreground">
          Process Error
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          An error occurred while running the process.
        </p>
      </div>

      {/* Error details */}
      {error && (
        <div className="mx-auto max-w-lg rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-left text-sm text-destructive">
          <p className="font-medium">Error details:</p>
          <p className="mt-1 font-mono text-xs break-all">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          data-qqq-id="button-cancel"
          className={cn(
            'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
            'text-foreground bg-card hover:bg-accent',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'transition-colors duration-150'
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Go Back
        </button>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            data-qqq-id="button-retry"
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
              'text-destructive-foreground bg-destructive hover:bg-destructive/90',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'transition-colors duration-150'
            )}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
