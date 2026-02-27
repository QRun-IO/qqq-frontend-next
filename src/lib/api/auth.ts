/** Auth API — Session management and authentication metadata endpoints. */

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
 * Establishes or refreshes a QQQ server session by posting the caller's access token
 * to `POST /manageSession` as multipart/form-data.
 *
 * On success the server sets a `sessionUUID` cookie that is included automatically
 * in all subsequent requests via `withCredentials: true`.
 *
 * @param accessToken - A valid OAuth / Auth0 access token issued to the current user.
 * @returns Session metadata including the server-assigned UUID.
 */
export async function manageSession(accessToken: string): Promise<SessionResponse> {
  const formData = new FormData()
  formData.append('accessToken', accessToken)

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
