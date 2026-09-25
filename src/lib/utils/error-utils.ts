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
 * @file error-utils — shared utilities for inspecting and extracting information from error objects.
 */

import { AxiosError } from 'axios'

/**
 * Extracts an HTTP status code from an error, if available.
 *
 * Handles two common error shapes:
 * - `AxiosError` — reads `error.response.status`
 * - Plain objects with a numeric `status` property (e.g. fetch Response wrappers)
 *
 * Returns `undefined` for any other error shape, including non-object errors and null.
 *
 * @param error - The unknown error value thrown or caught.
 * @returns The HTTP status code, or `undefined` if none can be determined.
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (!error) return undefined

  if (error instanceof AxiosError) {
    return error.response?.status
  }

  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as Record<string, unknown>).status
    if (typeof status === 'number') return status
  }

  return undefined
}

/**
 * Returns the user-facing message for an error, preferring the QQQ backend's
 * `userFacingError` or `error` response body over the generic transport message
 * (for example "Request failed with status code 400").
 *
 * @param error - The unknown error thrown by an API call.
 * @param fallback - Message used when no text can be extracted.
 * @returns The most specific message available.
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (error instanceof AxiosError) {
    const body: unknown = error.response?.data
    if (body && typeof body === 'object') {
      for (const key of ['userFacingError', 'error'] as const) {
        const text = (body as Record<string, unknown>)[key]
        if (typeof text === 'string' && text.trim()) return text
      }
    }
  }
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

/**
 * Explains why a single record could not be loaded, worded like the Material dashboard.
 *
 * @param tableLabel - The table's label.
 * @param recordId - The requested primary key.
 * @param error - The load error.
 * @returns A sentence for the page.
 */
export function recordLoadFailure(tableLabel: string, recordId: string | number, error: unknown): string {
  const status = getErrorStatusCode(error)
  if (status === 404) return `${tableLabel} ${recordId} could not be found.`
  if (status === 403) return `You do not have permission to view ${tableLabel} records`
  return getErrorMessage(error, `Failed to load ${tableLabel} ${recordId}`)
}
