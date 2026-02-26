'use client'

// ProcessWidgetStep -- renders a WIDGET step
// Displays widget content from stepValues and/or viewFields.
// The actual widget rendering is deferred to widget infrastructure;
// this component provides the step shell with navigation.

import React, { useState } from 'react'
import { ChevronRight, X, LayoutGrid } from 'lucide-react'

import type { QFrontendStepMetaData, QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

export interface ProcessWidgetStepProps {
  step: QFrontendStepMetaData
  stepValues: Record<string, unknown>
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  onBack?: () => void
  canGoBack: boolean
  isLastStep: boolean
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

export function ProcessWidgetStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessWidgetStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const viewFields = step.viewFields ?? []

  // Look for the WIDGET component to extract widget metadata
  const widgetComponent = step.components.find((c) => c.type === 'WIDGET')
  const widgetName = widgetComponent?.values?.widgetName as string | undefined

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  // Check for widget HTML content that may have been rendered server-side
  const widgetHtml = (stepValues.widgetHtml ?? stepValues.html) as string | undefined

  return (
    <div className="space-y-6" data-qqq-id="process-widget-step">
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

      {/* Widget content */}
      {widgetHtml ? (
        <div
          className="prose prose-sm max-w-none rounded-xl border border-border bg-card p-4"
          dangerouslySetInnerHTML={{ __html: widgetHtml }}
          data-qqq-id="process-widget-html"
        />
      ) : (
        <div
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted p-8 text-center"
          data-qqq-id="process-widget-placeholder"
        >
          <LayoutGrid
            className="h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            {widgetName
              ? `Widget: ${widgetName}`
              : 'Widget content will be displayed here.'}
          </p>
        </div>
      )}

      {/* View fields */}
      {viewFields.length > 0 && (
        <dl
          className="divide-y divide-border rounded-xl border border-border"
          data-qqq-id="process-widget-view-fields"
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
                {formatFieldValue(field, stepValues[field.name])}
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
