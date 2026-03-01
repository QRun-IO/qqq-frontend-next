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
 * @file Login page — authenticates the user and redirects to the dashboard.
 */

'use client'

// Login page — authenticates user and redirects to dashboard.
//
// Flow by auth type:
//   FULLY_ANONYMOUS / MOCK  — AuthProvider auto-calls manageSession; this page
//                             just waits for isAuthenticated to become true.
//   OAUTH2                  — This page generates a PKCE code_verifier/challenge,
//                             stores state + verifier in sessionStorage, then
//                             redirects the browser to the IdP authorization URL.
//                             The callback is handled by /auth/callback.
//   AUTH_0                  — Same PKCE redirect pattern using the Auth0
//                             /authorize endpoint derived from values.baseUrl.
//
// Wrapped in Suspense because it uses useSearchParams().

import React, { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import type { QAuthenticationMetaData } from '@/types'
import { useAuth } from '@/lib/auth/use-auth'

// ---------------------------------------------------------------------------
// PKCE helpers (Web Crypto API — no external dependency required)
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random PKCE code_verifier (64 URL-safe chars).
 *
 * Spec: https://datatracker.ietf.org/doc/html/rfc7636#section-4.1
 *
 * @returns A 64-character hex string suitable for use as a PKCE code_verifier.
 */
function generateCodeVerifier(): string {
  // Two UUIDs without hyphens gives 64 hex characters — well within the
  // 43–128 character range mandated by RFC 7636.
  return (
    crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  )
}

/**
 * Derives the PKCE code_challenge from a code_verifier using S256 method.
 *
 * Spec: https://datatracker.ietf.org/doc/html/rfc7636#section-4.2
 *
 * @param verifier - The plain-text code verifier.
 * @returns Base64url-encoded SHA-256 digest of the verifier.
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Generates a cryptographically random state nonce for CSRF protection.
 *
 * @returns A 32-character hex string to use as the OAuth2 `state` parameter.
 */
function generateState(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

// ---------------------------------------------------------------------------
// Authorization-URL builders
// ---------------------------------------------------------------------------

/**
 * Builds the OAuth2/OIDC PKCE authorization URL.
 *
 * The redirect URI defaults to `{origin}/auth/callback`, which must be
 * registered with the identity provider.
 *
 * Metadata fields used:
 *   - `values.baseUrl`  — OIDC authority / issuer base URL.
 *     The authorization endpoint is derived as `{baseUrl}/authorize`.
 *     TODO: If the IdP uses a non-standard authorization endpoint path (e.g.
 *     some providers use `/oauth2/authorize` or `/connect/authorize`), add an
 *     `authorizationEndpoint` field to QAuthenticationMetaData.values so the
 *     full URL can be supplied explicitly from the backend.
 *   - `values.clientId` — OAuth2 client_id.
 *   - `values.audience` — Optional API audience (non-standard but common).
 *
 * TODO: QAuthenticationMetaData.values does not expose `scopes` or
 * `redirectUri`; add these fields to the backend metadata response so the
 * frontend can use them without hardcoding defaults.
 *
 * @param authMeta - Authentication metadata from the backend.
 * @param challenge - PKCE code_challenge (S256).
 * @param state - State nonce for CSRF protection.
 * @returns Fully-formed authorization URL string.
 * @throws {Error} When required metadata fields are missing.
 */
function buildOAuth2AuthorizationUrl(
  authMeta: QAuthenticationMetaData,
  challenge: string,
  state: string
): string {
  const { baseUrl, clientId } = authMeta.values
  if (!baseUrl) {
    throw new Error(
      '[Auth] OAUTH2: missing values.baseUrl in auth metadata — cannot build authorization URL'
    )
  }
  if (!clientId) {
    throw new Error(
      '[Auth] OAUTH2: missing values.clientId in auth metadata — cannot build authorization URL'
    )
  }

  // TODO: Derive the authorization endpoint from OIDC discovery
  // (GET {baseUrl}/.well-known/openid-configuration) instead of appending
  // "/authorize" here. Add a values.authorizationEndpoint override field to
  // QAuthenticationMetaData so backends that use non-standard paths can
  // supply the full URL explicitly.
  const authorizationEndpoint = `${baseUrl.replace(/\/$/, '')}/authorize`

  // TODO: Add values.scopes to QAuthenticationMetaData so the requested scope
  // set can be configured per-deployment. Defaulting to "openid profile email"
  // for now; adjust if your IdP requires additional scopes.
  const scope = 'openid profile email'

  const redirectUri = `${window.location.origin}/auth/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  // Append optional audience (non-standard; used by some OAuth2 providers)
  if (authMeta.values.audience) {
    params.set('audience', authMeta.values.audience)
  }

  return `${authorizationEndpoint}?${params.toString()}`
}

/**
 * Builds the Auth0 PKCE authorization URL.
 *
 * Auth0's authorization endpoint follows the pattern:
 *   `https://{domain}/authorize`
 *
 * Metadata fields used:
 *   - `values.baseUrl`  — Auth0 tenant domain (e.g. `https://my-tenant.auth0.com`).
 *   - `values.clientId` — Auth0 application client_id.
 *   - `values.audience` — Auth0 API audience identifier.
 *
 * TODO: Add values.scopes to QAuthenticationMetaData for Auth0 as well.
 *
 * @param authMeta - Authentication metadata from the backend.
 * @param challenge - PKCE code_challenge (S256).
 * @param state - State nonce for CSRF protection.
 * @returns Fully-formed Auth0 authorize URL string.
 * @throws {Error} When required metadata fields are missing.
 */
function buildAuth0AuthorizationUrl(
  authMeta: QAuthenticationMetaData,
  challenge: string,
  state: string
): string {
  const { baseUrl, clientId, audience } = authMeta.values
  if (!baseUrl) {
    throw new Error(
      '[Auth] AUTH_0: missing values.baseUrl in auth metadata — cannot build Auth0 authorization URL'
    )
  }
  if (!clientId) {
    throw new Error(
      '[Auth] AUTH_0: missing values.clientId in auth metadata — cannot build Auth0 authorization URL'
    )
  }

  // Auth0 always uses /authorize at the domain root.
  const authorizationEndpoint = `${baseUrl.replace(/\/$/, '')}/authorize`

  // TODO: Add values.scopes to QAuthenticationMetaData so the scope set can
  // be configured per-deployment instead of hardcoded here.
  const scope = 'openid profile email'

  const redirectUri = `${window.location.origin}/auth/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  // Auth0 requires the audience parameter to issue an access token for an API.
  if (audience) {
    params.set('audience', audience)
  }

  return `${authorizationEndpoint}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// PKCE redirect initiator
// ---------------------------------------------------------------------------

/**
 * Generates PKCE credentials, stores them in sessionStorage, and redirects the
 * browser to the IdP authorization endpoint.
 *
 * Storage keys written:
 *   - `'pkce_code_verifier'` — plain-text verifier for the callback page
 *   - `'oauth_state'`        — state nonce validated on return (CSRF guard)
 *   - `'oauth2ReturnTo'`     — post-login destination URL
 *
 * @param authMeta - Authentication metadata describing the IdP.
 * @param returnTo - The path to redirect to after successful login.
 */
async function initiatePkceRedirect(
  authMeta: QAuthenticationMetaData,
  returnTo: string
): Promise<void> {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()

  // Persist PKCE params so the callback page can complete the flow.
  sessionStorage.setItem('pkce_code_verifier', verifier)
  sessionStorage.setItem('oauth_state', state)
  sessionStorage.setItem('oauth2ReturnTo', returnTo)

  let authorizationUrl: string
  if (authMeta.type === 'AUTH_0') {
    authorizationUrl = buildAuth0AuthorizationUrl(authMeta, challenge, state)
  } else {
    authorizationUrl = buildOAuth2AuthorizationUrl(authMeta, challenge, state)
  }

  // Hard-navigate so the browser fully leaves this page and arrives at the IdP.
  window.location.href = authorizationUrl
}

// ---------------------------------------------------------------------------
// Login page component
// ---------------------------------------------------------------------------

/**
 * Inner login content — handles auto-redirect when already authenticated,
 * initiates PKCE redirect for OAUTH2 / AUTH_0 auth types, and renders
 * appropriate loading or redirecting UI while authentication resolves.
 *
 * @returns A loading spinner, a "redirecting" card, or null once redirect fires.
 */
function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, authMetadata } = useAuth()
  const redirectInitiated = useRef(false)

  const returnTo = searchParams.get('returnTo') ?? '/'

  // Redirect to dashboard once authenticated.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      try {
        const decoded = decodeURIComponent(returnTo)
        // Only redirect to relative paths (security: prevent open redirect)
        if (decoded.startsWith('/')) {
          router.replace(decoded)
        } else {
          router.replace('/')
        }
      } catch {
        router.replace('/')
      }
    }
  }, [isAuthenticated, isLoading, router, returnTo])

  // Initiate PKCE redirect for OAUTH2 / AUTH_0 once metadata is available
  // and the user is not already authenticated.
  useEffect(() => {
    if (isAuthenticated) return
    if (!authMetadata) return
    if (authMetadata.type !== 'OAUTH2' && authMetadata.type !== 'AUTH_0') return
    if (redirectInitiated.current) return
    redirectInitiated.current = true

    const destination = (() => {
      try {
        const decoded = decodeURIComponent(returnTo)
        return decoded.startsWith('/') ? decoded : '/'
      } catch {
        return '/'
      }
    })()

    initiatePkceRedirect(authMetadata, destination).catch((err: unknown) => {
      console.error('[Login] Failed to initiate PKCE redirect:', err)
    })
  }, [authMetadata, isAuthenticated, returnTo])

  // While the AuthProvider is still resolving (initial load or anonymous
  // session setup), show the spinner.
  if (isLoading) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <h1 className="text-xl font-semibold text-foreground">
            Authenticating...
          </h1>
          <p className="text-sm text-muted-foreground">
            {authMetadata
              ? `Setting up ${authMetadata.type} session...`
              : 'Checking authentication...'}
          </p>
        </div>
      </div>
    )
  }

  // Not loading + not authenticated. For OAUTH2/AUTH_0 we have just fired (or
  // are about to fire) a redirect — show a "redirecting" state. For anonymous
  // types the AuthProvider is still completing setup.
  const isRedirecting =
    authMetadata?.type === 'OAUTH2' || authMetadata?.type === 'AUTH_0'

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground"
          aria-hidden="true"
        >
          Q
        </div>
        <h1 className="text-xl font-semibold text-foreground">QQQ Admin</h1>
        <p className="text-sm text-muted-foreground">
          {isRedirecting
            ? 'Redirecting to authentication provider...'
            : 'Setting up anonymous session...'}
        </p>
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

/**
 * Login page exported as the Next.js default for `/login`.
 *
 * Wraps `LoginContent` in a `<Suspense>` boundary because `useSearchParams()`
 * requires Suspense in the App Router.
 *
 * @returns The login page wrapped in a full-screen centered container.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  )
}
