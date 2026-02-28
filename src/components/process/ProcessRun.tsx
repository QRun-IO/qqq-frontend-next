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
 * ProcessRun — top-level process orchestrator component.
 *
 * Manages the full QQQ process lifecycle: idle → initializing → active steps
 * → polling → complete / error.  Validates `minInputRecords` / `maxInputRecords`
 * before initialising, dispatches the correct step component based on
 * `resolveStepType`, and renders a StepWizard progress indicator when the
 * process has more than one step.
 */
'use client'

// ProcessRun -- main process orchestrator component
// Manages the full process lifecycle: init -> steps -> complete/error

import React, { useEffect, useRef, useMemo } from 'react'
import { Loader2 } from 'lucide-react'

import type { QProcessMetaData, QFrontendStepMetaData, QFieldMetaData } from '@/types'
import { useProcess } from '@/lib/hooks/use-process'
import { toast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils/cn'

import { StepWizard } from './StepWizard'
import { ProcessFormStep } from './ProcessFormStep'
import { ValidationReviewStep } from './ValidationReviewStep'
import { RecordListStep } from './RecordListStep'
import { BulkLoadStep } from './BulkLoadStep'
import { ProcessResultStep } from './ProcessResultStep'
import { ProcessErrorState } from './ProcessErrorState'
import { ProcessViewStep } from './ProcessViewStep'
import { ProcessDownloadStep } from './ProcessDownloadStep'
import { ProcessHtmlStep } from './ProcessHtmlStep'
import { ProcessSummaryResultsStep } from './ProcessSummaryResultsStep'
import { ProcessSummaryChartStep } from './ProcessSummaryChartStep'
import { ProcessWidgetStep } from './ProcessWidgetStep'
import { ProcessBulkEditStep } from './ProcessBulkEditStep'
import { ProcessScriptViewerStep } from './ProcessScriptViewerStep'
import { ProcessUploadFormStep } from './ProcessUploadFormStep'
import { ProcessGoogleDriveStep } from './ProcessGoogleDriveStep'
import { ProcessUnknownStep } from './ProcessUnknownStep'

/**
 * Props for the {@link ProcessRun} component.
 */
export interface ProcessRunProps {
  /** Technical name of the process as declared in backend metadata. */
  processName: string
  /** Full process metadata including step definitions and input record constraints. */
  processMetaData: QProcessMetaData
  /** Optional initial values passed to the process init call (e.g. selected record IDs). */
  initialValues?: Record<string, unknown>
  /**
   * Called when the process reaches the COMPLETE state.
   *
   * @param resultValues - The final result values returned by the backend.
   */
  onComplete?: (resultValues: Record<string, unknown>) => void
  /** Additional CSS class names applied to the root container. */
  className?: string
}

/**
 * Resolved step type used for rendering dispatch.
 * Each value maps to a distinct step component.
 */
type ResolvedStepType =
  | 'FORM'
  | 'VALIDATION'
  | 'RECORD_LIST'
  | 'BULK_LOAD'
  | 'VIEW'
  | 'DOWNLOAD'
  | 'RESULTS'
  | 'RESULTS_CHART'
  | 'WIDGET'
  | 'HTML'
  | 'BULK_EDIT'
  | 'SCRIPT_VIEWER'
  | 'UPLOAD_FORM'
  | 'GOOGLE_DRIVE'
  | 'UNKNOWN'

/**
 * Determine what kind of step to render based on step components and fields.
 *
 * Priority order reflects specificity:
 * bulk load > validation > record list > specialized renderers > form fallback > unknown.
 *
 * String comparisons use `as string` casts to accommodate component types that are
 * not yet in the `QComponentType` union (e.g. `UPLOAD_FORM`, `SCRIPT_VIEWER`,
 * `PROCESS_SUMMARY_CHART`).
 */
function resolveStepType(step: QFrontendStepMetaData): ResolvedStepType {
  const componentTypes = step.components.map((c) => c.type as string)

  if (
    componentTypes.includes('BULK_LOAD_FILE_MAPPING_FORM') ||
    componentTypes.includes('BULK_LOAD_VALUE_MAPPING_FORM') ||
    componentTypes.includes('BULK_LOAD_PROFILE_FORM')
  ) {
    return 'BULK_LOAD'
  }

  if (componentTypes.includes('VALIDATION_REVIEW_SCREEN')) {
    return 'VALIDATION'
  }

  if (componentTypes.includes('RECORD_LIST')) {
    return 'RECORD_LIST'
  }

  if (componentTypes.includes('BULK_EDIT_FORM')) {
    return 'BULK_EDIT'
  }

  if (componentTypes.includes('VIEW_FORM')) {
    return 'VIEW'
  }

  if (componentTypes.includes('DOWNLOAD_FORM')) {
    return 'DOWNLOAD'
  }

  if (componentTypes.includes('PROCESS_SUMMARY_RESULTS')) {
    return 'RESULTS'
  }

  if (componentTypes.includes('PROCESS_SUMMARY_CHART')) {
    return 'RESULTS_CHART'
  }

  if (componentTypes.includes('WIDGET')) {
    return 'WIDGET'
  }

  if (componentTypes.includes('HTML')) {
    return 'HTML'
  }

  if (componentTypes.includes('SCRIPT_VIEWER')) {
    return 'SCRIPT_VIEWER'
  }

  // UPLOAD_FORM: a simpler file-upload step without bulk-load column mapping
  if (componentTypes.includes('UPLOAD_FORM')) {
    return 'UPLOAD_FORM'
  }

  // GOOGLE_DRIVE_SELECT_FOLDER: render a dedicated placeholder (Google Picker API not integrated)
  if (componentTypes.includes('GOOGLE_DRIVE_SELECT_FOLDER')) {
    return 'GOOGLE_DRIVE'
  }

  // Default to FORM for EDIT_FORM, HELP_TEXT + formFields, etc.
  // Also fall through to FORM for empty steps so help text can be shown.
  if (
    componentTypes.includes('EDIT_FORM') ||
    componentTypes.includes('HELP_TEXT') ||
    (step.formFields?.length ?? 0) > 0 ||
    componentTypes.length === 0
  ) {
    return 'FORM'
  }

  // Catch-all: unrecognized component type — render the unknown fallback
  return 'UNKNOWN'
}

/**
 * Merge `modifiedFields` overrides into the step's field arrays.
 *
 * Iterates `formFields`, `viewFields`, and `recordListFields` on `step` and
 * spreads each matching entry from `modifiedFields` over the original field
 * metadata, producing a new step object with the updated fields.  Fields that
 * have no override entry are returned unchanged.
 *
 * @param step - The original step metadata from the process state.
 * @param modifiedFields - Partial field overrides keyed by field name.
 * @returns A new `QFrontendStepMetaData` with overrides applied, or the original
 *   step when `modifiedFields` is empty.
 */
function applyModifiedFields(
  step: QFrontendStepMetaData,
  modifiedFields: Record<string, Partial<QFieldMetaData>>
): QFrontendStepMetaData {
  if (Object.keys(modifiedFields).length === 0) return step

  /**
   * Merge overrides into a field array, leaving unmatched fields unchanged.
   *
   * @param fields - The original field array from the step.
   * @returns A new array with override properties merged.
   */
  const patchFields = (
    fields: QFieldMetaData[] | undefined
  ): QFieldMetaData[] | undefined => {
    if (!fields) return fields
    return fields.map((field) => {
      const override = modifiedFields[field.name]
      return override ? { ...field, ...override } : field
    })
  }

  return {
    ...step,
    formFields: patchFields(step.formFields),
    viewFields: patchFields(step.viewFields),
    recordListFields: patchFields(step.recordListFields),
  }
}

/**
 * Renders the complete process execution UI for a given process.
 *
 * Handles all lifecycle states from the `useProcess` hook: shows a spinner
 * while idle/initialising, renders `ProcessErrorState` on error, renders
 * `ProcessResultStep` on completion, and dispatches the active step to the
 * appropriate step component via `resolveStepType`.
 *
 * @param props - {@link ProcessRunProps}
 */
export function ProcessRun({
  processName,
  processMetaData,
  initialValues,
  onComplete,
  className,
}: ProcessRunProps) {
  const steps = processMetaData.frontendSteps ?? []
  const initCalledRef = useRef(false)

  const {
    state,
    isLoading,
    initProcess,
    submitStep,
    goBack,
    cancel,
  } = useProcess(processName, processMetaData)

  // Auto-init on mount with input record validation (Fix 3: CRIT-7)
  useEffect(() => {
    if (state.status === 'idle' && !initCalledRef.current) {
      // Validate minInputRecords / maxInputRecords before init
      const recordIds = initialValues?.recordIds
      const recordCount = Array.isArray(recordIds) ? recordIds.length : 0
      const minInput = processMetaData.minInputRecords ?? 0
      const maxInput = processMetaData.maxInputRecords ?? 0

      if (minInput > 0 && recordCount < minInput) {
        toast.error(
          `This process requires at least ${minInput} record${minInput !== 1 ? 's' : ''}, but ${recordCount === 0 ? 'none were' : `only ${recordCount} ${recordCount === 1 ? 'was' : 'were'}`} provided.`
        )
        return
      }

      if (maxInput > 0 && recordCount > maxInput) {
        toast.error(
          `This process allows at most ${maxInput} record${maxInput !== 1 ? 's' : ''}, but ${recordCount} were provided.`
        )
        return
      }

      // Set ref AFTER validation passes so a failed validation allows retry
      initCalledRef.current = true
      initProcess(initialValues ? { values: initialValues } : {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally only run on mount

  // Notify parent on completion
  useEffect(() => {
    if (state.status === 'complete' && onComplete) {
      onComplete(state.resultValues)
    }
  }, [state.status, state.resultValues, onComplete])

  const currentIdx = steps.findIndex((s) => s.name === state.currentStep?.name)
  const canGoBack = currentIdx > 0

  // MED-20: apply modifiedFields from processMetaDataAdjustment before rendering.
  // Must be above all early returns to respect the Rules of Hooks.
  const effectiveStep = useMemo(
    () =>
      state.currentStep
        ? applyModifiedFields(state.currentStep, state.modifiedFields)
        : null,
    [state.currentStep, state.modifiedFields]
  )

  // --- Loading / initializing state ---

  if (state.status === 'idle' || state.status === 'initializing') {
    return (
      <div
        className={cn('flex items-center justify-center py-16', className)}
        data-qqq-id={`process-run-${processName}`}
      >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm">Starting {processMetaData.label}...</p>
        </div>
      </div>
    )
  }

  // --- Error state ---

  if (state.status === 'error') {
    return (
      <div className={cn('mx-auto max-w-2xl', className)} data-qqq-id={`process-run-${processName}`}>
        <ProcessErrorState
          error={state.errorMessage}
          processName={processName}
          onRetry={() => {
            initCalledRef.current = false
            initProcess(initialValues ? { values: initialValues } : {})
          }}
          onCancel={cancel}
        />
      </div>
    )
  }

  // --- Complete state ---

  if (state.status === 'complete') {
    return (
      <div className={cn('mx-auto max-w-2xl', className)} data-qqq-id={`process-run-${processName}`}>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Step wizard at top -- all steps shown as completed */}
          {steps.length > 1 && (
            <div className="border-b border-border px-6 pt-6 pb-4">
              <StepWizard
                steps={steps}
                currentStepName={null}
                isComplete
              />
            </div>
          )}
          <div className="p-8">
            <ProcessResultStep
              processMetaData={processMetaData}
              resultValues={state.resultValues}
            />
          </div>
        </div>
      </div>
    )
  }

  // --- Active step ---

  const currentStep = state.currentStep

  if (!currentStep) {
    // Polling -- waiting for step to become available (Fix 6: MED-21 + P4-40)
    const rawCurrent = state.stepValues.current ?? state.resultValues.current
    const rawTotal = state.stepValues.total ?? state.resultValues.total
    const pollingCurrent = rawCurrent !== undefined ? Number(rawCurrent) : undefined
    const pollingTotal = rawTotal !== undefined ? Number(rawTotal) : undefined
    const pollingMessage = (state.stepValues.message ?? state.resultValues.message) as string | undefined
    const hasProgress = pollingCurrent !== undefined && !isNaN(pollingCurrent) &&
                        pollingTotal !== undefined && !isNaN(pollingTotal) && pollingTotal > 0

    return (
      <div
        className={cn('flex items-center justify-center py-16', className)}
        data-qqq-id={`process-run-${processName}`}
      >
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm">{pollingMessage ?? 'Processing...'}</p>

          {/* Progress bar when current/total data is available */}
          {hasProgress && (
            <div
              className="w-64"
              role="progressbar"
              aria-valuenow={pollingCurrent}
              aria-valuemin={0}
              aria-valuemax={pollingTotal}
              aria-label="Process progress"
              data-qqq-id="process-progress-bar"
            >
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(100, (pollingCurrent / pollingTotal) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                {pollingCurrent} of {pollingTotal}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // effectiveStep is computed above (before early returns) via the useMemo hook
  // to satisfy the Rules of Hooks.  It is always non-null here since currentStep
  // is non-null (guarded by the early return above).
  const stepType = resolveStepType(effectiveStep!)

  const sharedStepProps = {
    step: effectiveStep!,
    stepValues: state.stepValues,
    isLoading,
    onSubmit: submitStep,
    onCancel: cancel,
    onBack: canGoBack ? goBack : undefined,
    canGoBack,
    isLastStep: state.isLastStep,
  }

  return (
    <div
      className={cn('mx-auto max-w-3xl', className)}
      data-qqq-id={`process-run-${processName}`}
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Step wizard */}
        {steps.length > 1 && (
          <div className="border-b border-border px-6 pt-6 pb-4">
            <StepWizard
              steps={steps}
              currentStepName={currentStep.name}
            />
          </div>
        )}

        {/* Step header */}
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-base font-semibold text-foreground">
            {currentStep.label}
          </h3>
          {steps.length > 1 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Step {currentIdx + 1} of {steps.length}
            </p>
          )}
        </div>

        {/* Polling overlay with progress (Fix 6: MED-21 + P4-40) */}
        {state.status === 'polling' && (
          <div className="border-b border-primary/20 bg-primary/5 px-6 py-3">
            <div className="flex items-center gap-3">
              <Loader2
                className="h-4 w-4 animate-spin text-primary"
                aria-hidden="true"
              />
              <span className="text-sm text-primary">
                {(state.stepValues.message as string) ?? 'Processing, please wait...'}
              </span>
            </div>
            {renderPollingProgress(state.stepValues)}
          </div>
        )}

        {/* Step content */}
        <div className="p-6">
          {stepType === 'FORM' && (
            <ProcessFormStep
              {...sharedStepProps}
              processName={processName}
            />
          )}

          {stepType === 'VALIDATION' && (
            <ValidationReviewStep {...sharedStepProps} />
          )}

          {stepType === 'RECORD_LIST' && (
            <RecordListStep {...sharedStepProps} />
          )}

          {stepType === 'BULK_LOAD' && (
            <BulkLoadStep {...sharedStepProps} />
          )}

          {stepType === 'VIEW' && (
            <ProcessViewStep {...sharedStepProps} />
          )}

          {stepType === 'DOWNLOAD' && (
            <ProcessDownloadStep {...sharedStepProps} />
          )}

          {stepType === 'RESULTS' && (
            <ProcessSummaryResultsStep {...sharedStepProps} />
          )}

          {stepType === 'WIDGET' && (
            <ProcessWidgetStep {...sharedStepProps} />
          )}

          {stepType === 'HTML' && (
            <ProcessHtmlStep {...sharedStepProps} />
          )}

          {stepType === 'BULK_EDIT' && (
            <ProcessBulkEditStep
              {...sharedStepProps}
              processName={processName}
            />
          )}

          {stepType === 'RESULTS_CHART' && (
            <ProcessSummaryChartStep {...sharedStepProps} />
          )}

          {stepType === 'SCRIPT_VIEWER' && (
            <ProcessScriptViewerStep {...sharedStepProps} />
          )}

          {stepType === 'UPLOAD_FORM' && (
            <ProcessUploadFormStep {...sharedStepProps} />
          )}

          {stepType === 'GOOGLE_DRIVE' && (
            <ProcessGoogleDriveStep {...sharedStepProps} />
          )}

          {stepType === 'UNKNOWN' && (
            <ProcessUnknownStep {...sharedStepProps} />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Render a progress bar inside the polling overlay when current/total are available.
 */
function renderPollingProgress(stepValues: Record<string, unknown>): React.ReactNode {
  const rawCurrent = stepValues.current
  const rawTotal = stepValues.total
  const current = rawCurrent !== undefined ? Number(rawCurrent) : undefined
  const total = rawTotal !== undefined ? Number(rawTotal) : undefined

  if (current === undefined || isNaN(current) || total === undefined || isNaN(total) || total <= 0) {
    return null
  }

  const pct = Math.min(100, (current / total) * 100)

  return (
    <div
      className="mt-2"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label="Process progress"
      data-qqq-id="process-polling-progress"
    >
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-primary">
        {current} of {total}
      </p>
    </div>
  )
}
