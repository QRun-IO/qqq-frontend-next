'use client'

// ProcessSummaryResultsStep -- renders a PROCESS_SUMMARY_RESULTS step
// Distinct from ProcessResultStep (which is the final completion screen).
// This is an intermediate step that shows summary results before the user proceeds.

import React, { useState } from 'react'
import { CheckCircle, ChevronRight, X } from 'lucide-react'

import type { QFrontendStepMetaData, QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

// TODO: Replace with DOMPurify for full sanitization (https://github.com/cure53/DOMPurify)
// Minimal sanitization: strip script tags to prevent XSS from injected HTML
function stripScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}

export interface ProcessSummaryResultsStepProps {
  step: QFrontendStepMetaData
  stepValues: Record<string, unknown>
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  onBack?: () => void
  canGoBack: boolean
  isLastStep: boolean
}

interface ResultStat {
  label: string
  value: number
  color: string
}

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

function formatFieldValue(field: QFieldMetaData, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '\u2014'
  }
  if (field.type === 'BOOLEAN') {
    return value === true || value === 'true' || value === 1 ? 'Yes' : 'No'
  }
  return String(value)
}

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
                      __html: stripScripts(String(stepValues[field.name] ?? '')),
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
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-card px-6 py-3">
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
