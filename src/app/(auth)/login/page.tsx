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
 * @file Login page — signs the user in and returns them to the page they asked for.
 */

'use client'

// States:
//   signing in   — first visit or an expired session: sign in automatically (anonymous
//                  types create a session; OAUTH2 / AUTH_0 redirect to the provider).
//   signed out   — after an explicit logout: stay here until the user chooses Sign in.
//   failed       — sign-in was denied or the provider callback failed: explain why and
//                  offer Try again; never fall back to an anonymous session.
// Wrapped in Suspense because it uses useSearchParams().

import React, { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useAuth } from '@/lib/auth/use-auth'
import { recordReauthAttempt, resetReauthAttempts } from '@/lib/auth/auth-storage'
import { safeReturnTo } from '@/lib/auth/return-to'

/** Messages for provider callback errors passed back as `?error=`. */
const CALLBACK_ERRORS: Record<string, string> = {
  access_denied: 'Sign-in was denied by the identity provider.',
  callback_failed: 'Sign-in could not be completed.',
  login_required: 'The identity provider requires you to sign in again.',
}

/**
 * Card wrapper shared by every login state.
 *
 * @param props - The card contents.
 * @param props.children - Card body.
 * @returns The card.
 */
function LoginCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm" data-qqq-id="login-card">
      <div className="flex flex-col items-center gap-4 text-center">{children}</div>
    </div>
  )
}

/**
 * Inner login content — reacts to the auth state and the `returnTo` / `error` params.
 *
 * @returns The login card for the current state.
 */
function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, authMetadata, authError, isSignedOut, signIn } = useAuth()
  const autoSignInStarted = useRef(false)
  const [loopStopped, setLoopStopped] = React.useState(false)

  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const callbackErrorCode = searchParams.get('error')
  const callbackError = callbackErrorCode
    ? CALLBACK_ERRORS[callbackErrorCode] ?? `Sign-in failed (${callbackErrorCode}).`
    : null
  const errorMessage = authError ?? callbackError ?? (loopStopped ? 'Your session could not be re-established. Sign in again to continue.' : null)

  // Signed in: go where the user was headed.
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(returnTo)
  }, [isAuthenticated, isLoading, router, returnTo])

  // Sign in automatically unless the user signed out or a failure needs attention.
  useEffect(() => {
    if (isLoading || isAuthenticated || isSignedOut || errorMessage || !authMetadata) return
    if (autoSignInStarted.current) return
    autoSignInStarted.current = true
    if (recordReauthAttempt()) {
      setLoopStopped(true)
      return
    }
    void signIn(returnTo)
  }, [authMetadata, errorMessage, isAuthenticated, isLoading, isSignedOut, returnTo, signIn])

  const signInAgain = () => {
    resetReauthAttempts()
    setLoopStopped(false)
    void signIn(returnTo)
  }

  if (!isLoading && !isAuthenticated && isSignedOut) {
    return (
      <LoginCard>
        <h1 className="text-xl font-semibold text-foreground">You have signed out</h1>
        <p className="text-sm text-muted-foreground">Sign in again to continue.</p>
        <button
          type="button"
          onClick={signInAgain}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-qqq-id="button-sign-in"
        >
          Sign in
        </button>
      </LoginCard>
    )
  }

  if (!isLoading && !isAuthenticated && errorMessage) {
    return (
      <LoginCard>
        <h1 className="text-xl font-semibold text-foreground">Unable to sign in</h1>
        <p role="alert" className="text-sm text-destructive" data-qqq-id="login-error">{errorMessage}</p>
        <button
          type="button"
          onClick={signInAgain}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-qqq-id="button-sign-in-retry"
        >
          Try again
        </button>
      </LoginCard>
    )
  }

  const redirecting = authMetadata?.type === 'OAUTH2' || authMetadata?.type === 'AUTH_0'
  return (
    <LoginCard>
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
        aria-hidden="true"
      />
      <h1 className="text-xl font-semibold text-foreground">Signing in...</h1>
      <p className="text-sm text-muted-foreground" role="status">
        {redirecting ? 'Redirecting to your identity provider...' : 'Setting up your session...'}
      </p>
    </LoginCard>
  )
}

/**
 * Login page exported as the Next.js default for `/login`.
 *
 * Wraps `LoginContent` in a `<Suspense>` boundary because `useSearchParams()`
 * requires Suspense in the App Router.
 *
 * @returns The login page wrapped in a full-screen centered container.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Suspense
        fallback={
          <LoginCard>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
            <p className="text-sm text-muted-foreground" role="status">Loading...</p>
          </LoginCard>
        }
      >
        <LoginContent />
      </Suspense>
    </main>
  )
}
