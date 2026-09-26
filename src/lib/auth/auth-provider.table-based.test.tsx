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

// Tests for AuthProvider with TABLE_BASED authentication (QRun-IO/qqq#700)

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'

vi.mock('@/lib/api/auth', () => ({
  getAuthenticationMetaData: vi.fn(async () => ({ name: 'tableBased', type: 'TABLE_BASED' })),
  manageSession: vi.fn(),
  createPasswordSession: vi.fn(),
  resumeSession: vi.fn(),
  readSessionUUIDCookie: vi.fn(() => null),
  logout: vi.fn(),
  clearAuthMetadataCache: vi.fn(),
}))

import { createPasswordSession, manageSession, readSessionUUIDCookie, resumeSession } from '@/lib/api/auth'
import { AuthProvider } from './auth-provider'
import { useAuth } from './use-auth'
import { storeUser, getStoredUser } from './auth-storage'

let auth: ReturnType<typeof useAuth> | null = null

/** Captures the auth context and shows the resolved state. */
function Probe() {
  auth = useAuth()
  if (auth.isLoading) return <p>loading</p>
  return <p>{auth.isAuthenticated ? `${auth.user?.name} <${auth.user?.email}>` : `signed out: ${auth.authError ?? 'no error'}`}</p>
}

/** A 401 from manageSession as axios reports it. */
function refused(message: string) {
  const response = { status: 401, statusText: 'Unauthorized', data: { error: message }, headers: {}, config: {} } as AxiosResponse
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', undefined, undefined, response)
}

describe('AuthProvider with TABLE_BASED authentication', () => {
  beforeEach(() => {
    vi.mocked(createPasswordSession).mockReset()
    vi.mocked(resumeSession).mockReset()
    vi.mocked(manageSession).mockReset()
    vi.mocked(readSessionUUIDCookie).mockReturnValue(null)
    auth = null
  })
  afterEach(() => localStorage.clear())

  it('without a session cookie waits for credentials and creates no session', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('signed out: no error')).toBeInTheDocument()
    expect(manageSession).not.toHaveBeenCalled()
    expect(resumeSession).not.toHaveBeenCalled()
    await act(async () => { await auth?.signIn('/app/person') })
    expect(manageSession).not.toHaveBeenCalled()
    expect(screen.getByText('signed out: no error')).toBeInTheDocument()
  })

  it('signs in with a username and password and shows the session user', async () => {
    vi.mocked(createPasswordSession).mockResolvedValue({ uuid: 's-1', values: { user: { name: 'Tess Table', username: 'tess.table' } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed out: no error')
    await act(async () => { await auth?.signInWithPassword('tess.table', 'table:pass-2026') })
    expect(createPasswordSession).toHaveBeenCalledWith('tess.table', 'table:pass-2026')
    expect(screen.getByText('Tess Table <tess.table>')).toBeInTheDocument()
    expect(getStoredUser()).toEqual({ name: 'Tess Table', email: 'tess.table' })
  })

  it('reports refused credentials and stays signed out', async () => {
    vi.mocked(createPasswordSession).mockRejectedValue(refused('Incorrect username or password.'))
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed out: no error')
    await act(async () => { await auth?.signInWithPassword('tess.table', 'wrong') })
    expect(screen.getByText('signed out: Sign-in was denied: Incorrect username or password.')).toBeInTheDocument()
  })

  it('resumes the session from its sessionUUID cookie after a reload', async () => {
    vi.mocked(readSessionUUIDCookie).mockReturnValue('s-2')
    vi.mocked(resumeSession).mockResolvedValue({ uuid: 's-2', values: { user: { name: 'Tess Table', username: 'tess.table' } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('Tess Table <tess.table>')).toBeInTheDocument()
    expect(resumeSession).toHaveBeenCalledWith('s-2')
  })

  it('an ended session (401 on resume) asks for credentials again', async () => {
    vi.mocked(readSessionUUIDCookie).mockReturnValue('s-3')
    vi.mocked(resumeSession).mockRejectedValue(refused('Session is expired.'))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('signed out: no error')).toBeInTheDocument()
  })

  it('a different user signing in drops the previous user\'s client data', async () => {
    storeUser({ name: 'Previous', email: 'previous.user' })
    localStorage.setItem('accessToken', 'stale')
    vi.mocked(createPasswordSession).mockResolvedValue({ uuid: 's-4', values: { user: { name: 'Tess Table', username: 'tess.table' } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed out: no error')
    await act(async () => { await auth?.signInWithPassword('tess.table', 'secret') })
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(getStoredUser()).toEqual({ name: 'Tess Table', email: 'tess.table' })
  })
})
