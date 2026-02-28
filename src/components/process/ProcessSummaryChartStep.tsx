/**
 * ProcessSummaryChartStep — renders a PROCESS_SUMMARY_CHART process step.
 *
 * Displays a visual summary of process results in chart form.  When structured
 * chart data is available in `stepValues` (under `chartData`, `labels`, or
 * `values` keys), it renders a simple horizontal bar chart using only HTML and
 * Tailwind CSS — no external chart library required.
 *
 * Falls back to a placeholder message when chart data is absent.
 */
'use client'

// ProcessSummaryChartStep -- renders a PROCESS_SUMMARY_CHART step
// Renders a bar chart from stepValues chart data; falls back to a placeholder.

import React, { useState } from 'react'
import { ChevronRight, X, BarChart2 } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link ProcessSummaryChartStep} component.
 */
export interface ProcessSummaryChartStepProps {
  /** Metadata for the current process step. */
  step: QFrontendStepMetaData
  /** Current accumulated step values; checked for chart data. */
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

/** A single bar in the summary chart. */
interface ChartBar {
  /** Bar label. */
  label: string
  /** Numeric value for this bar. */
  value: number
  /** Optional Tailwind color class (falls back to `bg-primary`). */
  color?: string
}

/**
 * Resolves chart bars from `stepValues`.
 *
 * Tries to read a `chartData` array of `{ label, value }` objects, or constructs
 * bars from the same well-known count keys as `ProcessSummaryResultsStep`.
 *
 * @param stepValues - The current accumulated step values.
 * @returns An array of chart bars; empty when no chart data is present.
 */
function resolveChartBars(stepValues: Record<string, unknown>): ChartBar[] {
  // Check for explicit chartData array: [{ label: string, value: number, color?: string }]
  const chartData = stepValues.chartData
  if (Array.isArray(chartData) && chartData.length > 0) {
    return chartData
      .filter((d) => typeof d === 'object' && d !== null && 'label' in d && 'value' in d)
      .map((d) => ({
        label: String((d as { label: unknown }).label),
        value: Number((d as { value: unknown }).value),
        color: typeof (d as { color?: unknown }).color === 'string'
          ? (d as { color: string }).color
          : undefined,
      }))
      .filter((b) => !isNaN(b.value))
  }

  // Fall back to the same well-known count keys used by ProcessSummaryResultsStep
  const bars: ChartBar[] = []
  const checks: Array<[string | undefined, string, string]> = [
    [String(stepValues.recordsInserted ?? stepValues.insertedCount ?? stepValues.importedCount ?? ''), 'Records Inserted', 'bg-green-500'],
    [String(stepValues.recordsUpdated ?? stepValues.updatedCount ?? ''), 'Records Updated', 'bg-primary'],
    [String(stepValues.recordsDeleted ?? stepValues.deletedCount ?? ''), 'Records Deleted', 'bg-destructive'],
    [String(stepValues.sentCount ?? ''), 'Sent', 'bg-green-500'],
    [String(stepValues.failedCount ?? ''), 'Failed', 'bg-destructive'],
    [String(stepValues.processedCount ?? stepValues.totalProcessed ?? ''), 'Processed', 'bg-primary'],
  ]

  for (const [raw, label, color] of checks) {
    if (raw && raw !== 'undefined' && raw !== 'null') {
      const n = Number(raw)
      if (!isNaN(n) && n > 0) bars.push({ label, value: n, color })
    }
  }

  return bars
}

/**
 * Renders a PROCESS_SUMMARY_CHART process step.
 *
 * Displays a CSS/Tailwind horizontal bar chart when chart data is available in
 * `stepValues`, or a placeholder icon when it is absent.  Navigation controls
 * allow proceeding to the next step.
 *
 * @param props - {@link ProcessSummaryChartStepProps}
 */
export function ProcessSummaryChartStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessSummaryChartStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const bars = resolveChartBars(stepValues)
  const maxValue = bars.length > 0 ? Math.max(...bars.map((b) => b.value), 1) : 1

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <div className="space-y-6" data-qqq-id="process-summary-chart-step">
      {/* Help text */}
      {helpTextComponents.map((comp, idx) => (
        <div
          key={idx}
          className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
          data-qqq-id={`process-help-text-${step.name}-${idx}`}
        >
          {String(comp.values?.text ?? '')}
        </div>
      ))}

      {/* Chart */}
      {bars.length > 0 ? (
        <div
          className="space-y-3 rounded-xl border border-border bg-card p-6"
          data-qqq-id="process-summary-chart"
          role="img"
          aria-label="Process summary chart"
        >
          {bars.map((bar, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{bar.label}</span>
                <span className="text-muted-foreground">{bar.value.toLocaleString()}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', bar.color ?? 'bg-primary')}
                  style={{ width: `${Math.min(100, (bar.value / maxValue) * 100)}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted p-8 text-center"
          data-qqq-id="process-summary-chart-empty"
        >
          <BarChart2 className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No chart data available for this step.</p>
        </div>
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
