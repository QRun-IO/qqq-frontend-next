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
 * @file MSW helper for the v1 record get route: tests describe the record itself, and the
 * helper serves it in the v1 `{ record }` envelope at `/qqq/v1/table/{table}/{pk}`.
 */

import { http, HttpResponse, type HttpResponseResolver } from 'msw'

/**
 * Serve a record from the v1 `GET /qqq/v1/table/{table}/{pk}` route.
 *
 * @param path - Route below `/qqq/v1`, e.g. `/table/person/1`.
 * @param resolver - Returns the record (as JSON) or an error response; 2xx bodies are wrapped as `{ record }`.
 * @returns The MSW handler.
 */
export function recordGet(path: string, resolver: HttpResponseResolver) {
  return http.get(`/qqq/v1${path}`, async (info) => {
    const response = await resolver(info)
    if (!(response instanceof Response) || response.status >= 300) return response
    const body = await response.clone().json()
    return HttpResponse.json({ record: body }, { status: response.status })
  })
}
