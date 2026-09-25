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
 * @file OIDC / Auth0 browser helpers — PKCE, provider discovery, authorization and
 * end-session URLs, and the Auth0 public-client code exchange.
 *
 * These calls go to the identity provider, not the QQQ API, so they use `fetch`
 * directly. QQQ session calls live in `@/lib/api/auth`.
 */

import type { QAuthenticationMetaData } from '@/types'

/** sessionStorage keys that carry one authorization attempt across the IdP redirect. */
export const PKCE_STORAGE = {
  verifier: 'pkce_code_verifier',
  state: 'oauth_state',
  returnTo: 'oauth2ReturnTo',
  redirectUri: 'oauth2RedirectUri',
} as const

/** Scopes requested when the backend metadata does not declare any (Material parity). */
export const DEFAULT_SCOPES = 'openid profile email offline_access'

/** Provider endpoints from `/.well-known/openid-configuration`. */
export interface OidcProviderMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint?: string
  end_session_endpoint?: string
}

/** Tokens returned by an authorization-code exchange. */
export interface TokenResponse {
  access_token: string
  id_token?: string
  token_type?: string
  expires_in?: number
}

/**
 * Base64url-encodes bytes without padding.
 *
 * @param bytes - Raw bytes.
 * @returns The encoded string.
 */
function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generates a PKCE code_verifier: 32 random bytes, base64url (43 characters, RFC 7636 §4.1).
 *
 * @returns The verifier.
 */
export function generateCodeVerifier(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

/**
 * Derives the S256 code_challenge for a verifier (RFC 7636 §4.2).
 *
 * @param verifier - The PKCE code verifier.
 * @returns The base64url SHA-256 digest.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/**
 * Generates a random state nonce for CSRF protection.
 *
 * @returns 16 random bytes, base64url.
 */
export function generateState(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(16)))
}

/**
 * The redirect URI registered with the identity provider. `/token` matches the
 * Material dashboard, so existing IdP client registrations keep working.
 *
 * @returns `{origin}/token`.
 */
export function redirectUri(): string {
  return `${window.location.origin}/token`
}

/**
 * Removes trailing slashes from a provider base URL.
 *
 * @param baseUrl - The URL.
 * @returns The URL without trailing slashes.
 */
function trimBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

/**
 * The provider base URL and client id, which OAUTH2 and AUTH_0 require.
 *
 * @param authMeta - Backend authentication metadata.
 * @returns The base URL and client id.
 * @throws When either is missing.
 */
function requireValues(authMeta: QAuthenticationMetaData): { baseUrl: string; clientId: string } {
  const baseUrl = authMeta.values?.baseUrl
  const clientId = authMeta.values?.clientId
  if (!baseUrl || !clientId) {
    throw new Error(`${authMeta.type} authentication metadata is missing baseUrl and/or clientId.`)
  }
  return { baseUrl, clientId }
}

const discoveryCache = new Map<string, Promise<OidcProviderMetadata>>()

/**
 * Loads (once per issuer) the OIDC provider metadata from its discovery document.
 *
 * @param baseUrl - The issuer URL from the QQQ authentication metadata.
 * @returns The provider endpoints.
 * @throws When discovery fails or omits the authorization endpoint.
 */
export function discoverProvider(baseUrl: string): Promise<OidcProviderMetadata> {
  const key = trimBase(baseUrl)
  let pending = discoveryCache.get(key)
  if (!pending) {
    pending = fetch(`${key}/.well-known/openid-configuration`, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Identity provider discovery failed (${response.status}).`)
        const metadata = await response.json() as OidcProviderMetadata
        if (!metadata.authorization_endpoint) throw new Error('Identity provider discovery has no authorization_endpoint.')
        return metadata
      })
    pending.catch(() => discoveryCache.delete(key))
    discoveryCache.set(key, pending)
  }
  return pending
}

/**
 * Builds the authorization-code + PKCE URL for OAUTH2 (discovered endpoint) or
 * AUTH_0 (`{baseUrl}/authorize`, with the API audience).
 *
 * @param authMeta - Backend authentication metadata.
 * @param challenge - The S256 code challenge.
 * @param state - The CSRF state nonce.
 * @returns The authorization URL.
 */
export async function buildAuthorizationUrl(authMeta: QAuthenticationMetaData, challenge: string, state: string): Promise<string> {
  const { baseUrl, clientId } = requireValues(authMeta)
  const endpoint = authMeta.type === 'AUTH_0'
    ? `${trimBase(baseUrl)}/authorize`
    : (await discoverProvider(baseUrl)).authorization_endpoint
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri(),
    scope: authMeta.values?.scopes || DEFAULT_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  if (authMeta.values?.audience) params.set('audience', authMeta.values.audience)
  return `${endpoint}?${params.toString()}`
}

/**
 * Stores a new PKCE attempt and sends the browser to the identity provider.
 *
 * @param authMeta - Backend authentication metadata (OAUTH2 or AUTH_0).
 * @param returnTo - Validated in-app path to return to after sign-in.
 */
export async function startAuthorizationRedirect(authMeta: QAuthenticationMetaData, returnTo: string): Promise<void> {
  const verifier = generateCodeVerifier()
  const state = generateState()
  const url = await buildAuthorizationUrl(authMeta, await generateCodeChallenge(verifier), state)
  sessionStorage.setItem(PKCE_STORAGE.verifier, verifier)
  sessionStorage.setItem(PKCE_STORAGE.state, state)
  sessionStorage.setItem(PKCE_STORAGE.returnTo, returnTo)
  sessionStorage.setItem(PKCE_STORAGE.redirectUri, redirectUri())
  window.location.assign(url)
}

/**
 * Exchanges an Auth0 authorization code for tokens as a public (PKCE) client.
 *
 * @param authMeta - AUTH_0 authentication metadata.
 * @param code - The authorization code.
 * @param codeVerifier - The PKCE verifier for this attempt.
 * @returns The token response.
 */
export async function exchangeAuth0Code(authMeta: QAuthenticationMetaData, code: string, codeVerifier: string): Promise<TokenResponse> {
  const { baseUrl, clientId } = requireValues(authMeta)
  const response = await fetch(`${trimBase(baseUrl)}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: sessionStorage.getItem(PKCE_STORAGE.redirectUri) ?? redirectUri(),
    }).toString(),
  })
  const body = await response.json().catch(() => ({})) as Partial<TokenResponse> & { error?: string; error_description?: string }
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `Token exchange failed (${response.status}).`)
  }
  return body as TokenResponse
}

/**
 * Reads display identity claims from an (already provider-verified) ID token.
 * Used only for display; the backend validates the access token itself.
 *
 * @param idToken - A compact JWT.
 * @returns name and email when present.
 */
export function identityFromIdToken(idToken: string | undefined): { name?: string; email?: string } | null {
  if (!idToken) return null
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
    const name = typeof payload.name === 'string' ? payload.name : undefined
    const email = typeof payload.email === 'string' ? payload.email : undefined
    return name || email ? { name, email } : null
  } catch {
    return null
  }
}

/**
 * The identity provider sign-out URL, when the provider has one.
 *
 * @param authMeta - Backend authentication metadata.
 * @param postLogoutRedirect - Where the provider should send the browser afterwards.
 * @returns The URL, or null when the provider publishes no end-session endpoint.
 */
export async function buildEndSessionUrl(authMeta: QAuthenticationMetaData, postLogoutRedirect: string): Promise<string | null> {
  const { baseUrl, clientId } = requireValues(authMeta)
  if (authMeta.type === 'AUTH_0') {
    return `${trimBase(baseUrl)}/v2/logout?${new URLSearchParams({ client_id: clientId, returnTo: postLogoutRedirect })}`
  }
  const endpoint = (await discoverProvider(baseUrl)).end_session_endpoint
  if (!endpoint) return null
  return `${endpoint}?${new URLSearchParams({ client_id: clientId, post_logout_redirect_uri: postLogoutRedirect })}`
}
