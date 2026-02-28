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
   * @param code         - The authorization code returned by the identity provider.
   * @param state        - The state nonce returned by the identity provider (validated against sessionStorage).
   * @param codeVerifier - Optional PKCE code_verifier retrieved from sessionStorage by the
   *   callback page. When provided it is forwarded to the backend so it can complete the
   *   authorization-code → token exchange with the IdP.
   */
  handleOAuthCallback: (code: string, state: string, codeVerifier?: string) => Promise<void>
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
   * Validates an existing Auth0 backend session on provider mount.
   *
   * This function is called by the `initAuth` effect when the auth type is
   * `AUTH_0`.  It does NOT initiate the Auth0 PKCE login flow — that is driven
   * entirely by the login page (`/login`) which builds the authorization URL,
   * generates PKCE credentials, and redirects the browser to the Auth0
   * `/authorize` endpoint.
   *
   * Here we only confirm that a live backend session cookie already exists by
   * calling `manageSession('')`.  If the backend returns 401 (no session),
   * `manageSession` throws, `isAuthenticated` stays `false`, and the
   * middleware or `setupAuth0Session`'s caller redirects to the login page —
   * which then starts the PKCE redirect sequence.
   *
   * Session lifecycle:
   *   1. Login page → PKCE redirect → Auth0 `/authorize`
   *   2. Auth0 → `/auth/callback?code=...&state=...`
   *   3. Callback page → `handleOAuthCallback(code, state, verifier)`
   *   4. `handleOAuthCallback` → `manageSession(code, verifier)` → session cookie
   *   5. On next mount `setupAuth0Session` → `manageSession('')` → confirms session
   *
   * @param authMeta - Auth metadata from the backend (used for type narrowing only).
   */
  async function setupAuth0Session(authMeta: QAuthenticationMetaData): Promise<AuthUser> {
    void authMeta // PKCE flow is page-driven; this function only validates the session
    await manageSession('') // throws 401 when no live session exists
    const storedUser = getStoredUser()
    return storedUser ?? { name: 'User', email: 'user@example.com' }
  }

  /**
   * Validates an existing OAuth2/OIDC backend session on provider mount.
   *
   * Mirrors `setupAuth0Session` for the `OAUTH2` auth type.  The PKCE login
   * flow (code_verifier generation, authorization URL construction, IdP redirect)
   * is handled by the login page.  This function only checks that a valid
   * backend session cookie is already present.
   *
   * Session lifecycle:
   *   1. Login page → PKCE redirect → IdP `/authorize`
   *   2. IdP → `/auth/callback?code=...&state=...`
   *   3. Callback page → `handleOAuthCallback(code, state, verifier)`
   *   4. `handleOAuthCallback` → `manageSession(code, verifier)` → session cookie
   *   5. On next mount `setupOAuth2Session` → `manageSession('')` → confirms session
   *
   * @param authMeta - Auth metadata from the backend (used for type narrowing only).
   */
  async function setupOAuth2Session(authMeta: QAuthenticationMetaData): Promise<AuthUser> {
    void authMeta // PKCE flow is page-driven; this function only validates the session
    await manageSession('') // throws 401 when no live session exists
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
   * @param code         - The authorization code returned by the identity provider.
   * @param state        - The state nonce returned by the identity provider.
   * @param codeVerifier - Optional PKCE code_verifier forwarded to the backend so it
   *   can complete the authorization-code → token exchange. The callback page retrieves
   *   this from `sessionStorage` (key: `'pkce_code_verifier'`) before calling this fn.
   */
  async function handleOAuthCallback(code: string, state: string, codeVerifier?: string) {
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
    // Pass the PKCE verifier so the backend can complete the token exchange.
    await manageSession(code, codeVerifier)
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
