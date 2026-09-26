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
 * @file ESB API — permission-checked `/qqq/v1/esb` endpoints served by the `qqq-esb` module.
 */

import type {
  EsbMessagePage,
  EsbOverviewResponse,
  EsbProcessResponse,
  EsbTableResponse,
} from '@/types'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient from './client'
import { processInit } from './processes'

/** Messages per page when browsing, the backend's default. */
export const ESB_PAGE_SIZE = 50

/** Output of an ESB operate process (`esbPauseTrigger`, `esbPurgeQueue`, ...). */
export interface EsbActionResult {
  /** Messages or consumers affected, or `null` when the process did not report it. */
  count: number | null
  message: string
}

/**
 * Loads a table's ESB publications and subscribing triggers from `GET /esb/table/{table}`.
 *
 * With the `qqq-esb` module installed, the backend answers 403 when the user may not read the
 * table and 404 when the table has no ESB metadata. Without the module the route does not exist,
 * and the default Javalin root-SPA not-found handler answers 200 with the SPA's `index.html`.
 * All three mean there is nothing to show, so none of them is an error.
 *
 * @param tableName - Backend table name.
 * @returns The table's ESB section, or `null` on 403, on 404, or when a 2xx body is not an ESB table object.
 * @throws The request error for any other failure.
 */
export async function getEsbForTable(tableName: string): Promise<EsbTableResponse | null> {
  const data = await getOrNull(`/esb/table/${encodeURIComponent(tableName)}`)
  return hasArrays<EsbTableResponse>(data, 'publications', 'subscribers') ? data : null
}

/**
 * Loads a process's ESB publications and the triggers that start it from
 * `GET /esb/process/{process}`. As with {@link getEsbForTable}, 403, 404 and a non-ESB body
 * all mean there is nothing to show.
 *
 * @param processName - Backend process name.
 * @returns The process's ESB section, or `null` on 403, on 404, or when a 2xx body is not an ESB process object.
 * @throws The request error for any other failure.
 */
export async function getEsbForProcess(processName: string): Promise<EsbProcessResponse | null> {
  const data = await getOrNull(`/esb/process/${encodeURIComponent(processName)}`)
  return hasArrays<EsbProcessResponse>(data, 'publications', 'triggers') ? data : null
}

/**
 * Loads every provider, destination, publisher and trigger from `GET /esb/overview`.
 *
 * @returns The overview, or `null` on 403, on 404, or when a 2xx body is not an ESB overview.
 * @throws The request error for any other failure.
 */
export async function getEsbOverview(): Promise<EsbOverviewResponse | null> {
  const data = await getOrNull('/esb/overview')
  return hasArrays<EsbOverviewResponse>(data, 'providers', 'destinations') ? data : null
}

/**
 * Browses one page of the messages waiting on a destination's queue via
 * `GET /esb/messages/{destination}`.
 *
 * @param destinationName - QQQ destination name.
 * @param offset - Messages to skip.
 * @param limit - Messages to return.
 * @returns The page of messages.
 * @throws The request error, or an error when the body is not a message page.
 */
export async function getEsbMessages(
  destinationName: string,
  offset = 0,
  limit = ESB_PAGE_SIZE
): Promise<EsbMessagePage> {
  return getMessagePage(`/esb/messages/${encodeURIComponent(destinationName)}`, offset, limit)
}

/**
 * Browses one page of a trigger's dead letters via `GET /esb/deadLetters/{trigger}`.
 *
 * @param triggerName - Trigger name (`<processName>.<destinationName>`).
 * @param offset - Messages to skip.
 * @param limit - Messages to return.
 * @returns The page of dead letters.
 * @throws The request error, or an error when the body is not a message page.
 */
export async function getEsbDeadLetters(
  triggerName: string,
  offset = 0,
  limit = ESB_PAGE_SIZE
): Promise<EsbMessagePage> {
  return getMessagePage(`/esb/deadLetters/${encodeURIComponent(triggerName)}`, offset, limit)
}

/**
 * Runs an ESB operate process through the standard process API and reads its output values.
 *
 * @param processName - The operate process, e.g. `esbPurgeQueue`.
 * @param values - Its input values, e.g. `providerName` and `brokerQueueName`.
 * @returns The process's `count` and `message`; a generic message while it continues as a job.
 * @throws An error with the process's user-facing message when it fails or is refused.
 */
export async function runEsbAction(
  processName: string,
  values: Record<string, string | boolean>
): Promise<EsbActionResult> {
  const response = await processInit(processName, { values })
  if (response.type === 'ERROR') {
    throw new Error(response.userFacingError ?? response.error)
  }
  if (response.type !== 'COMPLETE') {
    return { count: null, message: 'The action is still running.' }
  }
  const count = Number(response.values.count)
  const message = response.values.message
  return {
    count: response.values.count == null || Number.isNaN(count) ? null : count,
    message: typeof message === 'string' && message ? message : 'Done.',
  }
}

/**
 * GETs an ESB resource, treating 403 and 404 as "nothing to show".
 *
 * @param path - Path under the API base URL.
 * @returns The parsed body, or `null` on 403 or 404.
 * @throws The request error for any other failure.
 */
async function getOrNull(path: string): Promise<unknown> {
  try {
    return await apiClient.get<unknown>(path)
  } catch (error) {
    const status = getErrorStatusCode(error)
    if (status === 403 || status === 404) return null
    throw error
  }
}

/**
 * GETs one page of browsed messages.
 *
 * @param path - Path under the API base URL.
 * @param offset - Messages to skip.
 * @param limit - Messages to return.
 * @returns The page.
 * @throws The request error, or an error when the body is not a message page.
 */
async function getMessagePage(path: string, offset: number, limit: number): Promise<EsbMessagePage> {
  const data = await apiClient.get<unknown>(path, { params: { offset, limit } })
  if (!hasArrays<EsbMessagePage>(data, 'messages')) {
    throw new Error('Invalid ESB message page')
  }
  return data
}

/**
 * Whether a response body is an object whose named properties are all arrays.
 *
 * @param data - The parsed response body.
 * @param keys - Properties that must be arrays.
 * @returns True when `data` is a non-array object with an array at every key.
 */
function hasArrays<T extends object>(data: unknown, ...keys: Array<keyof T & string>): data is T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const body = data as Record<string, unknown>
  return keys.every((key) => Array.isArray(body[key]))
}
