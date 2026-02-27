/** error-utils — shared utilities for inspecting and extracting information from error objects */

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
