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
 * @file EditFormComponent — renders an EDIT_FORM process component: the screen's
 * form fields (or the `includeFieldNames` subset), optionally inside a card titled
 * with `sectionLabel`. Values live in the screen's shared form.
 */

'use client'

import React from 'react'

import type { QFrontendComponent } from '@/types'

import { DynamicForm } from '@/components/forms/DynamicForm'
import { useProcessStep } from './ProcessStepContext'

/** Props for {@link EditFormComponent}. */
export interface EditFormComponentProps {
  component: QFrontendComponent
  index: number
}

/**
 * Render an EDIT_FORM component.
 * @param props - {@link EditFormComponentProps}
 * @returns The form fields, or nothing when the subset is empty.
 */
export function EditFormComponent({ component, index }: EditFormComponentProps) {
  const { step, form, isWorking, processName } = useProcessStep()
  const includeFieldNames = Array.isArray(component.values?.includeFieldNames)
    ? (component.values.includeFieldNames as unknown[]).filter((name): name is string => typeof name === 'string')
    : undefined
  const sectionLabel = typeof component.values?.sectionLabel === 'string' ? component.values.sectionLabel : ''
  const fields = step.formFields ?? []

  const body = (
    <DynamicForm
      register={form.register}
      control={form.control}
      errors={form.formState.errors}
      fields={fields}
      fieldNamesToInclude={includeFieldNames}
      possibleValueContext={{ type: 'process', processName }}
      disabled={isWorking}
    />
  )

  if (sectionLabel) {
    return (
      <section
        aria-label={sectionLabel}
        className="rounded-xl border border-border p-4"
        data-qqq-id={`process-edit-form-${index}`}
      >
        <h4 className="mb-3 text-base font-semibold text-foreground">{sectionLabel}</h4>
        {body}
      </section>
    )
  }
  return <div data-qqq-id={`process-edit-form-${index}`}>{body}</div>
}
