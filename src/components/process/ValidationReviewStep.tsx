'use client'

// ValidationReviewStep — renders a VALIDATION step
// Shows validation errors/warnings table, allows user to proceed or go back

import React, { useState } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, ChevronRight, X } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

export interface ValidationRow {
  rowNumber?: number
  fieldName?: string
  type: 'ERROR' | 'WARNING' | 'INFO'
  message: string
}

export interface ValidationReviewStepProps {
  step: QFrontendStepMetaData
  stepValues: Record<string, unknown>
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  onBack?: () => void
  canGoBack: boolean
  isLastStep: boolean
}

function parseValidationRows(stepValues: Record<string, unknown>): ValidationRow[] {
  // Try to get rows from step values
  if (Array.isArray(stepValues.validationRows)) {
    return stepValues.validationRows as ValidationRow[]
  }
  if (Array.isArray(stepValues.processResults)) {
    return stepValues.processResults as ValidationRow[]
  }
  return []
}

function getSummary(rows: ValidationRow[]) {
  const errors = rows.filter((r) => r.type === 'ERROR').length
  const warnings = rows.filter((r) => r.type === 'WARNING').length
  return { errors, warnings }
}

export function ValidationReviewStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ValidationReviewStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const rows = parseValidationRows(stepValues)
  const { errors, warnings } = getSummary(rows)

  const errorCount = (stepValues.errorRecords as number) ?? errors
  const warningCount = (stepValues.warningRecords as number) ?? warnings
  const totalRecords = (stepValues.totalRecords as number) ?? 0
  const validRecords = (stepValues.validRecords as number) ?? 0

  const hasErrors = errorCount > 0
  const canProceed = !hasErrors

  return (
    <div className="space-y-6" data-qqq-id={`process-validation-step-${step.name}`}>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {totalRecords > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{totalRecords}</div>
            <div className="mt-1 text-xs text-muted-foreground">Total Records</div>
          </div>
        )}
        {validRecords > 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{validRecords}</div>
            <div className="mt-1 text-xs text-green-600">Valid</div>
          </div>
        )}
        {warningCount > 0 && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-700">{warningCount}</div>
            <div className="mt-1 text-xs text-yellow-600">Warnings</div>
          </div>
        )}
        {errorCount > 0 && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{errorCount}</div>
            <div className="mt-1 text-xs text-destructive">Errors</div>
          </div>
        )}
      </div>

      {/* Status message */}
      {hasErrors ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          data-qqq-id="validation-error-alert"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span>
            Found {errorCount} error{errorCount !== 1 ? 's' : ''} that must be fixed before proceeding.
            Please go back and correct the issues.
          </span>
        </div>
      ) : warningCount > 0 ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700"
          data-qqq-id="validation-warning-alert"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span>
            Found {warningCount} warning{warningCount !== 1 ? 's' : ''}.
            You may proceed, but please review the warnings below.
          </span>
        </div>
      ) : (
        <div
          role="status"
          className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          data-qqq-id="validation-success-alert"
        >
          <CheckCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span>Validation passed. All records are ready to process.</span>
        </div>
      )}

      {/* Validation rows table */}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table
            className="min-w-full divide-y divide-border"
            data-qqq-id="validation-table"
          >
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                >
                  Row
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                >
                  Field
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                >
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-accent"
                  data-qqq-id={`validation-row-${idx}`}
                >
                  <td className="px-4 py-3 text-sm">
                    {row.type === 'ERROR' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        Error
                      </span>
                    )}
                    {row.type === 'WARNING' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Warning
                      </span>
                    )}
                    {row.type === 'INFO' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Info
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.rowNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                    {row.fieldName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {row.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              disabled={isLoading || hasErrors}
              data-qqq-id="button-proceed"
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              {isLastStep ? 'Submit' : canProceed ? 'Proceed' : 'Cannot Proceed'}
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
