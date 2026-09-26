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

import type { EsbTableResponse } from '@/types'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import apiClient from './client'

/**
 * Loads a table's ESB publications and subscribing triggers from `GET /esb/table/{table}`.
 *
 * The backend answers 403 when the user may not read the table and 404 when the table has
 * no ESB metadata (or the backend has no ESB module); both mean there is nothing to show.
 *
 * @param tableName - Backend table name.
 * @returns The table's ESB section, or `null` on 403 or 404.
 * @throws The request error for any other failure, or an `Error` when the body is not an ESB table response.
 */
export async function getEsbForTable(tableName: string): Promise<EsbTableResponse | null> {
  let data: EsbTableResponse
  try {
    data = await apiClient.get<EsbTableResponse>(`/esb/table/${encodeURIComponent(tableName)}`)
  } catch (error) {
    const status = getErrorStatusCode(error)
    if (status === 403 || status === 404) return null
    throw error
  }
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray(data.publications) ||
    !Array.isArray(data.subscribers)
  ) {
    throw new Error('Invalid ESB response')
  }
  return data
}
