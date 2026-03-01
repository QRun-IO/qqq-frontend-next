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
 * @file ProcessUnknownStep — fallback renderer for unrecognized process step component types.
 */
/**
 * ProcessUnknownStep — fallback renderer for unrecognized process step component types.
 *
 * When `resolveStepType` cannot match any known component type, this component
 * renders a descriptive notice listing the unrecognized component type names,
 * along with the standard Cancel / Back / Next navigation controls so the user
 * can continue the process.
 */
'use client'

// ProcessUnknownStep -- fallback for unrecognized QComponentType values
// Renders a graceful notice instead of crashing the process wizard

import React, { useState } from 'react'
import { ChevronRight, X, AlertCircle } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link ProcessUnknownStep} component.
 */
export interface ProcessUnknownStepProps {
  /** Metadata for the current process step, used to extract unrecognized type names. */
  step: QFrontendStepMetaData
  /** Current accumulated step values passed through unchanged on submit. */
  stepValues: Record<string, unknown>
  /** Whether a submission is in progress; disables navigation controls while true. */
  isLoading: boolean
  /**
   * Called when the user advances past this step.
   *
   * @param values - The current step values passed through unchanged.
   */
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  /** Called when the user confirms cancellation of the process. */
  onCancel: () => void
  /** Called when the user clicks Back; only rendered if `canGoBack` is true. */
  onBack?: () => void
  /** Whether a previous step exists to navigate back to. */
  canGoBack: boolean
  /** Whether this is the final step in the process (controls button label). */
  isLastStep: boolean
}

/**
 * Renders a graceful fallback for a process step with unrecognized component types.
 *
 * Lists the component type names present in the step so developers can identify
 * which renderer is missing.  Allows the user to navigate forward or back.
 *
 * @param props - {@link ProcessUnknownStepProps}
 * @returns The rendered unknown step fallback.
 */
export function ProcessUnknownStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessUnknownStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  // Collect all component type names for the diagnostic display
  const componentTypeNames = step.components
    .map((c) => c.type as string)
    .filter((t) => t !== 'HELP_TEXT')

  return (
    <div className="space-y-6" data-qqq-id="process-unknown-step">
      {/* Diagnostic notice */}
      <div
        className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
        role="status"
        aria-label="Unrecognized step type"
        data-qqq-id="process-unknown-step-notice"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <p className="font-medium">Unrecognized step type</p>
          <p className="text-amber-800">
            This step contains component types that are not yet supported by this interface.
          </p>
          {componentTypeNames.length > 0 && (
            <p className="text-amber-800">
              Component types:{' '}
              {componentTypeNames.map((t, i) => (
                <React.Fragment key={t}>
                  <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono">{t}</code>
                  {i < componentTypeNames.length - 1 && ', '}
                </React.Fragment>
              ))}
            </p>
          )}
          <p className="text-amber-700 text-xs">You may continue to the next step or go back.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-card px-6 py-3 md:relative md:bottom-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            disabled={isLoading}
            data-qqq-id="button-cancel"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors duration-150'
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {canGoBack && onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={isLoading}
                data-qqq-id="button-back"
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
                  'text-foreground bg-card hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'transition-colors duration-150'
                )}
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={() => onSubmit(stepValues)}
              disabled={isLoading}
              data-qqq-id="button-next"
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              {isLastStep ? 'Submit' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <ProcessCancelDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={onCancel}
      />
    </div>
  )
}
