/** Processes — QQQ process job lifecycle response shapes used during step-wizard execution */

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
 * The backend can dynamically add or remove wizard steps and modify field
 * definitions based on the data produced in earlier steps.
 */
export interface ProcessMetaDataAdjustment {
  /** New step definitions to inject into the process wizard at runtime. */
  addedSteps?: QFrontendStepMetaData[]
  /** Names of steps to remove from the process wizard at runtime. */
  removedSteps?: string[]
  /**
   * Partial field metadata overrides keyed by field name.
   * Only the provided properties are merged; others remain unchanged.
   */
  modifiedFields?: Record<string, Partial<QFieldMetaData>>
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
