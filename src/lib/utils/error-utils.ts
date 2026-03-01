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
