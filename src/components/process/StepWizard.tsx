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
 * @file StepWizard — horizontal step-progress indicator for multi-step processes.
 *
 * Renders an ordered list of steps with numbered circles (or a checkmark for
 * completed steps) connected by progress lines.  Supports an `isComplete` flag
 * that marks every step as completed when the process has finished.
 *
 * Completed steps (index < currentStepIndex) are rendered as clickable `<button>`
 * elements when an `onStepClick` prop is provided (D-P-2).  Long step labels are
 * wrapped in a Radix Tooltip for touch-friendly full-text display (D-P-6).
 */
'use client'

import React from 'react'
import { Check } from 'lucide-react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

/**
 * Props for the {@link StepWizard} component.
 */
export interface StepWizardProps {
  /** Ordered list of all step definitions from process metadata. */
  steps: QFrontendStepMetaData[]
  /** The `name` of the currently active step, or null when polling or complete. */
  currentStepName: string | null
  /** When true, every step is displayed as completed (used on the result screen). */
  isComplete?: boolean
  /**
   * Optional callback invoked when the user clicks a completed step indicator.
   *
   * Only completed steps (index < currentStepIndex) are clickable.  Pass
   * `undefined` to keep all step indicators purely visual.
   *
   * @param stepName - The technical name of the step that was clicked.
   */
  onStepClick?: (stepName: string) => void
  /** Additional CSS class names applied to the `<nav>` element. */
  className?: string
}

/** Visual state of a single step in the wizard indicator. */
type StepState = 'completed' | 'active' | 'pending'

/**
 * Computes the visual state of a step relative to the currently active step.
 *
 * @param stepName - The technical name of the step to evaluate.
 * @param currentStepName - The name of the currently active step, or null.
 * @param steps - The full ordered list of process steps.
 * @param isComplete - Whether the process has finished (forces all steps to 'completed').
 * @returns The {@link StepState} for the given step.
 */
function getStepState(
  stepName: string,
  currentStepName: string | null,
  steps: QFrontendStepMetaData[],
  isComplete: boolean
): StepState {
  if (isComplete) return 'completed'
  if (!currentStepName) return 'pending'

  const currentIdx = steps.findIndex((s) => s.name === currentStepName)
  const thisIdx = steps.findIndex((s) => s.name === stepName)

  if (thisIdx < currentIdx) return 'completed'
  if (thisIdx === currentIdx) return 'active'
  return 'pending'
}

/**
 * Renders a horizontal step-progress indicator for a multi-step process.
 *
 * Consumed by `ProcessRun` in both the active-step and complete views.
 * Each step shows a numbered circle (or checkmark when completed), its label,
 * and a connector line to the next step.  The connector line between a
 * completed step and the next one is colored with `bg-primary`; pending
 * connectors use `bg-border`.  Labels are truncated at `max-w-[6rem]` and
 * wrapped in a Radix Tooltip that shows the full step name on hover or focus
 * (touch-friendly — D-P-6).  When `onStepClick` is provided, completed step
 * indicators are rendered as `<button>` elements the user can click to
 * navigate back (D-P-2).  A horizontal scroll wrapper prevents layout
 * breakage when many steps are present on narrow screens.
 *
 * @param props - {@link StepWizardProps} — `steps` drives the ordered list;
 *   `currentStepName` controls which step is highlighted; `isComplete` forces
 *   all steps into the 'completed' visual state; `onStepClick` enables
 *   back-navigation by clicking a completed step.
 * @returns A `<nav>` element containing the ordered step list, or null when
 *   `steps` is empty.
 */
export function StepWizard({
  steps,
  currentStepName,
  isComplete = false,
  onStepClick,
  className,
}: StepWizardProps) {
  if (steps.length === 0) return null

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <nav
        aria-label="Process steps"
        className={cn('w-full', className)}
        data-qqq-id="step-wizard"
      >
        {/* Horizontal scroll wrapper for narrow screens with many steps (Fix: HIGH-11) */}
        <div className="overflow-x-auto">
          <ol className="flex min-w-max items-center">
          {steps.map((step, idx) => {
            const stepState = getStepState(step.name, currentStepName, steps, isComplete)
            const isLast = idx === steps.length - 1
            const isClickable = stepState === 'completed' && !!onStepClick

            /** Inner circle + label, shared between the button and div renderers. */
            const indicatorContent = (
              <>
                <div
                  aria-current={stepState === 'active' ? 'step' : undefined}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors duration-200',
                    stepState === 'completed' &&
                      'bg-primary text-primary-foreground',
                    stepState === 'active' &&
                      'border-2 border-primary bg-card text-primary',
                    stepState === 'pending' &&
                      'border-2 border-border bg-card text-muted-foreground',
                    isClickable && 'hover:opacity-80'
                  )}
                >
                  {stepState === 'completed' ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* D-P-6: Tooltip wraps truncated label for touch-friendly full text */}
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <span
                      className={cn(
                        'mt-1 max-w-[6rem] truncate text-xs font-medium',
                        stepState === 'completed' && 'text-primary',
                        stepState === 'active' && 'text-primary',
                        stepState === 'pending' && 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </span>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      sideOffset={4}
                      className={cn(
                        'z-50 overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5',
                        'text-xs text-popover-foreground shadow-md',
                        'animate-in fade-in-0 zoom-in-95',
                        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
                      )}
                    >
                      {step.label}
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              </>
            )

            return (
              <li
                key={step.name}
                className={cn(
                  'flex items-center',
                  !isLast && 'flex-1'
                )}
                data-qqq-id={`step-wizard-step-${step.name}`}
              >
                {/* Step indicator — button when clickable (D-P-2), div otherwise */}
                {isClickable ? (
                  <button
                    type="button"
                    onClick={() => onStepClick(step.name)}
                    aria-label={`Go back to step: ${step.label}`}
                    className={cn(
                      'flex flex-col items-center',
                      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded'
                    )}
                    data-qqq-id={`step-wizard-back-${step.name}`}
                  >
                    {indicatorContent}
                  </button>
                ) : (
                  <div className="flex flex-col items-center">
                    {indicatorContent}
                  </div>
                )}

                {/* Connector line between steps */}
                {!isLast && (
                  <div
                    className={cn(
                      'mx-2 h-0.5 flex-1 transition-colors duration-200',
                      stepState === 'completed'
                        ? 'bg-primary'
                        : 'bg-border'
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            )
          })}
          </ol>
        </div>
      </nav>
    </TooltipPrimitive.Provider>
  )
}
