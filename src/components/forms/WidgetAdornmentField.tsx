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

/** @file A WIDGET field adornment uses a widget to edit one field in its hosting form. */
'use client'

import React, { useRef } from 'react'
import { Controller, useWatch } from 'react-hook-form'
import type { Control } from 'react-hook-form'

import type { QFieldMetaData } from '@/types'
import { canViewWidget } from '@/lib/auth/permissions'
import { useMetaData } from '@/lib/hooks/use-metadata'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { useWidget } from '@/lib/hooks/use-widget'
import { findAdornment } from '@/lib/utils/adornment-utils'
import { FilterAndColumnsSetupWidget } from '@/components/widgets/FilterAndColumnsSetupWidget'
import type { FilterAndColumnsSetupPayload } from '@/components/widgets/FilterAndColumnsSetupWidget'
import type { WidgetFormContext } from '@/components/widgets/widget-types'

/**
 * Material sends the other form values and the field name when loading an adorned widget.
 * Keep the initial request stable as form values change; the editor reads live values below.
 * @param values - The hosting form's initial values.
 * @param fieldName - The adorned field's name, including a row index when present.
 * @returns Widget request parameters.
 */
function widgetRequestParams(values: Record<string, unknown>, fieldName: string): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {}
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') params[name] = value
  }
  params.__formFieldAsWidget_FieldName = fieldName
  return params
}

/**
 * Renders the supported Material field widget and writes its value through React Hook Form.
 * @param root0 - Field metadata, form control and edit state.
 * @returns The field widget or a contained loading/error message.
 */
export function WidgetAdornmentField({ field, control, disabled = false, possibleValueContext }: {
  field: QFieldMetaData
  control: Control<Record<string, unknown>>
  disabled?: boolean
  possibleValueContext?: PossibleValueContext
}) {
  const name = findAdornment(field, 'WIDGET')?.values?.widgetName
  const widgetName = typeof name === 'string' ? name : ''
  const values = useWatch({ control }) as Record<string, unknown>
  const initialParams = useRef(widgetRequestParams(values, field.name))
  const metadata = useMetaData()
  const widgetMetaData = metadata.data?.widgets?.[widgetName]
  const permitted = widgetMetaData ? canViewWidget(widgetMetaData) : false
  const query = useWidget(widgetName, initialParams.current, { enabled: permitted })

  if (!widgetName) return <p role="alert">{`Field ${field.label} names no widget.`}</p>
  if (metadata.isError) return <p role="alert">{`Could not load widget metadata for ${field.label}.`}</p>
  if (!metadata.data) return <p role="status">{`Loading ${field.label}...`}</p>
  if (!widgetMetaData) return <p role="alert">{`Widget ${widgetName} is unavailable.`}</p>
  if (!permitted) return <p role="alert">{`You cannot view ${field.label}.`}</p>
  if (query.isError) return <p role="alert">{`Could not load ${field.label}.`}</p>
  if (!query.data) return <p role="status">{`Loading ${field.label}...`}</p>
  if (widgetMetaData.type !== 'filterAndColumnsSetup' || query.data.type !== 'filterAndColumnsSetup') {
    return <p role="alert">{`Widget type ${widgetMetaData.type} is unsupported for field ${field.label}.`}</p>
  }

  const data: FilterAndColumnsSetupPayload = { ...query.data, filterFieldName: field.name }
  const formValues = { ...values, ...(data.tableName ? { tableName: data.tableName } : {}) }
  return <Controller
    name={field.name}
    control={control}
    render={({ field: input }) => {
      const formContext: WidgetFormContext = {
        screen: possibleValueContext?.type === 'process' ? 'processStep' : 'recordEdit',
        values: formValues,
        setValues: (next) => { if (Object.prototype.hasOwnProperty.call(next, field.name)) input.onChange(next[field.name]) },
        setAssociation: () => {},
        registerValidator: () => {},
        disabled: disabled || !field.isEditable,
      }
      return <div data-qqq-id={`field-widget-${field.name}`}>
        <FilterAndColumnsSetupWidget widgetMetaData={widgetMetaData} data={data} formContext={formContext} />
      </div>
    }}
  />
}
