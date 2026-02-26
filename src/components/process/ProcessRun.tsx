'use client'

// ProcessRun — main process orchestrator component
// Manages the full process lifecycle: init → steps → complete/error

import React, { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

import type { QProcessMetaData, QFrontendStepMetaData, QComponentType } from '@/types'
import { useProcess } from '@/lib/hooks/use-process'
import { cn } from '@/lib/utils/cn'

import { StepWizard } from './StepWizard'
import { ProcessFormStep } from './ProcessFormStep'
import { ValidationReviewStep } from './ValidationReviewStep'
import { RecordListStep } from './RecordListStep'
import { BulkLoadStep } from './BulkLoadStep'
import { ProcessResultStep } from './ProcessResultStep'
import { ProcessErrorState } from './ProcessErrorState'

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
 * Determine what kind of step to render based on step components and fields.
 * Priority order: BULK_LOAD_FILE_MAPPING_FORM > VALIDATION_REVIEW_SCREEN > RECORD_LIST > EDIT_FORM/HELP_TEXT+formFields
 */
function resolveStepType(step: QFrontendStepMetaData): 'FORM' | 'VALIDATION' | 'RECORD_LIST' | 'BULK_LOAD' {
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

  // Default to FORM for EDIT_FORM, HELP_TEXT + formFields, VIEW_FORM, etc.
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

  const {
    state,
    isLoading,
    initProcess,
    submitStep,
    goBack,
    cancel,
  } = useProcess(processName, processMetaData)

  // Auto-init on mount
  useEffect(() => {
    if (state.status === 'idle') {
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

  // ─── Loading / initializing state ────────────────────────────────────────────

  if (state.status === 'idle' || state.status === 'initializing') {
    return (
      <div
        className={cn('flex items-center justify-center py-16', className)}
        data-qqq-id={`process-run-${processName}`}
      >
        <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm">Starting {processMetaData.label}…</p>
        </div>
      </div>
    )
  }

  // ─── Error state ─────────────────────────────────────────────────────────────

  if (state.status === 'error') {
    return (
      <div className={cn('mx-auto max-w-2xl', className)} data-qqq-id={`process-run-${processName}`}>
        <ProcessErrorState
          error={state.errorMessage}
          processName={processName}
          onRetry={() => initProcess(initialValues ? { values: initialValues } : {})}
          onCancel={cancel}
        />
      </div>
    )
  }

  // ─── Complete state ───────────────────────────────────────────────────────────

  if (state.status === 'complete') {
    return (
      <div className={cn('mx-auto max-w-2xl', className)} data-qqq-id={`process-run-${processName}`}>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {/* Step wizard at top — all steps shown as completed */}
          {steps.length > 1 && (
            <div className="border-b border-gray-200 px-6 pt-6 pb-4 dark:border-gray-700">
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

  // ─── Active step ──────────────────────────────────────────────────────────────

  const currentStep = state.currentStep

  if (!currentStep) {
    // Polling — waiting for step to become available
    return (
      <div
        className={cn('flex items-center justify-center py-16', className)}
        data-qqq-id={`process-run-${processName}`}
      >
        <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm">Processing…</p>
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
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {/* Step wizard */}
        {steps.length > 1 && (
          <div className="border-b border-gray-200 px-6 pt-6 pb-4 dark:border-gray-700">
            <StepWizard
              steps={steps}
              currentStepName={currentStep.name}
            />
          </div>
        )}

        {/* Step header */}
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {currentStep.label}
          </h3>
          {steps.length > 1 && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Step {currentIdx + 1} of {steps.length}
            </p>
          )}
        </div>

        {/* Polling overlay */}
        {state.status === 'polling' && (
          <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-6 py-3 dark:border-blue-900 dark:bg-blue-900/20">
            <Loader2
              className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <span className="text-sm text-blue-700 dark:text-blue-300">Processing, please wait…</span>
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
        </div>
      </div>
    </div>
  )
}
