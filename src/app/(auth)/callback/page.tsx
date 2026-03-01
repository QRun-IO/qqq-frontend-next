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
 * @file OAuth2 / Auth0 callback page — handles the PKCE redirect from the authorization server.
 */

'use client'

// OAuth2 / Auth0 callback page — handles the redirect from the authorization server.
//
// After a successful PKCE redirect from the login page the IdP returns the user
// here with `?code=...&state=...` query parameters.  This page:
//
//   1. Validates that `state` matches the nonce stored in sessionStorage (CSRF guard).
//   2. Retrieves the `pkce_code_verifier` stored by the login page.
//   3. Calls `handleOAuthCallback(code, state, codeVerifier)` which:
//        a. Re-validates the state nonce.
//        b. Posts the code + verifier to the QQQ backend via `manageSession`.
//        c. The backend exchanges the code + verifier with the IdP and issues a
//           session cookie.
//   4. Redirects to `oauth2ReturnTo` (set by the login page) or '/'.
//
// Wrapped in Suspense because it uses useSearchParams().

import React, { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useAuth } from '@/lib/auth/use-auth'

/**
 * Inner callback handler — reads `code`, `state`, and `error` from search params,
 * validates the state nonce, retrieves the PKCE verifier from sessionStorage, and
 * delegates to `handleOAuthCallback`. Redirects on success or failure.
 *
 * @returns A loading spinner card while the callback is being processed.
 */
function CallbackContent() {
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
    const errorDescription = searchParams.get('error_description')

    if (error) {
      console.error('[Callback] Auth error:', error, errorDescription)
      router.replace(`/login?error=${encodeURIComponent(error)}`)
      return
    }

    if (!code || !state) {
      console.error('[Callback] Missing code or state params')
      router.replace('/login')
      return
    }

    // Retrieve the PKCE code_verifier that the login page stored before
    // redirecting to the IdP.  This is forwarded to the backend so it can
    // complete the authorization-code → access-token exchange.
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier') ?? undefined
    sessionStorage.removeItem('pkce_code_verifier')

    handleOAuthCallback(code, state, codeVerifier)
      .then(() => {
        // Retrieve the post-login destination that was saved before the redirect.
        const returnTo = sessionStorage.getItem('oauth2ReturnTo') ?? '/'
        sessionStorage.removeItem('oauth2ReturnTo')
        router.replace(returnTo)
      })
      .catch((err: unknown) => {
        console.error('[Callback] Failed to handle callback:', err)
        router.replace('/login?error=callback_failed')
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
          Completing login...
        </h1>
        <p className="text-sm text-muted-foreground">
          Please wait while we complete authentication.
        </p>
      </div>
    </div>
  )
}

/**
 * OAuth2 / Auth0 callback page exported as the Next.js default for `/auth/callback`.
 *
 * Wraps `CallbackContent` in a `<Suspense>` boundary because `useSearchParams()`
 * requires Suspense in the App Router.
 *
 * @returns The callback page wrapped in a full-screen centered container.
 */
export default function CallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  )
}
