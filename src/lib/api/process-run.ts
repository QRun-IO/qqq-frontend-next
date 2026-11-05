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
 * @file Run a screen-less process to completion through the v1 init/status routes, with the
 * result shape Material's `QController.processRun` gives dynamic components: `{ values }` when
 * complete and `{ error, userFacingError }` when refused or failed.
 */

import { processInit, processStatus } from './processes'

/** What `processRun` resolves to (a subset of Material's QJobComplete / QJobError). */
export interface ProcessRunResult {
  values?: Record<string, unknown>
  error?: string
  userFacingError?: string
}

/** Polling bounds for a process that continues as an async job. */
export interface ProcessRunOptions {
  pollIntervalMillis?: number
  timeoutMillis?: number
}

/**
 * Reads process input given as a `a=b&c=d` query string, a FormData or a plain object.
 *
 * @param input - The input in any of those forms.
 * @returns Text values keyed by name (uploaded files are not part of a screen-less run).
 */
export function processRunValues(input: unknown): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  if (typeof input === 'string') {
    for (const [key, value] of new URLSearchParams(input)) values[key] = value
  } else if (typeof FormData !== 'undefined' && input instanceof FormData) {
    for (const [key, value] of input.entries()) if (typeof value === 'string') values[key] = value
  } else if (input && typeof input === 'object') {
    Object.assign(values, input)
  }
  return values
}

/**
 * Runs the process to completion: init, then poll the async job when the backend continues it as one.
 *
 * @param processName - Backend process name.
 * @param input - Process input (query string, FormData or object).
 * @param options - Polling bounds.
 * @returns The completed values, or the refusal/failure text; never throws.
 */
export async function runProcessToCompletion(processName: string, input: unknown, options: ProcessRunOptions = {}): Promise<ProcessRunResult> {
  const { pollIntervalMillis = 500, timeoutMillis = 120_000 } = options
  const deadline = Date.now() + timeoutMillis
  let response = await processInit(processName, { values: processRunValues(input), stepTimeoutMillis: 30_000 })
  let jobUUID: string | undefined
  for (;;) {
    if (response.type === 'COMPLETE') return { values: response.values }
    if (response.type === 'ERROR') return { error: response.userFacingError ?? response.error ?? response.message ?? 'Process failed', userFacingError: response.userFacingError }
    if (response.type === 'JOB_STARTED') jobUUID = response.jobUUID
    if (!jobUUID || !response.processUUID) return { error: 'Unexpected server response.' }
    if (Date.now() >= deadline) return { error: 'Timed out waiting for the process to finish.' }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMillis))
    try {
      response = await processStatus(processName, response.processUUID, jobUUID)
    } catch {
      return { error: 'The server could not be reached while the process was running.' }
    }
  }
}
