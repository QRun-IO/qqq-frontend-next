'use client'

// ProcessRun -- main process orchestrator component
// Manages the full process lifecycle: init -> steps -> complete/error

import React, { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

import type { QProcessMetaData, QFrontendStepMetaData, QComponentType } from '@/types'
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
import { ProcessWidgetStep } from './ProcessWidgetStep'
import { ProcessBulkEditStep } from './ProcessBulkEditStep'

export interface ProcessRunProps {
  processName: string
  processMetaData: QProcessMetaData
  /** Optional initial values passed to process init */
  initialValues?: Record<string, unknown>
  /** Called when the process completes */
  onComplete?: (resultValues: Record<string, unknown>) => void
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
  | 'WIDGET'
  | 'HTML'
  | 'BULK_EDIT'

/**
 * Determine what kind of step to render based on step components and fields.
 * Priority order reflects specificity: bulk load > validation > record list > specialized > form fallback.
 */
function resolveStepType(step: QFrontendStepMetaData): ResolvedStepType {
  const componentTypes = step.components.map((c) => c.type as QComponentType)

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

  if (componentTypes.includes('WIDGET')) {
    return 'WIDGET'
  }

  if (componentTypes.includes('HTML')) {
    return 'HTML'
  }

  // TODO: GOOGLE_DRIVE_SELECT_FOLDER needs Google API integration;
  // fall back to FORM for now so it renders with any formFields present.
  if (componentTypes.includes('GOOGLE_DRIVE_SELECT_FOLDER')) {
    return 'FORM'
  }

  // Default to FORM for EDIT_FORM, HELP_TEXT + formFields, etc.
  return 'FORM'
}

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

  const stepType = resolveStepType(currentStep)

  const sharedStepProps = {
    step: currentStep,
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
