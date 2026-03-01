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
  /** Arbitrary key-value pairs associated with the session (user name, roles, etc.). */
  values: Record<string, unknown>
}

/**
 * Establishes or refreshes a QQQ server session by posting the caller's
 * authorization code (or access token) to `POST /manageSession` as
 * multipart/form-data.
 *
 * In the PKCE flow the `accessToken` field carries the authorization code
 * returned by the IdP. The `codeVerifier` (when supplied) allows the backend
 * to complete the PKCE token exchange with the IdP on behalf of the client.
 *
 * On success the server sets a `sessionUUID` cookie that is included
 * automatically in all subsequent requests via `withCredentials: true`.
 *
 * @param accessToken  - Either an OIDC authorization code (backend completes
 *   the code exchange with the IdP) or a pre-obtained access token (client
 *   obtained it directly from the IdP). The distinction matters for whether
 *   `codeVerifier` must also be supplied.
 * @param codeVerifier - Required only for the PKCE flow when `accessToken`
 *   is an authorization code and the backend must complete the
 *   authorization-code → token exchange on behalf of the client. Omit for
 *   implicit flows, client-credentials flows, or any flow where the client
 *   already holds a fully-resolved access token.
 * @returns Session metadata including the server-assigned UUID.
 */
export async function manageSession(
  accessToken: string,
  codeVerifier?: string
): Promise<SessionResponse> {
  const formData = new FormData()
  formData.append('accessToken', accessToken)

  // Include the PKCE verifier when provided so the backend can complete the
  // authorization-code exchange with the identity provider.
  if (codeVerifier) {
    formData.append('codeVerifier', codeVerifier)
  }

  return apiClient.post<SessionResponse>('/manageSession', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
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
