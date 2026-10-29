/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

vi.mock('@/lib/api/ui-api-version', () => ({ checkUiApiCompatibility: vi.fn(async () => ({ compatible: true, info: { apiVersion: '1.1.0', features: [], extensions: [], preSemver: false } })) }))
vi.mock('@/lib/api/auth', () => ({
  getAuthenticationMetaData: vi.fn(async () => ({ name: 'auth0', type: 'AUTH_0' })),
  manageSession: vi.fn(), resumeSession: vi.fn(), logout: vi.fn(), clearAuthMetadataCache: vi.fn(),
}))

import { manageSession, resumeSession } from '@/lib/api/auth'
import { AuthProvider } from './auth-provider'
import { useAuth } from './use-auth'
import { getStoredUser, setSessionHint, storeUser } from './auth-storage'
import * as oidc from './oidc'

let auth: ReturnType<typeof useAuth> | null = null

/** Exposes the real provider state for callback and reload assertions. */
function Probe() {
  auth = useAuth()
  if (auth.isLoading) return <p>loading</p>
  return <p>{auth.isAuthenticated ? `${auth.user?.name} <${auth.user?.email}>` : 'signed out'}</p>
}

describe('Auth0 identity with a server-issued user ID', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.mocked(manageSession).mockReset()
    vi.mocked(resumeSession).mockReset()
    auth = null
  })
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('keeps the provider display identity and server ID after sign-in', async () => {
    const payload = btoa(JSON.stringify({ name: 'Dana Owner (OIDC)', email: 'dana@qrun.example' }))
    vi.spyOn(oidc, 'exchangeAuth0Code').mockResolvedValue({ access_token: 'test-access', id_token: `h.${payload}.s` })
    vi.mocked(manageSession).mockResolvedValue({ uuid: 'session', values: { user: { id: 'oidc|dana' } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed out')
    sessionStorage.setItem(oidc.PKCE_STORAGE.state, 'expected-state')
    await act(async () => { await auth?.handleOAuthCallback('code', 'expected-state', 'verifier') })
    expect(screen.getByText('Dana Owner (OIDC) <dana@qrun.example>')).toBeInTheDocument()
    expect(getStoredUser()).toEqual({ id: 'oidc|dana', name: 'Dana Owner (OIDC)', email: 'dana@qrun.example' })
  })

  it('retains the display identity on reload when the server supplies the same ID', async () => {
    storeUser({ id: 'oidc|dana', name: 'Dana Owner (OIDC)', email: 'dana@qrun.example' })
    setSessionHint(true)
    vi.mocked(resumeSession).mockResolvedValue({ uuid: 'session', values: { user: { id: 'oidc|dana' } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('Dana Owner (OIDC) <dana@qrun.example>')).toBeInTheDocument()
  })

  it('prefers server display fields and does not reuse a different user profile', async () => {
    storeUser({ id: 'oidc|dana', name: 'Dana Owner (OIDC)', email: 'dana@qrun.example' })
    setSessionHint(true)
    vi.mocked(resumeSession).mockResolvedValue({ uuid: 'session', values: { user: { id: 'oidc|eli', name: 'Eli' } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('Eli <undefined>')).toBeInTheDocument()
    expect(auth?.user).toEqual({ id: 'oidc|eli', name: 'Eli', email: undefined })
  })

  it('does not reuse a cached profile when an ID-only session changes user', async () => {
    storeUser({ id: 'oidc|dana', name: 'Dana Owner (OIDC)', email: 'dana@qrun.example' })
    setSessionHint(true)
    vi.mocked(resumeSession).mockResolvedValue({ uuid: 'session', values: { user: { id: 'oidc|eli' } } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('undefined <undefined>')
    expect(auth?.user?.id).toBe('oidc|eli')
  })
})
