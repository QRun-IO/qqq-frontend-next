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
//        b. OAUTH2: posts code + verifier + redirect URI to the backend, which
//           exchanges them with the IdP and issues a session cookie.
//           AUTH_0: exchanges the code with Auth0 (public PKCE client) and posts
//           the access token to the backend.
//   4. Redirects to `oauth2ReturnTo` (set by the login page) or '/'.
//
// `/token` (the registered redirect URI) renders the same handler.
// Wrapped in Suspense because it uses useSearchParams().

import React, { Suspense } from 'react'

import CallbackContent from './CallbackContent'

/**
 * OAuth2 / Auth0 callback page exported as the Next.js default for `/callback`.
 *
 * Wraps `CallbackContent` in a `<Suspense>` boundary because `useSearchParams()`
 * requires Suspense in the App Router.
 *
 * @returns The callback page wrapped in a full-screen centered container.
 */
export default function CallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
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
    </main>
  )
}
