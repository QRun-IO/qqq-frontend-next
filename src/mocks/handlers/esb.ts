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
 * @file MSW handlers for the ESB endpoints (`GET /qqq/v1/esb/table/:tableName`,
 * `/process/:processName`, `/overview`, `/messages/:destination` and `/deadLetters/:trigger`).
 */

import { http, HttpResponse } from 'msw'
import type { EsbMessagePage, EsbProcessResponse, EsbTableResponse } from '@/types'
import {
  esbOverview,
  fulfillOrderDeadLetters,
  fulfillOrderEsb,
  orderEsb,
  orderFulfillmentMessages,
} from '../fixtures/esb'

const BASE = '/qqq/v1'

const esbTables: Record<string, EsbTableResponse> = {
  order: orderEsb,
}

const esbProcesses: Record<string, EsbProcessResponse> = {
  fulfillOrder: fulfillOrderEsb,
}

const esbMessages: Record<string, EsbMessagePage> = {
  orderFulfillment: orderFulfillmentMessages,
}

const esbDeadLetters: Record<string, EsbMessagePage> = {
  'fulfillOrder.orderFulfillment': fulfillOrderDeadLetters,
}

/**
 * Answers with the entry for `name`, or a 404 as the backend does for objects without ESB metadata.
 *
 * @param entries - Fixture responses by name.
 * @param name - The requested name.
 * @param kind - What `name` names, for the error message.
 * @returns The fixture as JSON, or a 404 response.
 */
function esbResponse<T extends object>(entries: Record<string, T>, name: string, kind: string) {
  const data = entries[name]
  if (!data) {
    return HttpResponse.json({ error: `${kind} '${name}' has no ESB metadata` }, { status: 404 })
  }
  return HttpResponse.json(data)
}

export const esbHandlers = [
  http.get(`${BASE}/esb/table/:tableName`, ({ params }) =>
    esbResponse(esbTables, String(params.tableName), 'Table')
  ),
  http.get(`${BASE}/esb/process/:processName`, ({ params }) =>
    esbResponse(esbProcesses, String(params.processName), 'Process')
  ),
  http.get(`${BASE}/esb/overview`, () => HttpResponse.json(esbOverview)),
  http.get(`${BASE}/esb/messages/:destination`, ({ params }) =>
    esbResponse(esbMessages, String(params.destination), 'Destination')
  ),
  http.get(`${BASE}/esb/deadLetters/:trigger`, ({ params }) =>
    esbResponse(esbDeadLetters, String(params.trigger), 'Trigger')
  ),
]
