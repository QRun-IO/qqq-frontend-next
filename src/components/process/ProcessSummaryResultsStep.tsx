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
 * ProcessSummaryResultsStep — renders a PROCESS_SUMMARY_RESULTS process step.
 *
 * An intermediate mid-process step (distinct from the final {@link ProcessResultStep})
 * that shows a success icon, numeric stats, and optional view-field detail rows
 * before the user continues to the next step.  HTML-typed view fields are
 * sanitized with DOMPurify before rendering.
 */
'use client'

// ProcessSummaryResultsStep -- renders a PROCESS_SUMMARY_RESULTS step
// Distinct from ProcessResultStep (which is the final completion screen).
// This is an intermediate step that shows summary results before the user proceeds.

import React, { useState } from 'react'
import { CheckCircle, ChevronRight, X } from 'lucide-react'

import DOMPurify from 'dompurify'

import type { QFrontendStepMetaData, QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link ProcessSummaryResultsStep} component.
 */
export interface ProcessSummaryResultsStepProps {
  /** Metadata for the current process step, including `viewFields`. */
  step: QFrontendStepMetaData
  /** Current accumulated step values containing stat counts and view-field data. */
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

/** A single numeric stat entry for the summary display. */
interface ResultStat {
  /** Human-readable label (e.g. "Records Inserted"). */
  label: string
  /** Numeric count to display prominently. */
  value: number
  /** Tailwind text-color class applied to the numeric value. */
  color: string
}

/**
 * Extracts labelled numeric stats from the step values.
 *
 * Checks multiple well-known key aliases so the component works across
 * different QQQ backend process implementations.
 *
 * @param stepValues - The current accumulated step values.
 * @returns An array of {@link ResultStat} entries; empty when no counts are present.
 */
function parseResultStats(stepValues: Record<string, unknown>): ResultStat[] {
  const stats: ResultStat[] = []

  const inserted = stepValues.recordsInserted ?? stepValues.insertedCount ?? stepValues.importedCount
  const updated = stepValues.recordsUpdated ?? stepValues.updatedCount
  const deleted = stepValues.recordsDeleted ?? stepValues.deletedCount
  const sent = stepValues.sentCount
  const failed = stepValues.failedCount
  const processed = stepValues.processedCount ?? stepValues.totalProcessed

  if (inserted !== undefined && Number(inserted) > 0) {
    stats.push({ label: 'Records Inserted', value: Number(inserted), color: 'text-green-600' })
  }
  if (updated !== undefined && Number(updated) > 0) {
    stats.push({ label: 'Records Updated', value: Number(updated), color: 'text-primary' })
  }
  if (deleted !== undefined && Number(deleted) > 0) {
    stats.push({ label: 'Records Deleted', value: Number(deleted), color: 'text-destructive' })
  }
  if (sent !== undefined && Number(sent) > 0) {
    stats.push({ label: 'Sent', value: Number(sent), color: 'text-green-600' })
  }
  if (failed !== undefined && Number(failed) > 0) {
    stats.push({ label: 'Failed', value: Number(failed), color: 'text-destructive' })
  }
  if (processed !== undefined && stats.length === 0) {
    stats.push({ label: 'Records Processed', value: Number(processed), color: 'text-green-600' })
  }

  return stats
}

/**
 * Formats a raw field value for display in the view-fields detail list.
 *
 * @param field - Field metadata used to determine type-specific formatting.
 * @param value - The raw value from `stepValues`.
 * @returns A human-readable string, or an em-dash for empty/null values.
 */
function formatFieldValue(field: QFieldMetaData, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '\u2014'
  }
  if (field.type === 'BOOLEAN') {
    return value === true || value === 'true' || value === 1 ? 'Yes' : 'No'
  }
  return String(value)
}

/**
 * Renders a PROCESS_SUMMARY_RESULTS process step.
 *
 * Shows a success icon, an optional message from `stepValues`, numeric stat
 * counters, and view-field detail rows (with HTML fields sanitized by DOMPurify).
 * Navigation controls allow proceeding to the next step or going back.
 *
 * @param props - {@link ProcessSummaryResultsStepProps}
 */
export function ProcessSummaryResultsStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessSummaryResultsStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const viewFields = step.viewFields ?? []
  const stats = parseResultStats(stepValues)
  const successMessage =
    (stepValues.successMessage as string) ??
    (stepValues.message as string) ??
    null

  return (
    <div className="space-y-6" data-qqq-id="process-summary-results-step">
      {/* Success icon and message */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle
            className="h-7 w-7 text-green-600"
            aria-hidden="true"
          />
        </div>
        {successMessage && (
          <p className="text-sm text-muted-foreground">{successMessage}</p>
        )}
      </div>

      {/* Result stats */}
      {stats.length > 0 && (
        <div
          className="flex flex-wrap justify-center gap-6"
          data-qqq-id="process-summary-stats"
        >
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center">
              <div className={cn('text-3xl font-bold', stat.color)}>{stat.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* View fields as detail display */}
      {viewFields.length > 0 && (
        <dl
          className="divide-y divide-border rounded-xl border border-border"
          data-qqq-id="process-summary-view-fields"
        >
          {viewFields.map((field) => (
            <div
              key={field.name}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <dt className="text-sm font-medium text-muted-foreground sm:w-1/3 sm:flex-shrink-0">
                {field.label}
              </dt>
              <dd className="text-sm text-foreground sm:flex-1">
                {field.type === 'HTML' ? (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(String(stepValues[field.name] ?? '')),
                    }}
                  />
                ) : (
                  formatFieldValue(field, stepValues[field.name])
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

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
              {isLastStep ? 'Finish' : 'Next'}
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
