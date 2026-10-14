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

/** @file Plain-English validation messages for preference writes and actions. */
import { isAxiosError } from 'axios'
import { getErrorMessage } from '@/lib/utils/error-utils'

/** All backend validation messages, retaining a useful fallback for other failures.
 * @param error - Failed preference write response.
 * @returns Messages for the error summary.
 */
export function preferenceMessages(error: unknown): string[] {
  if (isAxiosError(error)) {
    const body: unknown = error.response?.data
    if (body && typeof body === 'object') {
      for (const key of ['messages', 'errors'] as const) {
        const value = (body as Record<string, unknown>)[key]
        if (Array.isArray(value)) {
          const texts = value.filter((item): item is string => typeof item === 'string')
          if (texts.length) return texts
        }
      }
    }
  }
  return [getErrorMessage(error, 'Could not save preferences. Please try again.')]
}
