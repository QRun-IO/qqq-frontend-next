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

/** AuthProvider — manages authentication state for AUTH_0, OAUTH2, FULLY_ANONYMOUS, and MOCK auth types */
'use client'

// Auth provider — manages authentication state across all auth types
// Supports AUTH_0, OAUTH2, FULLY_ANONYMOUS, and MOCK

import React, { createContext, type ReactNode, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

import type { QAuthenticationMetaData } from '@/types'
import {
  getAuthenticationMetaData,
  manageSession,
  logout as apiLogout,
  clearAuthMetadataCache,
} from '@/lib/api/auth'
import apiClient from '@/lib/api/client'

/**
 * Represents the currently authenticated user's basic identity.
 */
export interface AuthUser {
  /** Display name of the user. */
  name?: string
  /** Email address of the user. */
  email?: string
  /** Unique identifier for the user. */
  id?: string
}

/**
 * Shape of the value provided by {@link AuthContext}.
 *
 * Consumers should access this via the {@link useAuth} hook rather than
 * reading the context directly.
 */
export interface AuthContextType {
  /** Whether the current user has an active, validated session. */
  isAuthenticated: boolean
  /** Whether the initial auth-check is still in-flight. */
  isLoading: boolean
  /** The authenticated user, or `null` while unauthenticated. */
  user: AuthUser | null
  /** Raw authentication metadata returned by the backend. */
  authMetadata: QAuthenticationMetaData | null
  /** Logs the user out, clears local state, and redirects to the login page. */
  logout: () => Promise<void>
  /**
   * Handles the OAuth2/PKCE redirect callback.
   *
   * @param code - The authorization code returned by the identity provider.
   * @param state - The state nonce returned by the identity provider (validated against sessionStorage).
   */
  handleOAuthCallback: (code: string, state: string) => Promise<void>
}

/**
 * React context that holds the current authentication state.
 *
 * Prefer using the {@link useAuth} hook to consume this context.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Props for the {@link AuthProvider} component.
 */
export interface AuthProviderProps {
  /** Child elements that will receive access to the auth context. */
  children: ReactNode
  /**
   * Optional callback invoked when the initial auth setup fails.
   *
   * @param error - The error that caused the auth setup to fail.
   */
  onAuthError?: (error: Error) => void
}

/**
 * Top-level authentication provider.
 *
 * On mount it fetches backend authentication metadata, determines the auth type
 * (AUTH_0, OAUTH2, FULLY_ANONYMOUS, or MOCK), and initializes the appropriate
 * session. It also wires up the global 401 interceptor so that expired sessions
 * automatically redirect to the login page.
 *
 * @param children - Application subtree that needs auth context.
 * @param onAuthError - Optional error handler called when auth initialization fails.
 */
export function AuthProvider({ children, onAuthError }: AuthProviderProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authMetadata, setAuthMetadata] = useState<QAuthenticationMetaData | null>(null)

  /**
   * Logs the current user out.
   *
   * Calls the backend logout endpoint, clears all local auth state and the auth
   * metadata cache, then redirects to `/login` with a `returnTo` query parameter
   * so the user is sent back to their previous page after re-authenticating.
   */
  const handleLogout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // Ignore logout errors — still clear local state
    } finally {
      setIsAuthenticated(false)
      setUser(null)
      clearAuthMetadataCache()

      // Preserve the return URL so user comes back after login
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
      router.push(`/login?returnTo=${returnTo}`)
    }
  }, [router])

  // Set up global 401 callback
  useEffect(() => {
    apiClient.setUnauthorizedCallback(() => {
      setIsAuthenticated(false)
      setUser(null)
      clearAuthMetadataCache() // CRIT-6: clear stale auth cache on session expiry
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
      router.push(`/login?returnTo=${returnTo}`)
    })
  }, [router])

  useEffect(() => {
    let cancelled = false

    async function initAuth() {
      try {
        const metadata = await getAuthenticationMetaData()

        if (cancelled) return
        setAuthMetadata(metadata)

        let resolvedUser: AuthUser
        switch (metadata.type) {
          case 'AUTH_0':
            resolvedUser = await setupAuth0Session(metadata)
            break
          case 'OAUTH2':
            resolvedUser = await setupOAuth2Session(metadata)
            break
          case 'FULLY_ANONYMOUS':
          case 'MOCK':
            resolvedUser = await setupAnonymousSession()
            break
          default:
            throw new Error(`Unrecognized auth type: ${(metadata as QAuthenticationMetaData).type}`)
        }

        if (!cancelled) {
          setIsAuthenticated(true)
          setUser(resolvedUser)
        }
      } catch (error) {
        if (cancelled) return

        if (onAuthError && error instanceof Error) {
          onAuthError(error)
        }
        console.error('[Auth] Setup failed:', error)
        setIsAuthenticated(false)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void initAuth()

    return () => {
      cancelled = true
    }
  // intentional: only re-run if onAuthError changes; auth init is not repeatable
  // (re-running on every render would cause infinite auth loops)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAuthError])

  /**
   * Initializes an Auth0 session.
   *
   * Validates the existing backend session cookie by calling `manageSession`.
   * The full Auth0 PKCE login flow is handled by the login page; this function
   * only confirms that a live session already exists.
   *
   * @param authMeta - Authentication metadata from the backend (unused directly — Auth0 PKCE is page-driven).
   */
  async function setupAuth0Session(authMeta: QAuthenticationMetaData): Promise<AuthUser> {
    // Auth0 flow: validate the existing session cookie against the backend.
    // Call manageSession with an empty token; the backend will return 401 if no
    // valid session cookie exists, which rejects this promise and leaves
    // isAuthenticated=false, triggering a redirect to login.
    void authMeta // full Auth0 PKCE flow handled by the login page
    await manageSession('') // throws on 401 — intentional: proves live session
    const storedUser = getStoredUser()
    return storedUser ?? { name: 'User', email: 'user@example.com' }
  }

  /**
   * Initializes an OAuth2/OIDC session.
   *
   * Validates the existing backend session cookie by calling `manageSession`.
   * The full OAuth2 PKCE login flow is handled by the login page; this function
   * only confirms that a live session already exists.
   *
   * @param authMeta - Authentication metadata from the backend (unused directly — OAuth2 PKCE is page-driven).
   */
  async function setupOAuth2Session(authMeta: QAuthenticationMetaData): Promise<AuthUser> {
    // OAuth2/OIDC flow: validate the existing session cookie against the backend.
    // Same approach as Auth0: call manageSession so the backend can reject stale
    // or missing sessions with 401 before we mark the user as authenticated.
    void authMeta // full OAuth2/PKCE flow handled by the login page
    await manageSession('') // throws on 401 — intentional: proves live session
    const storedUser = getStoredUser()
    return storedUser ?? { name: 'User', email: 'user@example.com' }
  }

  /**
   * Initializes a fully-anonymous or mock session.
   *
   * Calls `manageSession` with the literal string `'anonymous'` to obtain a
   * backend session cookie. Errors are swallowed because some anonymous
   * configurations do not require a token exchange.
   */
  async function setupAnonymousSession(): Promise<AuthUser> {
    // Anonymous auth: call manageSession with empty token to get a session cookie
    try {
      await manageSession('anonymous')
    } catch {
      // Anonymous may not need a token exchange
    }
    return { name: 'Anonymous', email: 'anonymous@localhost' }
  }

  /**
   * Reads and validates a previously-stored user object from `localStorage`.
   *
   * Performs basic shape validation before trusting the stored value to guard
   * against tampered or corrupt localStorage data.
   *
   * @returns The stored {@link AuthUser} if valid, or `null` if absent or invalid.
   */
  function getStoredUser(): AuthUser | null {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem('qqqUser')
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        // MED-10: basic shape validation before trusting localStorage data
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          'name' in parsed &&
          typeof (parsed as Record<string, unknown>).name === 'string'
        ) {
          return parsed as AuthUser
        }
      }
    } catch {
      // Ignore parse errors
    }
    return null
  }

  /**
   * Completes the OAuth2/PKCE authorization-code flow after the IdP redirect.
   *
   * Validates the `state` parameter against the nonce stored in `sessionStorage`
   * to prevent CSRF attacks, then exchanges the authorization code for a backend
   * session via `manageSession`. Throws if the state is invalid or the exchange
   * fails, leaving `isAuthenticated` as `false`.
   *
   * @param code - The authorization code returned by the identity provider.
   * @param state - The state nonce returned by the identity provider.
   */
  async function handleOAuthCallback(code: string, state: string) {
    // OAuth2/PKCE callback: validate state nonce, then exchange the authorization
    // code for a backend session via manageSession.
    const storedState = sessionStorage.getItem('oauth_state')
    if (!storedState || storedState !== state) {
      throw new Error('[Auth] OAuth state mismatch — possible CSRF attack')
    }
    sessionStorage.removeItem('oauth_state')

    // Exchange the authorization code for a QQQ session.
    // The backend (via manageSession) validates the code with the IdP and
    // issues a session cookie. Throws on failure — isAuthenticated stays false.
    await manageSession(code)
    const storedUser = getStoredUser()
    setIsAuthenticated(true)
    setUser(storedUser ?? { name: 'User', email: 'user@example.com' })
    setIsLoading(false)
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        authMetadata,
        logout: handleLogout,
        handleOAuthCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
