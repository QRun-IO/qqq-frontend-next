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
  logout: vi.fn(),
  clearAuthMetadataCache: vi.fn(),
}))

import { createPasswordSession, getAuthenticationMetaData, logout, manageSession, resumeSession } from '@/lib/api/auth'
import { AuthProvider } from './auth-provider'
import { useAuth } from './use-auth'
import * as oidc from './oidc'
import { storeUser, getStoredUser, hasSessionHint, setSessionHint } from './auth-storage'

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
    vi.mocked(logout).mockReset()
    auth = null
  })
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('without an earlier sign-in waits for credentials and sends no session request', async () => {
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
    expect(hasSessionHint()).toBe(true)
  })

  it('never reads or writes the session cookies, which are HttpOnly (QRun-IO/qqq#733)', async () => {
    const read = vi.spyOn(Document.prototype, 'cookie', 'get')
    const write = vi.spyOn(Document.prototype, 'cookie', 'set')
    vi.mocked(createPasswordSession).mockResolvedValue({ uuid: 's-1', values: { user: { name: 'Tess Table', username: 'tess.table' } } })
    vi.mocked(logout).mockResolvedValue(undefined)
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed out: no error')
    await act(async () => { await auth?.signInWithPassword('tess.table', 'table:pass-2026') })
    expect(screen.getByText('Tess Table <tess.table>')).toBeInTheDocument()
    await act(async () => { await auth?.logout() })
    expect(logout).toHaveBeenCalled()
    expect(hasSessionHint()).toBe(false)
    expect(read).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    read.mockRestore()
    write.mockRestore()
  })

  it.each([false, true])('keeps authentication loading until logout settles (failure: %s)', async (fails) => {
    let finishLogout!: () => void
    vi.mocked(logout).mockReturnValue(new Promise<void>((resolve, reject) => {
      finishLogout = () => fails ? reject(new Error('Logout unavailable')) : resolve()
    }))
    vi.mocked(createPasswordSession).mockResolvedValue({ values: { user: { name: 'Tess Table', username: 'tess.table' } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed out: no error')
    await act(async () => { await auth?.signInWithPassword('tess.table', 'table:pass-2026') })
    let pendingLogout: Promise<void> | undefined
    await act(async () => { pendingLogout = auth?.logout() })
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(auth?.isAuthenticated).toBe(false)
    expect(auth?.user).toBeNull()
    await act(async () => { finishLogout(); await pendingLogout })
    expect(screen.getByText('signed out: no error')).toBeInTheDocument()
    expect(auth?.isLoading).toBe(false)
  })

  it('leaves loading when provider logout falls back to the local login page', async () => {
    vi.mocked(getAuthenticationMetaData).mockResolvedValueOnce({ name: 'oauth', type: 'OAUTH2' })
    vi.mocked(resumeSession).mockResolvedValue({ values: { user: { name: 'Tess Table', username: 'tess.table' } } })
    vi.mocked(logout).mockResolvedValue(undefined)
    setSessionHint(true)
    const endSession = vi.spyOn(oidc, 'buildEndSessionUrl').mockRejectedValue(new Error('Provider unavailable'))
    try {
      render(<AuthProvider><Probe /></AuthProvider>)
      await screen.findByText('Tess Table <tess.table>')
      await act(async () => { await auth?.logout() })
      expect(endSession).toHaveBeenCalled()
      expect(screen.getByText('signed out: no error')).toBeInTheDocument()
      expect(auth?.isLoading).toBe(false)
    } finally {
      endSession.mockRestore()
    }
  })

  it('keeps loading after provider logout starts an external navigation', async () => {
    vi.mocked(getAuthenticationMetaData).mockResolvedValueOnce({ name: 'oauth', type: 'OAUTH2' })
    vi.mocked(resumeSession).mockResolvedValue({ values: { user: { name: 'Tess Table', username: 'tess.table' } } })
    vi.mocked(logout).mockResolvedValue(undefined)
    setSessionHint(true)
    const endSession = vi.spyOn(oidc, 'buildEndSessionUrl').mockResolvedValue('https://idp.example/logout')
    try {
      render(<AuthProvider><Probe /></AuthProvider>)
      await screen.findByText('Tess Table <tess.table>')
      // jsdom leaves the document in place when location.assign starts navigation.
      await act(async () => { await auth?.logout() })
      expect(endSession).toHaveBeenCalled()
      expect(screen.getByText('loading')).toBeInTheDocument()
      expect(auth?.isLoading).toBe(true)
    } finally {
      endSession.mockRestore()
    }
  })

  it('reports refused credentials and stays signed out', async () => {
    vi.mocked(createPasswordSession).mockRejectedValue(refused('Incorrect username or password.'))
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed out: no error')
    await act(async () => { await auth?.signInWithPassword('tess.table', 'wrong') })
    expect(screen.getByText('signed out: Sign-in was denied: Incorrect username or password.')).toBeInTheDocument()
  })

  it('after a sign-in, a reload resumes the session the backend reads from its cookie', async () => {
    setSessionHint(true)
    vi.mocked(resumeSession).mockResolvedValue({ values: { user: { name: 'Tess Table', username: 'tess.table' } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('Tess Table <tess.table>')).toBeInTheDocument()
    expect(resumeSession).toHaveBeenCalledWith()
  })

  it('an ended session (401 on resume) asks for credentials again and stops resuming', async () => {
    setSessionHint(true)
    vi.mocked(resumeSession).mockRejectedValue(refused('Session is expired.'))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('signed out: no error')).toBeInTheDocument()
    expect(hasSessionHint()).toBe(false)
    await act(async () => { await auth?.signIn('/app/person') })
    expect(resumeSession).toHaveBeenCalledTimes(1)
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
