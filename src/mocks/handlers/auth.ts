// MSW handlers for authentication endpoints

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
