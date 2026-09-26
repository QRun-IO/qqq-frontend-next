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
 * @file widget-form-host — the form a widget may add fields to, when a screen with a form
 * hosts it (Material widgets use the host screen's Formik context): a `dynamicForm`
 * widget's fields join a process step's form, are validated with it and submitted with
 * the step. Dashboards and record views provide no host, so widgets there stay read-only.
 */

import { createContext, useContext } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { QFieldMetaData } from '@/types'

/** A screen form that widgets may add fields to. */
export interface WidgetFormHost {
  /** The host screen's form. */
  form: UseFormReturn<Record<string, unknown>>
  /** `true` while the host is submitting. */
  disabled: boolean
  /**
   * Whether an editable-by-choice widget (a `dynamicForm` whose metadata does not say) is
   * editable here: `false` on process screens (Material's DashboardWidgets), `true` on record forms.
   */
  editableByDefault: boolean
  /**
   * Set the fields a widget adds to the host form (validated and submitted with it); an
   * empty list removes them.
   * @param owner - The widget's name.
   * @param fields - The widget's fields.
   */
  registerFields: (owner: string, fields: QFieldMetaData[]) => void
}

/** The hosting form, or `null` where widgets render read-only. */
export const WidgetFormHostContext = createContext<WidgetFormHost | null>(null)

/**
 * The form hosting the current widget.
 * @returns The host, or `null`.
 */
export function useWidgetFormHost(): WidgetFormHost | null {
  return useContext(WidgetFormHostContext)
}
