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
 * @file CallbackContent — completes the OAuth2 / Auth0 PKCE redirect (`/token`, `/callback`).
 */

'use client'

import React, { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useAuth } from '@/lib/auth/use-auth'
import { PKCE_STORAGE } from '@/lib/auth/oidc'
import { safeReturnTo } from '@/lib/auth/return-to'

/**
 * Inner callback handler — reads `code`, `state`, and `error` from search params,
 * retrieves the PKCE verifier from sessionStorage, and delegates to
 * `handleOAuthCallback`. Redirects on success or failure.
 *
 * @returns A loading card while the callback is being processed.
 */
export default function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { handleOAuthCallback } = useAuth()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const returnTo = safeReturnTo(sessionStorage.getItem(PKCE_STORAGE.returnTo))
    const toLogin = (reason: string) => {
      sessionStorage.removeItem(PKCE_STORAGE.verifier)
      router.replace(`/login?error=${encodeURIComponent(reason)}&returnTo=${encodeURIComponent(returnTo)}`)
    }

    if (error) {
      console.warn('[Callback] Identity provider error:', error, searchParams.get('error_description') ?? '')
      toLogin(error)
      return
    }
    if (!code || !state) {
      console.warn('[Callback] Missing code or state')
      toLogin('callback_failed')
      return
    }

    // The verifier the login page stored before redirecting to the provider.
    const codeVerifier = sessionStorage.getItem(PKCE_STORAGE.verifier) ?? undefined
    sessionStorage.removeItem(PKCE_STORAGE.verifier)

    handleOAuthCallback(code, state, codeVerifier)
      .then(() => {
        sessionStorage.removeItem(PKCE_STORAGE.returnTo)
        router.replace(returnTo)
      })
      .catch((err: unknown) => {
        console.warn('[Callback] Sign-in could not be completed:', err instanceof Error ? err.message : err)
        toLogin('callback_failed')
      })
  }, [searchParams, handleOAuthCallback, router])

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          aria-hidden="true"
        />
        <h1 className="text-xl font-semibold text-foreground">
          Completing sign-in...
        </h1>
        <p className="text-sm text-muted-foreground" role="status">
          Please wait while we complete authentication.
        </p>
      </div>
    </div>
  )
}
