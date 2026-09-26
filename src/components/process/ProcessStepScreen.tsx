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
 * @file ProcessStepScreen — one process screen: its heading and help, every
 * declared component in order sharing one form, and a single action bar
 * (Cancel, Back when the backend allows it, Next or Submit; Return once there
 * are no more steps). Submission posts only the screen's values.
 */

'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { sanitizeHtml } from '@/lib/utils/sanitize-html'
import { ArrowLeft, Check, ChevronRight, Loader2, X } from 'lucide-react'

import type { QFieldMetaData, QFrontendStepMetaData, QInstance, QProcessMetaData, QTableMetaData } from '@/types'
import type { ProcessFiles } from '@/lib/api/processes'
import { zodFieldFromMetadata } from '@/lib/utils/zod-from-metadata'
import { cn } from '@/lib/utils/cn'

import { ProcessComponent } from './ProcessComponent'
import { inputFieldsOfBlocks, readBlocks } from './ProcessBlocks'
import {
  ProcessStepContext,
  type ProcessStepContextValue,
  type ProcessSubmitContributor,
} from './ProcessStepContext'
import { initialFormValue, isFileField } from './process-values'

/** Props for {@link ProcessStepScreen}. */
export interface ProcessStepScreenProps {
  processName: string
  processMetaData: QProcessMetaData
  processUUID: string | null
  step: QFrontendStepMetaData
  steps: QFrontendStepMetaData[]
  values: Record<string, unknown>
  backStep: string | null
  isWorking: boolean
  /** JSON of the table variant the run uses, for record requests made by components. */
  tableVariant?: string
  tableMetaData?: QTableMetaData
  sourceTableMetaData?: QTableMetaData
  previewTableMetaData?: QTableMetaData
  instance?: QInstance
  onSubmit: (values: Record<string, unknown>, files?: ProcessFiles) => void
  onBack: () => void
  onCancel: () => void
  onReturn: () => void
}

const buttonBase = 'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton = cn(buttonBase, 'border border-border bg-card text-foreground hover:bg-accent')
const primaryButton = cn(buttonBase, 'bg-primary text-primary-foreground hover:bg-primary/90')

/**
 * Every field whose input lives in the screen form: declared form fields plus
 * input fields of ad hoc and seeded composite widgets.
 * @param step - The screen.
 * @param values - Process values (seeded widget data).
 * @returns Form fields.
 */
function screenFields(step: QFrontendStepMetaData, values: Record<string, unknown>): QFieldMetaData[] {
  const fields = [...(step.formFields ?? [])]
  for (const component of step.components ?? []) {
    if (component.type !== 'WIDGET') continue
    const widgetName = typeof component.values?.widgetName === 'string' ? component.values.widgetName : ''
    const source = component.values?.isAdHocWidget === true ? component.values : widgetName ? values[widgetName] : undefined
    for (const field of inputFieldsOfBlocks(readBlocks(source))) {
      if (!fields.some((existing) => existing.name === field.name)) fields.push(field)
    }
  }
  return fields
}

/**
 * Step help text for process screens (roles PROCESS_SCREEN or ALL_SCREENS, or none).
 * @param step - The screen.
 * @returns The help element, or `null`.
 */
function StepHelp({ step }: { step: QFrontendStepMetaData }) {
  const contents = (step.helpContents ?? []).filter((help) => help.content && (!help.roles?.length || help.roles.some((role) => role === 'PROCESS_SCREEN' || role === 'ALL_SCREENS')))
  if (contents.length === 0) return null
  return (
    <div className="space-y-1 text-sm text-muted-foreground" data-qqq-id="process-step-help">
      {contents.map((help, index) => help.format === 'HTML'
        ? <div key={index} dangerouslySetInnerHTML={{ __html: sanitizeHtml(help.content ?? '') }} />
        : <p key={index}>{help.content}</p>)}
    </div>
  )
}

/**
 * Render one process screen.
 * @param props - {@link ProcessStepScreenProps}
 * @returns The screen.
 */
export function ProcessStepScreen({
  processName, processMetaData, processUUID, step, steps, values, backStep, isWorking, tableVariant,
  tableMetaData, sourceTableMetaData, previewTableMetaData, instance,
  onSubmit, onBack, onCancel, onReturn,
}: ProcessStepScreenProps) {
  const [overrideOnLastStep, setOverrideOnLastStep] = useState<boolean | null>(null)
  const [stepLabel, setStepLabel] = useState<string | null>(null)
  const contributorsRef = useRef(new Map<string, ProcessSubmitContributor>())
  const extraValuesRef = useRef<Record<string, unknown>>({})

  const components = useMemo(() => step.components ?? [], [step.components])
  const hasComponent = useCallback((type: string) => components.some((component) => component.type === type), [components])
  const isBulkEdit = hasComponent('BULK_EDIT_FORM')
  const hasValidationReview = hasComponent('VALIDATION_REVIEW_SCREEN')
  const fields = useMemo(() => screenFields(step, values).filter((field) => !field.isHidden), [step, values])

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {}
    for (const field of fields) defaults[field.name] = initialFormValue(field, values[field.name])
    if (hasValidationReview) defaults.doFullValidation = 'true'
    return defaults
  }, [fields, hasValidationReview, values])

  const schema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {}
    if (!isBulkEdit) {
      for (const field of fields) {
        if (field.isEditable === false) continue
        if (isFileField(field)) {
          shape[field.name] = field.isRequired
            ? z.custom<File>((value) => value instanceof File, `${field.label} is required`)
            : z.any()
          continue
        }
        shape[field.name] = z.preprocess((value) => (value === null || value === undefined ? (field.type === 'BOOLEAN' ? undefined : '') : value), zodFieldFromMetadata(field))
      }
    }
    return z.object(shape).passthrough()
  }, [fields, isBulkEdit])

  const form = useForm<Record<string, unknown>>({ resolver: zodResolver(schema), defaultValues })

  const registerContributor = useCallback((name: string, contributor: ProcessSubmitContributor) => {
    contributorsRef.current.set(name, contributor)
    return () => { contributorsRef.current.delete(name) }
  }, [])

  /**
   * Build the screen payload and submit it.
   * @param formValues - Validated form values.
   */
  const submitValues = useCallback((formValues: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {}
    const files: ProcessFiles = {}
    if (!isBulkEdit) {
      for (const field of fields) {
        if (field.isEditable === false) continue
        const value = formValues[field.name]
        if (isFileField(field)) {
          if (value instanceof File) files[field.name] = value
          continue
        }
        const original = values[field.name]
        const wasEmpty = original === undefined || original === null || original === ''
        if ((value === '' || value === undefined || value === null) && wasEmpty) continue
        payload[field.name] = value ?? ''
      }
    }
    if (hasValidationReview) payload.doFullValidation = formValues.doFullValidation ?? 'true'
    for (const contributor of contributorsRef.current.values()) {
      const contribution = contributor()
      if (!contribution.maySubmit) return
      Object.assign(payload, contribution.values ?? {})
      Object.assign(files, contribution.files ?? {})
    }
    Object.assign(payload, extraValuesRef.current)
    extraValuesRef.current = {}
    onSubmit(payload, Object.keys(files).length > 0 ? files : undefined)
  }, [fields, hasValidationReview, isBulkEdit, onSubmit, values])

  const requestSubmit = useCallback((extraValues?: Record<string, unknown>) => {
    if (isWorking) return
    extraValuesRef.current = extraValues ?? {}
    void form.handleSubmit(submitValues)()
  }, [form, isWorking, submitValues])

  const context: ProcessStepContextValue = {
    processName, processUUID, processMetaData, tableMetaData, sourceTableMetaData, previewTableMetaData, instance,
    step, values, form, isWorking, registerContributor, requestSubmit, setOverrideOnLastStep, setStepLabel, tableVariant,
  }

  const index = steps.findIndex((candidate) => candidate.name === step.name)
  const isLinear = (processMetaData.stepFlow ?? 'LINEAR') === 'LINEAR'
  const onLastStep = isLinear && index === steps.length - 2
  const noMoreSteps = (isLinear && index === steps.length - 1) || values.noMoreSteps === true || values.noMoreSteps === 'true'
  const isSubmitLabel = overrideOnLastStep ?? onLastStep
  //////////////////////////////////////////////////////////////////////////
  // scanner screens (hand-held stations) show only their components; the //
  // input blocks submit, as in the Material dashboard                    //
  //////////////////////////////////////////////////////////////////////////
  const isScanner = step.format?.toLowerCase() === 'scanner'

  return (
    <ProcessStepContext.Provider value={context}>
      <form
        noValidate
        onSubmit={(event) => { event.preventDefault(); requestSubmit() }}
        aria-labelledby={`process-step-heading-${step.name}`}
        data-qqq-id={`process-step-${step.name}`}
      >
        <div className={isScanner ? 'sr-only' : 'border-b border-border px-6 py-4'}>
          <h3 id={`process-step-heading-${step.name}`} tabIndex={-1} className="text-base font-semibold text-foreground outline-none" data-qqq-id="process-step-heading">
            {stepLabel ?? step.label}
          </h3>
          {isLinear && steps.length > 1 && index >= 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">{`Step ${index + 1} of ${steps.length}`}</p>
          )}
        </div>
        <div className="space-y-6 p-6">
          <StepHelp step={step} />
          {components.map((component, componentIndex) => (
            <div key={componentIndex} data-qqq-id={`process-component-${componentIndex}`} data-component-type={component.type}>
              <ProcessComponent component={component} index={componentIndex} />
            </div>
          ))}
        </div>
        {!isScanner && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-6 py-3" data-qqq-id="process-actions">
          {noMoreSteps ? (
            <button type="button" onClick={onReturn} disabled={isWorking} className={secondaryButton} data-qqq-id="button-return">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Return
            </button>
          ) : (
            <>
              <button type="button" onClick={onCancel} disabled={isWorking} className={secondaryButton} data-qqq-id="button-cancel">
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel
              </button>
              {backStep && (
                <button type="button" onClick={onBack} disabled={isWorking} className={secondaryButton} data-qqq-id="button-back">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </button>
              )}
              <button type="submit" disabled={isWorking} className={primaryButton} data-qqq-id="button-next">
                {isWorking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : isSubmitLabel ? <Check className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                {isSubmitLabel ? 'Submit' : 'Next'}
              </button>
            </>
          )}
        </div>}
      </form>
    </ProcessStepContext.Provider>
  )
}
