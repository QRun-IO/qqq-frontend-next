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
 * @file ProcessErrorState — the error screen of a process run: user-facing
 * messages are shown directly; other errors sit behind a "Show detailed error
 * message" toggle. Offers Retry (restart with the same input) and Close.
 */

'use client'

import React, { useId, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, RefreshCw, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/** Props for {@link ProcessErrorState}. */
export interface ProcessErrorStateProps {
  /** The error message. */
  error: string | null
  /** `true` when the backend wrote the message for users. */
  isUserFacing: boolean
  processName: string
  processLabel: string
  onRetry?: () => void
  onClose: () => void
}

const buttonBase = 'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'

/**
 * Render the process error screen.
 * @param props - {@link ProcessErrorStateProps}
 * @returns The error panel.
 */
export function ProcessErrorState({ error, isUserFacing, processName, processLabel, onRetry, onClose }: ProcessErrorStateProps) {
  const [showDetail, setShowDetail] = useState(false)
  const detailId = useId()
  return (
    <div className="space-y-6 p-8 text-center" role="alert" data-qqq-id={`process-error-${processName}`}>
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">Error</h3>
        <p className="text-sm text-muted-foreground">{`An error occurred while running the process: ${processLabel}`}</p>
        {error && isUserFacing && (
          <p className="text-sm font-bold text-foreground" data-qqq-id="process-error-message">{error}</p>
        )}
        {error && !isUserFacing && (
          <div>
            <button
              type="button"
              onClick={() => setShowDetail((value) => !value)}
              aria-expanded={showDetail}
              aria-controls={detailId}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-qqq-id="button-toggle-error-detail"
            >
              {showDetail ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              {showDetail ? 'Hide detailed error message' : 'Show detailed error message'}
            </button>
            <p id={detailId} hidden={!showDetail} className="mx-auto mt-2 max-w-lg break-all font-mono text-xs text-destructive" data-qqq-id="process-error-detail">
              {error}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onClose} className={cn(buttonBase, 'border border-border bg-card text-foreground hover:bg-accent')} data-qqq-id="button-close">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Close
        </button>
        {onRetry && (
          <button type="button" onClick={onRetry} className={cn(buttonBase, 'bg-primary text-primary-foreground hover:bg-primary/90')} data-qqq-id="button-retry">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
