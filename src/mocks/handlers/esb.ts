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
 * @file MSW handlers for the ESB endpoints (`GET /qqq/v1/esb/table/:tableName`).
 */

import { http, HttpResponse } from 'msw'
import type { EsbTableResponse } from '@/types'
import { orderEsb } from '../fixtures/esb'

const BASE = '/qqq/v1'

const esbTables: Record<string, EsbTableResponse> = {
  order: orderEsb,
}

export const esbHandlers = [
  // GET /esb/table/:tableName — 404 for tables without ESB metadata, as the backend answers
  http.get(`${BASE}/esb/table/:tableName`, ({ params }) => {
    const { tableName } = params as { tableName: string }
    const data = esbTables[tableName]
    if (!data) {
      return HttpResponse.json(
        { error: `Table '${tableName}' has no ESB metadata` },
        { status: 404 }
      )
    }
    return HttpResponse.json(data)
  }),
]
