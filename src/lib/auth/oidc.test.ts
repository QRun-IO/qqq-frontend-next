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

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QAuthenticationMetaData } from '@/types'
import { buildAuthorizationUrl, buildEndSessionUrl, generateCodeChallenge, generateCodeVerifier, identityFromIdToken, redirectUri } from './oidc'

const oauth2: QAuthenticationMetaData = { name: 'OAuth2', type: 'OAUTH2', values: { baseUrl: 'https://idp.example/realm', clientId: 'qqq', scopes: 'openid profile email' } }
const auth0: QAuthenticationMetaData = { name: 'auth0', type: 'AUTH_0', values: { baseUrl: 'https://tenant.auth0.example/', clientId: 'spa', audience: 'https://api.example' } }

function mockDiscovery(overrides: Record<string, string> = {}) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    issuer: 'https://idp.example/realm',
    authorization_endpoint: 'https://idp.example/realm/protocol/openid-connect/auth',
    end_session_endpoint: 'https://idp.example/realm/protocol/openid-connect/logout',
    ...overrides,
  }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('oidc helpers (QRun-IO/qqq#670)', () => {
  it('creates RFC 7636 verifiers and S256 challenges', async () => {
    const verifier = generateCodeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    // RFC 7636 appendix B test vector
    expect(await generateCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('uses the Material-compatible /token redirect URI', () => {
    expect(redirectUri()).toBe(`${window.location.origin}/token`)
  })

  it('builds the OAUTH2 authorization URL from discovery with the backend scopes', async () => {
    const fetchMock = mockDiscovery()
    const url = new URL(await buildAuthorizationUrl(oauth2, 'challenge', 'state-1'))
    expect(fetchMock).toHaveBeenCalledWith('https://idp.example/realm/.well-known/openid-configuration', expect.anything())
    expect(url.origin + url.pathname).toBe('https://idp.example/realm/protocol/openid-connect/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code', client_id: 'qqq', redirect_uri: `${window.location.origin}/token`,
      scope: 'openid profile email', state: 'state-1', code_challenge: 'challenge', code_challenge_method: 'S256',
    })
  })

  it('builds the AUTH_0 authorization URL with the audience', async () => {
    const url = new URL(await buildAuthorizationUrl(auth0, 'c', 's'))
    expect(url.origin + url.pathname).toBe('https://tenant.auth0.example/authorize')
    expect(url.searchParams.get('audience')).toBe('https://api.example')
  })

  it('rejects metadata without a client id', async () => {
    await expect(buildAuthorizationUrl({ ...oauth2, values: { baseUrl: 'https://idp.example' } }, 'c', 's')).rejects.toThrow(/clientId/)
  })

  it('builds end-session URLs for OAUTH2 (discovered) and AUTH_0', async () => {
    mockDiscovery()
    expect(await buildEndSessionUrl({ ...oauth2, values: { ...oauth2.values, baseUrl: 'https://idp.example/realm2' } }, 'https://app.example/login'))
      .toBe('https://idp.example/realm/protocol/openid-connect/logout?client_id=qqq&post_logout_redirect_uri=https%3A%2F%2Fapp.example%2Flogin')
    expect(await buildEndSessionUrl(auth0, 'https://app.example/login'))
      .toBe('https://tenant.auth0.example/v2/logout?client_id=spa&returnTo=https%3A%2F%2Fapp.example%2Flogin')
  })

  it('reads display claims from an ID token', () => {
    const payload = btoa(JSON.stringify({ name: 'Dana', email: 'dana@example.com' })).replace(/=+$/, '')
    expect(identityFromIdToken(`h.${payload}.s`)).toEqual({ name: 'Dana', email: 'dana@example.com' })
    expect(identityFromIdToken('garbage')).toBeNull()
    expect(identityFromIdToken(undefined)).toBeNull()
  })
})
