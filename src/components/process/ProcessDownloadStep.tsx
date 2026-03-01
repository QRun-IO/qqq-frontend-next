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
 * @file ProcessDownloadStep — renders a DOWNLOAD_FORM process step.
 *
 * Displays optional view-field context values and a prominent download link
 * for the file produced by the process.  The download URL and filename are
 * resolved from well-known `stepValues` keys.
 */
'use client'

import React, { useState } from 'react'
import { Download, ChevronRight, X } from 'lucide-react'

import type { QFrontendStepMetaData, QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link ProcessDownloadStep} component.
 */
export interface ProcessDownloadStepProps {
  /** Metadata for the current process step, including `viewFields`. */
  step: QFrontendStepMetaData
  /** Current accumulated step values; must contain a recognised download URL key. */
  stepValues: Record<string, unknown>
  /** Whether a submission is in progress; disables controls while true. */
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
 * Resolves a download URL from the step values by checking a prioritised list
 * of well-known key names used by different QQQ backend processes.
 *
 * @param stepValues - The current step's accumulated values.
 * @returns The first non-empty string URL found, or null if none is present.
 */
function resolveDownloadUrl(stepValues: Record<string, unknown>): string | null {
  // Check common step value keys used for download URLs
  const candidates = [
    'downloadUrl',
    'downloadURL',
    'serverFilePath',
    'filePath',
    'fileUrl',
    'fileURL',
    'resultUrl',
    'resultURL',
  ]

  for (const key of candidates) {
    const val = stepValues[key]
    if (typeof val === 'string' && val.length > 0) {
      return val
    }
  }

  return null
}

/**
 * Resolves a suggested filename from well-known step value keys.
 *
 * @param stepValues - The current step's accumulated values.
 * @returns The first non-empty string filename found, or `'download'` as a fallback.
 */
function resolveFileName(stepValues: Record<string, unknown>): string {
  const candidates = ['fileName', 'filename', 'downloadFileName']
  for (const key of candidates) {
    const val = stepValues[key]
    if (typeof val === 'string' && val.length > 0) {
      return val
    }
  }
  return 'download'
}

/**
 * Formats a raw field value for display in the view-fields context section.
 *
 * @param field - The field metadata used to determine the type.
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
 * Renders a DOWNLOAD_FORM process step.
 *
 * Dispatched from `ProcessRun` when `resolveStepType` returns `'DOWNLOAD'`.
 * Displays any `step.viewFields` as a read-only `<dl>` context block, then a
 * dashed download area.  When a URL is resolved from `stepValues` via
 * `resolveDownloadUrl`, a native `<a download>` link is rendered pointing at
 * that URL with the filename from `resolveFileName`; otherwise a "still
 * processing" placeholder is shown.  The Finish / Next button allows the user
 * to proceed even without downloading (e.g. to acknowledge the step).
 *
 * @param props - {@link ProcessDownloadStepProps}
 * @returns A `<div>` with optional help-text banners, view-field context, a
 *   download area, and a sticky Cancel / Back / Finish|Next action bar.
 */
export function ProcessDownloadStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessDownloadStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const viewFields = step.viewFields ?? []
  const downloadUrl = resolveDownloadUrl(stepValues)
  const fileName = resolveFileName(stepValues)

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <div className="space-y-6" data-qqq-id="process-download-step">
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

      {/* View fields as context */}
      {viewFields.length > 0 && (
        <dl
          className="divide-y divide-border rounded-xl border border-border"
          data-qqq-id="process-download-view-fields"
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

      {/* Download area */}
      <div
        className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted p-8 text-center"
        data-qqq-id="process-download-area"
      >
        <Download
          className="h-10 w-10 text-primary"
          aria-hidden="true"
        />
        {downloadUrl ? (
          <>
            <p className="text-sm font-medium text-foreground">
              Your file is ready for download.
            </p>
            <a
              href={downloadUrl}
              download={fileName}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'transition-colors duration-150'
              )}
              data-qqq-id="button-download-file"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download {fileName}
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No download available. The file may still be processing.
          </p>
        )}
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
