/**
 * ProcessHtmlStep — renders an HTML process step.
 *
 * Resolves HTML content from `stepValues`, the step's HTML component, or any
 * HTML-typed view fields, then renders it inside a DOMPurify-sanitised container.
 */
'use client'

// ProcessHtmlStep -- renders an HTML step
// Displays HTML content from stepValues or viewFields inside a sanitized container

import React, { useState, useMemo } from 'react'
import { ChevronRight, X } from 'lucide-react'
import DOMPurify from 'dompurify'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Sanitizes raw HTML with DOMPurify to prevent XSS before rendering.
 *
 * @param html - Untrusted HTML string from the backend.
 * @returns A DOMPurify-sanitised HTML string safe to inject via `dangerouslySetInnerHTML`.
 */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html)
}

/**
 * Props for the {@link ProcessHtmlStep} component.
 */
export interface ProcessHtmlStepProps {
  /** Metadata for the current process step, including `components` and `viewFields`. */
  step: QFrontendStepMetaData
  /** Current accumulated step values; `html` / `htmlContent` keys are checked for content. */
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
 * Resolves the HTML content string to render for this step.
 *
 * Checks, in order: `stepValues.html`, `stepValues.htmlContent`, the step's
 * HTML component values, and finally any HTML-typed view fields.
 *
 * @param step - The current step metadata.
 * @param stepValues - The current accumulated step values.
 * @returns The raw HTML string, or an empty string if no content is found.
 */
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

/**
 * Renders an HTML process step.
 *
 * Displays sanitised HTML content resolved from `stepValues` or step component
 * metadata, with optional HELP_TEXT banners above and standard Cancel / Back /
 * Next navigation below.
 *
 * @param props - {@link ProcessHtmlStepProps}
 */
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

  // MED-4: memoize DOMPurify sanitization so it only re-runs when htmlContent changes
  const sanitizedHtml = useMemo(() => sanitizeHtml(htmlContent), [htmlContent])

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
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          data-qqq-id="process-html-content"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
          No content to display for this step.
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
