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
 * @file AuthProvider — manages authentication state for AUTH_0, OAUTH2, FULLY_ANONYMOUS, and MOCK auth types.
 */
'use client'

// Session lifecycle by auth type:
//   MOCK / FULLY_ANONYMOUS — `POST /qqq/v1/manageSession` creates the session; its
//     `values.user` is the displayed identity. A denied session (401) is an error,
//     never a silent anonymous fallback.
//   OAUTH2 — the login page redirects to the identity provider (PKCE); the /token
//     callback posts code + verifier to the backend, which exchanges them using its
//     client secret. Reloads resume the session from the `sessionUUID` cookie.
//   AUTH_0 — same redirect; the callback exchanges the code with Auth0 as a public
//     client and posts the access token to the backend.
// Explicit logout ends the backend session, clears per-user client data, and keeps
// the tab signed out until the user signs in again. A 401 from any other call means
// the session expired: the user is sent to /login?returnTo=<page>, which signs in
// again automatically where the auth type allows it.

import React, { createContext, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { QAuthenticationMetaData } from '@/types'
import {
  clearAuthMetadataCache,
  createOAuth2Session,
  getAuthenticationMetaData,
  logout as apiLogout,
  manageSession,
  readSessionUUIDCookie,
  resumeSession,
  type SessionResponse,
} from '@/lib/api/auth'
import apiClient from '@/lib/api/client'
import { queryClient } from '@/lib/query-client'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import {
  clearUserClientData,
  getStoredUser,
  isSignedOut as readSignedOut,
  resetReauthAttempts,
  setSignedOut,
  storeUser,
  userFromSessionValues,
} from './auth-storage'
import {
  buildEndSessionUrl,
  exchangeAuth0Code,
  identityFromIdToken,
  PKCE_STORAGE,
  redirectUri,
  startAuthorizationRedirect,
} from './oidc'
import { currentReturnTo } from './return-to'

/**
 * Represents the currently authenticated user's basic identity.
 */
export interface AuthUser {
  /** Display name of the user. */
  name?: string
  /** Email address (or identity reference) of the user. */
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
  /** Whether an auth check or sign-in is in flight. */
  isLoading: boolean
  /** The authenticated user, or `null` while unauthenticated. */
  user: AuthUser | null
  /** Raw authentication metadata returned by the backend. */
  authMetadata: QAuthenticationMetaData | null
  /** Why the last sign-in failed (shown by the login page), or null. */
  authError: string | null
  /** True after an explicit logout, until the user signs in again. */
  isSignedOut: boolean
  /**
   * Signs in: creates the session for anonymous types, or redirects to the
   * identity provider for OAUTH2 / AUTH_0.
   *
   * @param returnTo - Validated in-app path to return to afterwards.
   */
  signIn: (returnTo: string) => Promise<void>
  /** Logs the user out, clears local state, and redirects to the login page. */
  logout: () => Promise<void>
  /**
   * Handles the OAuth2/PKCE redirect callback.
   *
   * @param code         - The authorization code returned by the identity provider.
   * @param state        - The state nonce returned by the identity provider (validated against sessionStorage).
   * @param codeVerifier - The PKCE code_verifier stored before the redirect.
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

const ANONYMOUS_TYPES = new Set(['MOCK', 'FULLY_ANONYMOUS'])

/** Expires the backend session cookies (`sessionUUID`, `sessionId`) on the root path. */
function expireSessionCookies() {
  for (const name of ['sessionUUID', 'sessionId']) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
  }
}

/**
 * A readable message for a failed sign-in.
 *
 * @param error - The error thrown by a session call.
 * @returns The message shown on the login page.
 */
function signInErrorMessage(error: unknown): string {
  const status = getErrorStatusCode(error)
  const body = (error as { response?: { data?: { error?: unknown } } })?.response?.data
  const detail = typeof body?.error === 'string' && body.error ? body.error : error instanceof Error ? error.message : ''
  if (status === 401 || status === 403) return `Sign-in was denied${detail ? `: ${detail}` : '.'}`
  return `Sign-in failed${detail ? `: ${detail}` : '.'}`
}

/**
 * The identity to display for a session.
 *
 * @param response - The manageSession response.
 * @param fallback - Identity to use when the session carries none.
 * @returns The user.
 */
function sessionUser(response: SessionResponse, fallback: AuthUser | null): AuthUser {
  return userFromSessionValues(response.values) ?? fallback ?? {}
}

/**
 * Top-level authentication provider.
 *
 * On mount it fetches backend authentication metadata and establishes or resumes
 * the session for the configured auth type. It also wires up the global 401
 * interceptor so that expired sessions redirect to the login page.
 *
 * @param props - Component props.
 * @param props.children - Application subtree that needs auth context.
 * @param props.onAuthError - Optional error handler called when auth initialization fails.
 * @returns The rendered auth context provider wrapping the component tree.
 */
export function AuthProvider({ children, onAuthError }: AuthProviderProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authMetadata, setAuthMetadata] = useState<QAuthenticationMetaData | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [signedOut, setSignedOutState] = useState(false)
  const redirectingToLogin = useRef(false)

  /**
   * Resolves the authentication metadata (cached for a few minutes).
   *
   * @returns The metadata.
   */
  const loadMetadata = useCallback(async () => {
    const metadata = await getAuthenticationMetaData()
    setAuthMetadata(metadata)
    return metadata
  }, [])

  /**
   * Creates (anonymous types) or resumes (OAUTH2 / AUTH_0) a session.
   *
   * @param metadata - Authentication metadata.
   * @returns The user when a session exists, or null when the user must sign in.
   */
  const establishSession = useCallback(async (metadata: QAuthenticationMetaData): Promise<AuthUser | null> => {
    if (ANONYMOUS_TYPES.has(metadata.type)) {
      return sessionUser(await manageSession('anonymous'), { name: 'Anonymous', email: 'anonymous@localhost' })
    }
    if (metadata.type === 'OAUTH2' || metadata.type === 'AUTH_0') {
      const sessionUUID = readSessionUUIDCookie()
      if (!sessionUUID) return null
      try {
        const resumed = sessionUser(await resumeSession(sessionUUID), getStoredUser())
        storeUser(resumed)
        return resumed
      } catch (error) {
        if (getErrorStatusCode(error) === 401) return null
        throw error
      }
    }
    throw new Error(`Unsupported authentication type: ${String(metadata.type)}`)
  }, [])

  /**
   * Applies the outcome of a session attempt to the provider state.
   *
   * @param result - The user (signed in) or null (not signed in).
   */
  const applySession = useCallback((result: AuthUser | null) => {
    setUser(result)
    setIsAuthenticated(result !== null)
    if (result) {
      redirectingToLogin.current = false
      setAuthError(null)
    }
  }, [])

  // Global 401 callback: the session expired — drop it and go to login with returnTo.
  useEffect(() => {
    apiClient.setUnauthorizedCallback(() => {
      setIsAuthenticated(false)
      setUser(null)
      clearAuthMetadataCache()
      // Drop cached data once protected pages have unmounted, so nothing refetches with the dead session.
      setTimeout(() => queryClient.clear(), 0)
      if (redirectingToLogin.current || /^\/login(\/|$)/.test(window.location.pathname)) return
      redirectingToLogin.current = true
      router.push(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`)
    })
  }, [router])

  useEffect(() => {
    let cancelled = false

    /**
     * Fetches auth metadata and initialises the session on mount.
     *
     * @returns A promise that resolves when auth initialisation is complete.
     */
    async function initAuth() {
      try {
        const metadata = await loadMetadata()
        if (cancelled) return
        // The provider callback (/token, /callback) establishes the session itself.
        if (/^\/(token|callback)(\/|$)/.test(window.location.pathname)) return
        if (readSignedOut()) {
          setSignedOutState(true)
          applySession(null)
          return
        }
        const result = await establishSession(metadata)
        if (!cancelled) applySession(result)
      } catch (error) {
        if (cancelled) return
        if (onAuthError && error instanceof Error) onAuthError(error)
        console.warn('[Auth] Setup failed:', error instanceof Error ? error.message : error)
        setAuthError(signInErrorMessage(error))
        applySession(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void initAuth()

    return () => {
      cancelled = true
    }
  // intentional: runs once per mount; later sign-ins go through signIn()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAuthError])

  const signIn = useCallback(async (returnTo: string) => {
    setAuthError(null)
    setSignedOut(false)
    setSignedOutState(false)
    setIsLoading(true)
    try {
      const metadata = await loadMetadata()
      if (metadata.type === 'OAUTH2' || metadata.type === 'AUTH_0') {
        const resumed = await establishSession(metadata)
        if (resumed) {
          applySession(resumed)
          setIsLoading(false)
          return
        }
        await startAuthorizationRedirect(metadata, returnTo)
        return // the browser is leaving for the identity provider
      }
      applySession(await establishSession(metadata))
      setIsLoading(false)
    } catch (error) {
      console.warn('[Auth] Sign-in failed:', error instanceof Error ? error.message : error)
      setAuthError(signInErrorMessage(error))
      applySession(null)
      setIsLoading(false)
    }
  }, [applySession, establishSession, loadMetadata])

  const handleLogout = useCallback(async () => {
    const metadata = authMetadata
    const loginPath = `/login?returnTo=${encodeURIComponent(currentReturnTo())}`
    const providerLogout = Boolean(metadata && (metadata.type === 'OAUTH2' || metadata.type === 'AUTH_0'))
    // Signed out first: protected pages unmount (no refetch with an ending session) and the
    // login page shows the signed-out state instead of signing in again. Provider logouts
    // leave the page for the identity provider instead, so no in-app navigation is started.
    redirectingToLogin.current = true
    setSignedOut(true)
    if (!providerLogout) {
      setSignedOutState(true)
      setIsAuthenticated(false)
      setUser(null)
    }
    try {
      await apiLogout()
    } catch (error) {
      // The local sign-out still happens; the backend session is left to expire.
      console.warn('[Auth] Backend logout failed:', error instanceof Error ? error.message : error)
    }
    resetReauthAttempts()
    clearUserClientData()
    clearAuthMetadataCache()
    queryClient.clear()
    if (metadata && (metadata.type === 'OAUTH2' || metadata.type === 'AUTH_0')) {
      // The backend keys provider sessions by these cookies; a stale `sessionId` left by
      // logout would otherwise shadow the next sign-in's session (QRun-IO/qqq#674).
      expireSessionCookies()
    }

    if (metadata && (metadata.type === 'OAUTH2' || metadata.type === 'AUTH_0')) {
      try {
        const endSession = await buildEndSessionUrl(metadata, `${window.location.origin}/login`)
        if (endSession) {
          window.location.assign(endSession)
          return
        }
      } catch (error) {
        console.warn('[Auth] Identity provider sign-out unavailable:', error instanceof Error ? error.message : error)
      }
    }
    setSignedOutState(true)
    setIsAuthenticated(false)
    setUser(null)
    router.push(loginPath)
  }, [authMetadata, router])

  const handleOAuthCallback = useCallback(async (code: string, state: string, codeVerifier?: string) => {
    const storedState = sessionStorage.getItem(PKCE_STORAGE.state)
    sessionStorage.removeItem(PKCE_STORAGE.state)
    if (!storedState || storedState !== state) {
      throw new Error('The sign-in response did not match this browser session (state mismatch).')
    }
    if (!codeVerifier) {
      throw new Error('The sign-in attempt is missing its PKCE verifier.')
    }
    const metadata = await loadMetadata()
    const uri = sessionStorage.getItem(PKCE_STORAGE.redirectUri) ?? redirectUri()
    let response: SessionResponse
    let fallback: AuthUser | null = null
    if (metadata.type === 'AUTH_0') {
      const tokens = await exchangeAuth0Code(metadata, code, codeVerifier)
      fallback = identityFromIdToken(tokens.id_token)
      response = await manageSession(tokens.access_token)
    } else if (metadata.type === 'OAUTH2') {
      response = await createOAuth2Session({ code, codeVerifier, redirectUri: uri })
    } else {
      throw new Error(`Sign-in callbacks are not used by ${metadata.type} authentication.`)
    }
    sessionStorage.removeItem(PKCE_STORAGE.redirectUri)
    const signedIn = sessionUser(response, fallback)
    storeUser(signedIn)
    setSignedOut(false)
    setSignedOutState(false)
    resetReauthAttempts()
    applySession(signedIn)
    setIsLoading(false)
  }, [applySession, loadMetadata])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        authMetadata,
        authError,
        isSignedOut: signedOut,
        signIn,
        logout: handleLogout,
        handleOAuthCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
