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
 * @file ProcessViewStep — renders a VIEW_FORM process step as a read-only field display.
 */
/**
 * ProcessViewStep — renders a VIEW_FORM process step as a read-only field display.
 *
 * Iterates `step.viewFields` and renders each field's label and value from
 * `stepValues` as a definition list.  HTML-typed fields are sanitized with
 * DOMPurify; all other types are formatted by {@link formatFieldValue}.
 */
'use client'

// ProcessViewStep -- renders a VIEW_FORM step as read-only field display
// Iterates step.viewFields and shows label/value pairs from stepValues

import React, { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'

import DOMPurify from 'dompurify'

import type { QFrontendStepMetaData, QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link ProcessViewStep} component.
 */
export interface ProcessViewStepProps {
  /** Metadata for the current process step, including `viewFields` and `components`. */
  step: QFrontendStepMetaData
  /** Current accumulated step values providing the field display data. */
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
 * Formats a raw step value for display in the read-only view fields list.
 *
 * @param field - Field metadata used to determine type-specific formatting.
 * @param value - The raw value from `stepValues`.
 * @returns A human-readable string, or an em-dash for empty/null values.
 */
function formatFieldValue(field: QFieldMetaData, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '\u2014'
  }

  switch (field.type) {
    case 'BOOLEAN':
      return value === true || value === 'true' || value === 1 ? 'Yes' : 'No'
    case 'DATE':
    case 'DATE_TIME':
    case 'TIME':
      return String(value)
    default:
      return String(value)
  }
}

/**
 * Renders a VIEW_FORM process step as a read-only definition list.
 *
 * Displays HELP_TEXT banners, then each view field as a `<dt>`/`<dd>` pair.
 * HTML-typed fields are sanitized with DOMPurify before rendering; other types
 * are formatted by {@link formatFieldValue}.
 *
 * @param props - {@link ProcessViewStepProps}
 * @returns The rendered view step.
 */
export function ProcessViewStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessViewStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const viewFields = step.viewFields ?? []

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <div className="space-y-6" data-qqq-id="process-view-step">
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

      {/* View fields as read-only display */}
      {viewFields.length > 0 ? (
        <dl
          className="divide-y divide-border rounded-xl border border-border"
          data-qqq-id="process-view-fields"
        >
          {viewFields.map((field) => (
            <div
              key={field.name}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4"
              data-qqq-id={`process-view-field-${field.name}`}
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
      ) : (
        <div className="text-sm text-muted-foreground">
          No fields to display for this step.
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
