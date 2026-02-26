'use client'

// StepWizard — progress indicator showing all steps with current position

import React from 'react'
import { Check } from 'lucide-react'

import type { QFrontendStepMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

export interface StepWizardProps {
  steps: QFrontendStepMetaData[]
  currentStepName: string | null
  isComplete?: boolean
  className?: string
}

type StepState = 'completed' | 'active' | 'pending'

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

export function StepWizard({ steps, currentStepName, isComplete = false, className }: StepWizardProps) {
  if (steps.length === 0) return null

  return (
    <nav
      aria-label="Process steps"
      className={cn('w-full', className)}
      data-qqq-id="step-wizard"
    >
      {/* Horizontal scroll wrapper for narrow screens with many steps (Fix: HIGH-11) */}
      <div className="overflow-x-auto">
        <ol className="flex items-center">
        {steps.map((step, idx) => {
          const stepState = getStepState(step.name, currentStepName, steps, isComplete)
          const isLast = idx === steps.length - 1

          return (
            <li
              key={step.name}
              className={cn(
                'flex items-center',
                !isLast && 'flex-1'
              )}
              data-qqq-id={`step-wizard-step-${step.name}`}
            >
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  aria-current={stepState === 'active' ? 'step' : undefined}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors duration-200',
                    stepState === 'completed' &&
                      'bg-primary text-primary-foreground',
                    stepState === 'active' &&
                      'border-2 border-primary bg-card text-primary',
                    stepState === 'pending' &&
                      'border-2 border-border bg-card text-muted-foreground'
                  )}
                >
                  {stepState === 'completed' ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'mt-1 text-xs font-medium whitespace-nowrap',
                    stepState === 'completed' && 'text-primary',
                    stepState === 'active' && 'text-primary',
                    stepState === 'pending' && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>

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
  )
}
