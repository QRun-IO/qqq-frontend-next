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
 * @file MSW handlers for authentication endpoints (`/metaData/authentication`, `/manageSession`, `/logout`).
 */

import { http, HttpResponse } from 'msw'
import { authMetadata } from '../fixtures/auth-metadata'

const BASE = '/qqq/v1'

export const authHandlers = [
  // GET /metaData/authentication
  http.get(`${BASE}/metaData/authentication`, () => {
    return HttpResponse.json(authMetadata)
  }),

  // POST /manageSession
  http.post(`${BASE}/manageSession`, () => {
    return HttpResponse.json({
      uuid: 'mock-session-uuid-1234',
      values: {},
    })
  }),

  // POST /logout
  http.post(`${BASE}/logout`, () => {
    return new HttpResponse(null, { status: 200 })
  }),

  // POST /oidc/backchannel-logout (no-op in mock)
  http.post(`${BASE}/oidc/backchannel-logout`, () => {
    return new HttpResponse(null, { status: 200 })
  }),
]
