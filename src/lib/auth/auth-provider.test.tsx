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

// Tests for AuthProvider: mock/anonymous sessions identify their user (#371)

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// the UI API version check (a real request otherwise) is covered in ui-api-version.test.ts
vi.mock('@/lib/api/ui-api-version', () => ({ checkUiApiCompatibility: vi.fn(async () => ({ compatible: true, info: { apiVersion: '1.1.0', features: [], extensions: [], preSemver: false } })) }))
vi.mock('@/lib/api/auth', () => ({
  getAuthenticationMetaData: vi.fn(async () => ({ name: 'mock', type: 'MOCK' })),
  manageSession: vi.fn(),
  logout: vi.fn(),
  clearAuthMetadataCache: vi.fn(),
}))

import { manageSession } from '@/lib/api/auth'
import { checkUiApiCompatibility } from '@/lib/api/ui-api-version'
import { AuthProvider } from './auth-provider'
import { useAuth } from './use-auth'

/** Shows the resolved user. */
function Who() {
  const { user, isAuthenticated, authError } = useAuth()
  return <p>{isAuthenticated ? `${user?.name} <${user?.email}>` : authError ?? 'signed out'}</p>
}

describe('AuthProvider with mock authentication', () => {
  beforeEach(() => vi.mocked(manageSession).mockReset())

  it('uses the user the session identifies', async () => {
    vi.mocked(manageSession).mockResolvedValue({ uuid: 'u', values: { user: { name: 'Alice (sample)', email: 'sample:alice' } } })
    render(<AuthProvider><Who /></AuthProvider>)
    expect(await screen.findByText('Alice (sample) <sample:alice>')).toBeInTheDocument()
  })

  it('falls back to the anonymous user when the session names no user', async () => {
    vi.mocked(manageSession).mockResolvedValue({ uuid: 'u', values: {} })
    render(<AuthProvider><Who /></AuthProvider>)
    expect(await screen.findByText('Anonymous <anonymous@localhost>')).toBeInTheDocument()
  })

  it('stops with the version message when the server UI API is outside the supported range', async () => {
    vi.mocked(checkUiApiCompatibility).mockResolvedValueOnce({
      compatible: false,
      info: { apiVersion: '2.0.0', features: [], extensions: [], preSemver: false },
      message: 'The server runs UI API 2.0.0, which is newer than this app supports.',
    })
    render(<AuthProvider><Who /></AuthProvider>)
    expect(await screen.findByText('The server runs UI API 2.0.0, which is newer than this app supports.')).toBeInTheDocument()
    expect(manageSession).not.toHaveBeenCalled()
  })
})
