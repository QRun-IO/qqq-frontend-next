// Shared error inspection utilities

import { AxiosError } from 'axios'

/**
 * Extracts an HTTP status code from an error, if available.
 * Supports AxiosError and generic error objects with a `status` property.
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
