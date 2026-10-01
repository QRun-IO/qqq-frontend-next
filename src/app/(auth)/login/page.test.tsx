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

// Tests for the login page: TABLE_BASED password sign-in (QRun-IO/qqq#700) and
// pre-sign-in branding (QRun-IO/qqq#703)

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'

import type { AuthContextType } from '@/lib/auth/auth-provider'
import type { QAuthenticationMetaData } from '@/types'

const authState: { value: AuthContextType } = { value: {} as AuthContextType }
vi.mock('@/lib/auth/use-auth', () => ({ useAuth: () => authState.value }))

import LoginPage from './page'

const BRANDING = { appName: 'QQQ Sample', logo: '/samples-logo.png', icon: '/kr-icon.png', accentColor: '#1d4ed8' }

/**
 * Sets the auth context the page sees.
 *
 * @param metadata - Authentication metadata.
 * @param overrides - Other context values.
 */
function withAuth(metadata: QAuthenticationMetaData | null, overrides: Partial<AuthContextType> = {}) {
  authState.value = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    authMetadata: metadata,
    authError: null,
    isSignedOut: false,
    signIn: vi.fn(async () => {}),
    signInWithPassword: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    handleOAuthCallback: vi.fn(async () => {}),
    ...overrides,
  }
}

const tableBased: QAuthenticationMetaData = { name: 'tableBased', type: 'TABLE_BASED', branding: BRANDING }

describe('LoginPage', () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico">'
  })
  afterEach(() => {
    document.documentElement.removeAttribute('style')
    document.title = ''
  })

  it('asks for a username and password under the application branding, without signing in automatically', async () => {
    withAuth(tableBased)
    render(<LoginPage />)
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(document.querySelector('[data-qqq-id="login-logo"]')).toHaveAttribute('src', '/samples-logo.png')
    expect(screen.getByText('QQQ Sample')).toHaveAttribute('data-qqq-id', 'login-app-name')
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#1d4ed8'))
    expect(document.querySelector<HTMLLinkElement>("link[rel='icon']")?.getAttribute('href')).toBe('/kr-icon.png')
    expect(document.title).toBe('Sign in | QQQ Sample')
    expect(authState.value.signIn).not.toHaveBeenCalled()
  })

  it('names the missing fields and sends nothing', () => {
    withAuth(tableBased)
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter your username.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Enter your username.')
    expect(screen.getByLabelText('Username')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'a:b' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('A username cannot contain a colon.')).toBeInTheDocument()
    expect(authState.value.signInWithPassword).not.toHaveBeenCalled()
  })

  it('signs in with the typed credentials and clears the password afterwards', async () => {
    withAuth(tableBased)
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '  tess.table ' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'table:pass-2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(authState.value.signInWithPassword).toHaveBeenCalledWith('tess.table', 'table:pass-2026'))
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveValue(''))
    expect(screen.getByLabelText('Username')).toHaveValue('  tess.table ')
  })

  it('shows a refused sign-in in the form and after logout says so', () => {
    withAuth(tableBased, { authError: 'Sign-in was denied: Incorrect username or password.' })
    const { unmount } = render(<LoginPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in was denied: Incorrect username or password.')
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    unmount()
    withAuth(tableBased, { isSignedOut: true })
    render(<LoginPage />)
    expect(screen.getByRole('heading', { name: 'You have signed out' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    withAuth(tableBased)
    const { container } = render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await axe(container)).toHaveNoViolations()
  })

  it('brands the other sign-in states too and drops an unsafe logo', () => {
    withAuth({ name: 'mock', type: 'MOCK', branding: { appName: 'QQQ Sample', logo: 'javascript:alert(1)' } }, { isSignedOut: true })
    render(<LoginPage />)
    expect(screen.getByRole('heading', { name: 'You have signed out' })).toBeInTheDocument()
    expect(screen.getByText('QQQ Sample')).toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="login-logo"]')).toBeNull()
  })

  it('renders without branding when the backend declares none', () => {
    withAuth({ name: 'mock', type: 'MOCK' }, { isSignedOut: true })
    render(<LoginPage />)
    expect(document.querySelector('[data-qqq-id="login-branding"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
