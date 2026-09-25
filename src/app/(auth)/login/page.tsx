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
//   password     — TABLE_BASED: ask for a username and password (first visit, after an
//                  expired session and after logout); a refused sign-in is shown in the form.
//   signed out   — after an explicit logout: stay here until the user chooses Sign in.
//   failed       — sign-in was denied or the provider callback failed: explain why and
//                  offer Try again; never fall back to an anonymous session.
// Every state shows the application's pre-sign-in branding (logo, app name, accent) from
// GET /metaData/authentication (QRun-IO/qqq#703).
// Wrapped in Suspense because it uses useSearchParams().

import React, { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import type { QLoginBranding } from '@/types'
import { useAuth } from '@/lib/auth/use-auth'
import { recordReauthAttempt, resetReauthAttempts } from '@/lib/auth/auth-storage'
import { safeReturnTo } from '@/lib/auth/return-to'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'
import { applyBrandingTheme, isSafeImageSource } from '@/lib/theme/apply-branding'

/** Messages for provider callback errors passed back as `?error=`. */
const CALLBACK_ERRORS: Record<string, string> = {
  access_denied: 'Sign-in was denied by the identity provider.',
  callback_failed: 'Sign-in could not be completed.',
  login_required: 'The identity provider requires you to sign in again.',
}

const BUTTON_CLASS = 'inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
const INPUT_CLASS = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive'

/**
 * The application's logo and name, shown before sign-in.
 *
 * @param props - The branding.
 * @param props.branding - Pre-sign-in branding from the authentication metadata.
 * @returns The branding block, or null when the backend declares none.
 */
function LoginBrand({ branding }: { branding?: QLoginBranding }) {
  const appName = branding?.appName?.trim()
  const logo = isSafeImageSource(branding?.logo) ? branding?.logo : undefined
  if (!appName && !logo) return null
  return (
    <div className="flex flex-col items-center gap-2" data-qqq-id="login-branding">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- branding logos are arbitrary backend assets
        <img src={logo} alt={appName ? '' : branding?.companyName?.trim() || 'Application logo'} className="max-h-16 max-w-full object-contain" data-qqq-id="login-logo" />
      )}
      {appName && <p className="text-lg font-semibold text-foreground" data-qqq-id="login-app-name">{appName}</p>}
    </div>
  )
}

/**
 * Card wrapper shared by every login state.
 *
 * @param props - The card contents.
 * @param props.branding - Pre-sign-in branding shown at the top of the card.
 * @param props.children - Card body.
 * @returns The card.
 */
function LoginCard({ branding, children }: { branding?: QLoginBranding; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm" data-qqq-id="login-card">
      <div className="flex flex-col items-center gap-4 text-center">
        <LoginBrand branding={branding} />
        {children}
      </div>
    </div>
  )
}

/** Props for {@link PasswordSignIn}. */
interface PasswordSignInProps {
  /** Card heading. */
  heading: string
  /** Optional line under the heading. */
  message?: string
  /** Why the last sign-in was refused, if it was. */
  error: string | null
  /** Signs in; failures come back through `error`. */
  onSubmit: (username: string, password: string) => Promise<void>
}

/**
 * Username and password form for TABLE_BASED authentication. The password is read from
 * the form on submit and cleared after every attempt; it is never kept in state.
 *
 * @param props - See {@link PasswordSignInProps}.
 * @returns The form.
 */
function PasswordSignIn({ heading, message, error, onSubmit }: PasswordSignInProps) {
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({})

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const username = String(data.get('username') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const errors = {
      username: !username ? 'Enter your username.' : username.includes(':') ? 'A username cannot contain a colon.' : undefined,
      password: !password ? 'Enter your password.' : undefined,
    }
    setFieldErrors(errors)
    if (errors.username || errors.password) {
      const first = form.elements.namedItem(errors.username ? 'username' : 'password')
      if (first instanceof HTMLInputElement) first.focus()
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(username, password)
    } finally {
      const passwordInput = form.elements.namedItem('password')
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = ''
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">{heading}</h1>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <form className="flex w-full flex-col gap-4 text-left" onSubmit={handleSubmit} noValidate aria-label="Sign in" data-qqq-id="login-form">
        {error && <p role="alert" className="text-sm text-destructive" data-qqq-id="login-error">{error}</p>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-username" className="text-sm font-medium text-foreground">Username</label>
          <input
            id="login-username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? 'login-username-error' : undefined}
            className={INPUT_CLASS}
            data-qqq-id="input-login-username"
          />
          {fieldErrors.username && <p id="login-username-error" className="text-sm text-destructive">{fieldErrors.username}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-password" className="text-sm font-medium text-foreground">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            className={INPUT_CLASS}
            data-qqq-id="input-login-password"
          />
          {fieldErrors.password && <p id="login-password-error" className="text-sm text-destructive">{fieldErrors.password}</p>}
        </div>
        <button type="submit" disabled={submitting} className={BUTTON_CLASS} data-qqq-id="button-sign-in">
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </>
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
  const { isAuthenticated, isLoading, authMetadata, authError, isSignedOut, signIn, signInWithPassword } = useAuth()
  const autoSignInStarted = useRef(false)
  const [loopStopped, setLoopStopped] = React.useState(false)

  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const callbackErrorCode = searchParams.get('error')
  const callbackError = callbackErrorCode
    ? CALLBACK_ERRORS[callbackErrorCode] ?? `Sign-in failed (${callbackErrorCode}).`
    : null
  const errorMessage = authError ?? callbackError ?? (loopStopped ? 'Your session could not be re-established. Sign in again to continue.' : null)
  const passwordSignIn = authMetadata?.type === 'TABLE_BASED'
  const branding = authMetadata?.branding
  const appName = branding?.appName?.trim()

  // Pre-sign-in branding: accent colors and favicon, and the app name in the title.
  useEffect(() => {
    applyBrandingTheme(branding)
  }, [branding])
  useDocumentTitle(appName ? `Sign in | ${appName}` : undefined)

  // Signed in: go where the user was headed.
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(returnTo)
  }, [isAuthenticated, isLoading, router, returnTo])

  // Sign in automatically unless the user signed out, a failure needs attention, or
  // the user has to type credentials (TABLE_BASED).
  useEffect(() => {
    if (isLoading || isAuthenticated || isSignedOut || errorMessage || !authMetadata || passwordSignIn) return
    if (autoSignInStarted.current) return
    autoSignInStarted.current = true
    if (recordReauthAttempt()) {
      setLoopStopped(true)
      return
    }
    void signIn(returnTo)
  }, [authMetadata, errorMessage, isAuthenticated, isLoading, isSignedOut, passwordSignIn, returnTo, signIn])

  const signInAgain = () => {
    resetReauthAttempts()
    setLoopStopped(false)
    void signIn(returnTo)
  }

  if (!isLoading && !isAuthenticated && passwordSignIn) {
    return (
      <LoginCard branding={branding}>
        <PasswordSignIn
          heading={isSignedOut ? 'You have signed out' : 'Sign in'}
          message={isSignedOut ? 'Sign in again to continue.' : undefined}
          error={errorMessage}
          onSubmit={signInWithPassword}
        />
      </LoginCard>
    )
  }

  if (!isLoading && !isAuthenticated && isSignedOut) {
    return (
      <LoginCard branding={branding}>
        <h1 className="text-xl font-semibold text-foreground">You have signed out</h1>
        <p className="text-sm text-muted-foreground">Sign in again to continue.</p>
        <button type="button" onClick={signInAgain} className={BUTTON_CLASS} data-qqq-id="button-sign-in">
          Sign in
        </button>
      </LoginCard>
    )
  }

  if (!isLoading && !isAuthenticated && errorMessage) {
    return (
      <LoginCard branding={branding}>
        <h1 className="text-xl font-semibold text-foreground">Unable to sign in</h1>
        <p role="alert" className="text-sm text-destructive" data-qqq-id="login-error">{errorMessage}</p>
        <button type="button" onClick={signInAgain} className={BUTTON_CLASS} data-qqq-id="button-sign-in-retry">
          Try again
        </button>
      </LoginCard>
    )
  }

  const redirecting = authMetadata?.type === 'OAUTH2' || authMetadata?.type === 'AUTH_0'
  return (
    <LoginCard branding={branding}>
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
