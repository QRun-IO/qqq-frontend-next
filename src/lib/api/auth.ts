// Authentication API functions

import type { QAuthenticationMetaData } from '@/types'
import apiClient from './client'

const AUTH_METADATA_CACHE_KEY = 'qqqAuthMetadata'
const AUTH_METADATA_TTL = 3600000 // 1 hour in ms

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

export function clearAuthMetadataCache(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_METADATA_CACHE_KEY)
  }
}

export interface SessionResponse {
  uuid: string
  values: Record<string, unknown>
}

export async function manageSession(accessToken: string): Promise<SessionResponse> {
  const formData = new FormData()
  formData.append('accessToken', accessToken)

  return apiClient.post<SessionResponse>('/manageSession', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function logout(): Promise<void> {
  await apiClient.post('/logout')
  clearAuthMetadataCache()
  // Also clear the access token from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken')
  }
}
