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
 * @file ProcessStepContext — what every component on a process screen shares:
 * the screen's single form, the process values, table metadata, and the hooks
 * components use to contribute submit values or submit the screen themselves.
 */

'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { QFrontendStepMetaData, QInstance, QProcessMetaData, QTableMetaData } from '@/types'
import type { ProcessFiles } from '@/lib/api/processes'

/** What a component adds to (or blocks in) a screen submission. */
export interface ProcessSubmitContribution {
  /** `false` blocks the submission (the component shows its own errors). */
  maySubmit: boolean
  values?: Record<string, unknown>
  files?: ProcessFiles
}

/** A component's submit hook. */
export type ProcessSubmitContributor = () => ProcessSubmitContribution

/** Shared state of one process screen. */
export interface ProcessStepContextValue {
  processName: string
  processUUID: string | null
  processMetaData: QProcessMetaData
  /** Metadata of the process's table, when it has one. */
  tableMetaData?: QTableMetaData
  /** Metadata of the table named by the `sourceTable` process value (validation and results). */
  sourceTableMetaData?: QTableMetaData
  /** Metadata of the table named by `formatPreviewRecordUsingTableLayout` (review previews). */
  previewTableMetaData?: QTableMetaData
  /** Instance metadata (widgets, table labels), when loaded. */
  instance?: QInstance
  /** JSON of the table variant the run uses (sent with record requests). */
  tableVariant?: string
  step: QFrontendStepMetaData
  /** Current process values from the backend. */
  values: Record<string, unknown>
  /** The screen's single form (every component's inputs live here). */
  form: UseFormReturn<Record<string, unknown>>
  /** `true` while a submission is in flight. */
  isWorking: boolean
  /** Register a submit contributor for this screen (removed on unmount). */
  registerContributor: (name: string, contributor: ProcessSubmitContributor) => () => void
  /** Submit the screen, adding `extraValues` (e.g. a button's action code). */
  requestSubmit: (extraValues?: Record<string, unknown>) => void
  /** Override whether the next button reads Submit (true) or Next (false); `null` restores the default. */
  setOverrideOnLastStep: (value: boolean | null) => void
  /** Replace the screen heading (bulk load mapping screens name the field or profile). */
  setStepLabel: (label: string | null) => void
}

export const ProcessStepContext = createContext<ProcessStepContextValue | null>(null)

/**
 * Read the current process screen context.
 * @returns The context value.
 */
export function useProcessStep(): ProcessStepContextValue {
  const context = useContext(ProcessStepContext)
  if (!context) throw new Error('useProcessStep must be used inside a process screen')
  return context
}

/**
 * Register a component's submit contributor for the lifetime of the component.
 * The latest `contributor` closure is always used.
 * @param name - Unique name within the screen.
 * @param contributor - Called on every submission.
 */
export function useSubmitContributor(name: string, contributor: ProcessSubmitContributor): void {
  const { registerContributor } = useProcessStep()
  const latest = useRef(contributor)
  latest.current = contributor
  useEffect(() => registerContributor(name, () => latest.current()), [name, registerContributor])
}
