'use client'

// ProcessHtmlStep -- renders an HTML step
// Displays HTML content from stepValues or viewFields inside a sanitized container

import React, { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import DOMPurify from 'dompurify'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html)
}

export interface ProcessHtmlStepProps {
  step: QFrontendStepMetaData
  stepValues: Record<string, unknown>
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  onBack?: () => void
  canGoBack: boolean
  isLastStep: boolean
}

function resolveHtmlContent(
  step: QFrontendStepMetaData,
  stepValues: Record<string, unknown>
): string {
  // Check stepValues for HTML content under common keys
  if (typeof stepValues.html === 'string' && stepValues.html.length > 0) {
    return stepValues.html
  }
  if (typeof stepValues.htmlContent === 'string' && stepValues.htmlContent.length > 0) {
    return stepValues.htmlContent
  }

  // Check the HTML component's values
  const htmlComponent = step.components.find((c) => c.type === 'HTML')
  if (htmlComponent?.values?.html && typeof htmlComponent.values.html === 'string') {
    return htmlComponent.values.html
  }
  if (htmlComponent?.values?.content && typeof htmlComponent.values.content === 'string') {
    return htmlComponent.values.content
  }

  // Check viewFields for HTML type fields
  if (step.viewFields) {
    for (const field of step.viewFields) {
      if (field.type === 'HTML') {
        const val = stepValues[field.name]
        if (typeof val === 'string' && val.length > 0) {
          return val
        }
      }
    }
  }

  return ''
}

export function ProcessHtmlStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessHtmlStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const htmlContent = resolveHtmlContent(step, stepValues)

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <div className="space-y-6" data-qqq-id="process-html-step">
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

      {/* HTML content */}
      {htmlContent ? (
        <div
          className="prose prose-sm max-w-none rounded-xl border border-border bg-card p-4"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlContent) }}
          data-qqq-id="process-html-content"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
          No content to display for this step.
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
