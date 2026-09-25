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
 * @file QQQ process job lifecycle response shapes used during step-wizard execution.
 */

// QQQ Process Job Types - ported from qqq-frontend-core

import type { QFrontendStepMetaData, QFieldMetaData } from './metadata'

/**
 * Initial response returned when a process job is successfully submitted.
 *
 * The client stores `jobUUID` and polls the status endpoint until the job
 * transitions to `QJobRunning`, `QJobComplete`, or `QJobError`.
 */
export interface QJobStarted {
  /** UUID of the process instance that owns this job run. */
  processUUID: string
  /** UUID of the submitted job, used in subsequent status poll requests. */
  jobUUID: string
}

/**
 * Intermediate status response returned while a job is executing asynchronously.
 *
 * `current` and `total` are available when the backend can estimate progress;
 * the frontend uses them to display a progress bar.
 */
export interface QJobRunning {
  /** UUID of the process instance being executed. */
  processUUID: string
  /** Human-readable status message suitable for display in the wizard UI. */
  message: string
  /** Number of units of work completed so far (optional — used for progress). */
  current?: number
  /** Total units of work expected (optional — used for progress denominator). */
  total?: number
}

/**
 * Terminal success response returned when a process step finishes executing.
 *
 * Contains the output values produced by the step, navigation hints for
 * the wizard (next / back step names), and any runtime metadata adjustments.
 */
export interface QJobComplete {
  /** UUID of the process instance that finished. */
  processUUID: string
  /** Key/value map of output values produced by the completed step. */
  values: Record<string, unknown>
  /** Name of the frontend step the wizard should advance to; omitted on the final step. */
  nextStep?: string
  /** Name of the frontend step the wizard should retreat to on "Back". */
  backStep?: string
  /** Optional adjustments to the process metadata applied after this step completes. */
  processMetaDataAdjustment?: ProcessMetaDataAdjustment
}

/**
 * Terminal error response returned when a process step fails.
 *
 * `error` is a technical message for logging; `userFacingError` is the
 * message shown to the end user in the wizard UI.
 */
export interface QJobError {
  /** UUID of the process instance that encountered an error. */
  processUUID: string
  /** Technical error message (may contain stack traces or internal details). */
  error: string
  /** Optional sanitized message suitable for display to end users. */
  userFacingError?: string
}

/**
 * Describes runtime adjustments to a process's frontend metadata applied
 * after a step completes.
 *
 * The backend (`ProcessMetaDataAdjustment` in qqq-backend-core) can replace the
 * list of frontend steps and replace field definitions, based on the data
 * produced in earlier steps.
 */
export interface ProcessMetaDataAdjustment {
  /** The complete, ordered list of frontend steps the process will now show. */
  updatedFrontendStepList?: QFrontendStepMetaData[]
  /** Replacement field definitions keyed by field name, applied to every step that uses the field. */
  updatedFields?: Record<string, QFieldMetaData>
}

/**
 * Discriminated union of all possible job status response shapes.
 *
 * Narrow to a specific variant by checking the properties present:
 * - `QJobStarted` — has `jobUUID`
 * - `QJobRunning` — has `message`
 * - `QJobComplete` — has `values`
 * - `QJobError` — has `error`
 */
export type QJobResponse = QJobStarted | QJobRunning | QJobComplete | QJobError
