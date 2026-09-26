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
 * @file Auth API — Session management and authentication metadata endpoints.
 */

import type { QAuthenticationMetaData } from '@/types'
import apiClient from './client'

/**
 * localStorage key used to cache authentication metadata.
 *
 * The API base URL is incorporated into the key so that multi-instance
 * deployments pointing at different backends never share a stale cache.
 */
// HIGH-5: include API base URL in cache key so multi-instance deployments don't share caches
const AUTH_METADATA_CACHE_KEY = `qqqAuthMetadata:${process.env.NEXT_PUBLIC_API_BASE_URL ?? '/qqq/v1'}`

/**
 * Time-to-live for the cached authentication metadata in milliseconds (10 minutes).
 *
 * After this period the cache entry is considered stale and a fresh request is
 * made to `GET /metaData/authentication`.
 */
const AUTH_METADATA_TTL = 600000 // 10 minutes (down from 1 hour)

/**
 * Fetches authentication metadata from `GET /metaData/authentication`.
 *
 * Results are cached in `localStorage` for up to {@link AUTH_METADATA_TTL} ms so
 * that repeated calls within a session do not hit the network. The cache is
 * keyed per API base URL to avoid cross-instance collisions.
 *
 * @returns The authentication metadata describing the configured auth provider.
 */
export async function getAuthenticationMetaData(): Promise<QAuthenticationMetaData> {
  // Check localStorage cache (only in browser)
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(AUTH_METADATA_CACHE_KEY)
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached) as {
          data: QAuthenticationMetaData
          timestamp: number
        }
        if (Date.now() - timestamp < AUTH_METADATA_TTL) {
          return data
        }
      } catch {
        // Invalid cache, clear it
        localStorage.removeItem(AUTH_METADATA_CACHE_KEY)
      }
    }
  }

  const metadata = await apiClient.get<QAuthenticationMetaData>('/metaData/authentication')

  // Cache in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      AUTH_METADATA_CACHE_KEY,
      JSON.stringify({ data: metadata, timestamp: Date.now() })
    )
  }

  return metadata
}

/**
 * Removes the cached authentication metadata from `localStorage`.
 *
 * Should be called after a 401 response or on logout so that the next
 * call to {@link getAuthenticationMetaData} fetches fresh data from the server.
 */
export function clearAuthMetadataCache(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_METADATA_CACHE_KEY)
  }
}

/**
 * Shape of the response returned by `POST /manageSession`.
 */
export interface SessionResponse {
  /** Server-assigned session UUID, mirrored to the `sessionUUID` cookie. */
  uuid: string
  /** Session values for the frontend (e.g. `user: { name, email }`), when the backend sets any. */
  values?: Record<string, unknown>
}

/**
 * Creates a QQQ session from an access token via `POST /qqq/v1/manageSession`.
 *
 * The v1 endpoint reads a JSON body. For MOCK and FULLY_ANONYMOUS the token is a
 * placeholder; for AUTH_0 it is the provider access token (a JWT the backend verifies).
 * The backend sets the `sessionUUID` cookie; a 401 means the provider denied the login.
 *
 * @param accessToken - The provider access token, or a placeholder for anonymous types.
 * @returns The session UUID and its frontend values.
 */
export async function manageSession(accessToken: string): Promise<SessionResponse> {
  return apiClient.post<SessionResponse>('/manageSession', { accessToken })
}

/**
 * Encodes a username and password as HTTP Basic credentials (RFC 7617, UTF-8).
 *
 * @param username - The username; it may not contain a colon.
 * @param password - The password (colons allowed).
 * @returns The base64 `username:password` value for an `Authorization: Basic` header.
 */
export function encodeBasicCredentials(username: string, password: string): string {
  if (username.includes(':')) throw new Error('A username cannot contain a colon.')
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Signs in with a username and password (TABLE_BASED authentication) via
 * `POST /qqq/v1/manageSession` with an `Authorization: Basic` header. The backend
 * checks the password against its user table, stores a session row and sets the
 * `sessionUUID` cookie; a 401 means the credentials were refused.
 *
 * @param username - The username.
 * @param password - The password. It is sent once and never stored.
 * @returns The session UUID and its frontend values (the signed-in user).
 */
export async function createPasswordSession(username: string, password: string): Promise<SessionResponse> {
  return apiClient.post<SessionResponse>('/manageSession', {}, {
    headers: { Authorization: `Basic ${encodeBasicCredentials(username, password)}` },
  })
}

/**
 * Completes an OAuth2 authorization-code + PKCE login: the backend exchanges the
 * code with the identity provider (using its client secret) and creates a session.
 *
 * Uses the v1 `POST /manageSession`, which passes these values to the OAuth2 module
 * (QRun-IO/qqq#406).
 *
 * @param params - The authorization code, the PKCE verifier and the redirect URI used.
 * @returns The session UUID and its frontend values.
 */
export async function createOAuth2Session(params: { code: string; codeVerifier: string; redirectUri: string }): Promise<SessionResponse> {
  return apiClient.post<SessionResponse>('/manageSession', params)
}

/**
 * Resumes an existing OAuth2/Auth0 session from its `sessionUUID` cookie value, via the v1
 * `POST /manageSession`.
 *
 * @param sessionUUID - The session UUID the backend issued at sign-in.
 * @returns The session UUID and its frontend values; rejects with 401 when it is no longer valid.
 */
export async function resumeSession(sessionUUID: string): Promise<SessionResponse> {
  return apiClient.post<SessionResponse>('/manageSession', { sessionUUID })
}

/**
 * Reads the `sessionUUID` cookie set by the backend at sign-in.
 *
 * @returns The cookie value, or null.
 */
export function readSessionUUIDCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('sessionUUID='))
  const value = match ? decodeURIComponent(match.slice('sessionUUID='.length)) : ''
  return value || null
}

/**
 * Terminates the current server session via `POST /logout` and clears all
 * locally cached auth state.
 *
 * Clears the authentication metadata cache and removes any `accessToken`
 * stored in `localStorage`.
 */
export async function logout(): Promise<void> {
  await apiClient.post('/logout')
  clearAuthMetadataCache()
  // Also clear the access token from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken')
  }
}
