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
 * @file MSW handlers for QQQ metadata endpoints (`/metaData`, `/metaData/table/:name`, `/metaData/process/:name`).
 */

import { http, HttpResponse } from 'msw'
import { qInstance } from '../fixtures/q-instance'

const BASE = '/qqq/v1'

export const metadataHandlers = [
  // GET /metaData — full QInstance
  http.get(`${BASE}/metaData`, () => {
    return HttpResponse.json(qInstance)
  }),

  // GET /metaData/table/:tableName
  http.get(`${BASE}/metaData/table/:tableName`, ({ params }) => {
    const { tableName } = params as { tableName: string }
    const table = qInstance.tables[tableName]
    if (!table) {
      return HttpResponse.json({ error: `Table '${tableName}' not found` }, { status: 404 })
    }
    return HttpResponse.json(table)
  }),

  // GET /metaData/process/:processName
  http.get(`${BASE}/metaData/process/:processName`, ({ params }) => {
    const { processName } = params as { processName: string }
    const process = qInstance.processes[processName]
    if (!process) {
      return HttpResponse.json({ error: `Process '${processName}' not found` }, { status: 404 })
    }
    return HttpResponse.json(process)
  }),

  // GET /metaData/process/:processName on the registered route (wraps the process, as the backend does)
  http.get('/metaData/process/:processName', ({ params }) => {
    const { processName } = params as { processName: string }
    const process = qInstance.processes[processName]
    if (!process) {
      return HttpResponse.json({ error: `Process '${processName}' not found` }, { status: 404 })
    }
    return HttpResponse.json({ process })
  }),
]
