/**
 * ProcessGoogleDriveStep — renders a GOOGLE_DRIVE_SELECT_FOLDER process step.
 *
 * The full Google Drive folder-picker requires OAuth 2.0 and the Google Picker
 * API, which are not yet integrated.  This component renders a labeled
 * placeholder explaining that Google Drive selection is not yet supported,
 * along with the standard Cancel / Back / Next navigation controls.
 *
 * When the Google Picker API becomes available, this component should be updated
 * to load the Picker script and open a folder-selection dialog.
 */
'use client'

// ProcessGoogleDriveStep -- placeholder for GOOGLE_DRIVE_SELECT_FOLDER step
// Full implementation requires Google Picker API integration (not yet available)

import React, { useState } from 'react'
import { ChevronRight, X, FolderOpen } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/**
 * Props for the {@link ProcessGoogleDriveStep} component.
 */
export interface ProcessGoogleDriveStepProps {
  /** Metadata for the current process step. */
  step: QFrontendStepMetaData
  /** Current accumulated step values. */
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
 * Renders a placeholder for the GOOGLE_DRIVE_SELECT_FOLDER process step type.
 *
 * Displays a prominent notice that Google Drive integration is not yet available,
 * while still allowing the user to navigate forward (for processes that may handle
 * a missing folder selection gracefully server-side).
 *
 * @param props - {@link ProcessGoogleDriveStepProps}
 */
export function ProcessGoogleDriveStep({
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: ProcessGoogleDriveStepProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  // Help text from HELP_TEXT components
  const helpTextComponents = step.components.filter((c) => c.type === 'HELP_TEXT')

  return (
    <div className="space-y-6" data-qqq-id="process-google-drive-step">
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

      {/* Google Drive placeholder */}
      <div
        className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted p-8 text-center"
        data-qqq-id="process-google-drive-placeholder"
        role="status"
        aria-label="Google Drive folder picker not yet available"
      >
        <FolderOpen className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Google Drive Folder Selection</p>
          <p className="text-sm text-muted-foreground">
            Google Drive integration is not yet available in this interface.
            Please contact your administrator or use an alternative method to specify
            the destination folder.
          </p>
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
