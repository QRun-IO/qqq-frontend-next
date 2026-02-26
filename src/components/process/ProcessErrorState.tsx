'use client'

// ProcessErrorState — displays process errors with retry and back options

import React from 'react'
import { XCircle, RefreshCw, ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export interface ProcessErrorStateProps {
  error: string | null
  processName: string
  onRetry?: () => void
  onCancel: () => void
}

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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <XCircle
            className="h-10 w-10 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Error heading */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Process Error
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          An error occurred while running the process.
        </p>
      </div>

      {/* Error details */}
      {error && (
        <div className="mx-auto max-w-lg rounded-md border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
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
            'inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium',
            'text-gray-700 bg-white hover:bg-gray-50',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            'dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700',
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
              'text-white bg-red-600 hover:bg-red-700',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
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
