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

export interface AuthUser {
  name?: string
  email?: string
  id?: string
}

export interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  user: AuthUser | null
  authMetadata: QAuthenticationMetaData | null
  logout: () => Promise<void>
  handleOAuthCallback: (code: string, state: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export interface AuthProviderProps {
  children: ReactNode
  onAuthError?: (error: Error) => void
}

export function AuthProvider({ children, onAuthError }: AuthProviderProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authMetadata, setAuthMetadata] = useState<QAuthenticationMetaData | null>(null)

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

        switch (metadata.type) {
          case 'AUTH_0':
            await setupAuth0Session(metadata)
            break
          case 'OAUTH2':
            await setupOAuth2Session(metadata)
            break
          case 'FULLY_ANONYMOUS':
          case 'MOCK':
            await setupAnonymousSession()
            break
          default:
            throw new Error(`Unrecognized auth type: ${(metadata as QAuthenticationMetaData).type}`)
        }

        if (!cancelled) {
          setIsAuthenticated(true)
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
  }, [onAuthError]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setupAuth0Session(authMeta: QAuthenticationMetaData) {
    // Auth0 flow: verify existing session by calling a protected endpoint
    // The sessionUUID cookie is managed by the backend
    // For MVP: assume authenticated if we can load the auth metadata
    void authMeta // metadata will be used in full Auth0 PKCE implementation
    const storedUser = getStoredUser()
    setUser(storedUser || { name: 'User', email: 'user@example.com' })
  }

  async function setupOAuth2Session(authMeta: QAuthenticationMetaData) {
    // OAuth2/OIDC flow: check for existing session via cookie
    // The actual OAuth redirect is handled by the login page
    void authMeta // metadata will be used in full OAuth2/PKCE implementation
    const storedUser = getStoredUser()
    setUser(storedUser || { name: 'User', email: 'user@example.com' })
  }

  async function setupAnonymousSession() {
    // Anonymous auth: call manageSession with empty token to get a session cookie
    try {
      await manageSession('anonymous')
    } catch {
      // Anonymous may not need a token exchange
    }
    setUser({ name: 'Anonymous', email: 'anonymous@localhost' })
  }

  function getStoredUser(): AuthUser | null {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem('qqqUser')
      if (stored) {
        return JSON.parse(stored) as AuthUser
      }
    } catch {
      // Ignore parse errors
    }
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleOAuthCallback(code: string, state: string) {
    // This is called by the OAuth callback page
    // Exchange code for tokens, then create session
    try {
      // For now, just mark as authenticated
      // Full OAuth2/PKCE implementation in production
      // OAuth callback received — exchange code for session token
      setIsAuthenticated(true)
    } catch (error) {
      console.error('[Auth] OAuth callback failed:', error)
      throw error
    }
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
