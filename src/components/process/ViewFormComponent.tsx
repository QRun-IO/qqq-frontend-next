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
 * @file ViewFormComponent — renders a VIEW_FORM process component: each of the
 * screen's view fields as "Label: value", formatted from the process values.
 */

'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'

import type { QFieldMetaData } from '@/types'
import { fetchProcessPossibleValues } from '@/lib/api/possible-values'

import { useProcessStep } from './ProcessStepContext'
import { formatProcessValue } from './process-values'

/** Props for {@link ViewFormComponent}. */
export interface ViewFormComponentProps {
  index: number
}

/**
 * One "Label: value" line, resolving possible-value labels through the process's field.
 * @param props - The field and its raw value.
 * @returns The rendered line.
 */
function ViewField({ field, value, processName }: { field: QFieldMetaData; value: unknown; processName: string }) {
  const hasValue = value !== null && value !== undefined && value !== ''
  const { data: label } = useQuery({
    queryKey: ['qqq', 'processViewValueLabel', processName, field.name, String(value)],
    queryFn: async () => (await fetchProcessPossibleValues(processName, field.name, { ids: String(value) }))[0]?.label ?? null,
    enabled: Boolean(field.possibleValueSourceName) && hasValue,
    staleTime: 60_000,
  })
  const text = formatProcessValue(field, value, label ?? undefined)
  const isError = field.adornments?.some((adornment) => adornment.type === 'ERROR')

  if (isError) {
    if (!text) return null
    return (
      <div role="alert" className="text-sm text-destructive" data-qqq-id={`process-view-field-${field.name}`}>{text}</div>
    )
  }
  return (
    <div className="flex flex-wrap gap-x-2 py-1 text-sm" data-qqq-id={`process-view-field-${field.name}`}>
      <span className="font-semibold text-foreground">{field.label}:</span>
      <span className="text-foreground" data-qqq-id={`process-view-value-${field.name}`}>{text || <span className="text-muted-foreground">&mdash;</span>}</span>
    </div>
  )
}

/**
 * Render a VIEW_FORM component.
 * @param props - {@link ViewFormComponentProps}
 * @returns The view field list.
 */
export function ViewFormComponent({ index }: ViewFormComponentProps) {
  const { step, values, processName } = useProcessStep()
  const fields = (step.viewFields ?? []).filter((field) => !field.isHidden)
  if (fields.length === 0) return null
  return (
    <div className="space-y-0.5" data-qqq-id={`process-view-form-${index}`}>
      {fields.map((field) => (
        <ViewField key={field.name} field={field} value={values[field.name]} processName={processName} />
      ))}
    </div>
  )
}
