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
 * @file Browser-side auth state: the signed-out marker, the displayed user, the
 * re-authentication loop guard, and clearing per-user client data on sign-out.
 */

import { clearRecentRecords } from '@/lib/utils/recent-records'

const SIGNED_OUT_KEY = 'qqq.signedOut'
const USER_KEY = 'qqqUser'
const REAUTH_KEY = 'qqq.reauthAttempts'

/** The displayed identity of the signed-in user. */
export interface StoredUser {
  name?: string
  email?: string
}

/**
 * The browser storage area, or null when unavailable (SSR or blocked storage).
 *
 * @param kind - `local` or `session`.
 * @returns The storage, or null.
 */
function storage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Whether the user explicitly signed out in this browser tab.
 *
 * @returns True after logout until the next sign-in.
 */
export function isSignedOut(): boolean {
  return storage('session')?.getItem(SIGNED_OUT_KEY) === '1'
}

/**
 * Records or clears an explicit sign-out, so anonymous and mock sessions are not
 * silently re-created until the user chooses to sign in again.
 *
 * @param signedOut - The new state.
 */
export function setSignedOut(signedOut: boolean): void {
  if (signedOut) storage('session')?.setItem(SIGNED_OUT_KEY, '1')
  else storage('session')?.removeItem(SIGNED_OUT_KEY)
}

/**
 * Normalizes a session's `values.user` from `manageSession`.
 *
 * `email` is the identity line shown under the name; TABLE_BASED sessions name
 * their user by `username` instead (QRun-IO/qqq#700), which fills the same line.
 *
 * @param values - The session values for the frontend.
 * @returns The user when it has a name or email.
 */
export function userFromSessionValues(values: Record<string, unknown> | undefined): StoredUser | null {
  const user = values?.user
  if (!user || typeof user !== 'object') return null
  const { name, email, username } = user as Record<string, unknown>
  const identity = typeof email === 'string' && email ? email : typeof username === 'string' && username ? username : undefined
  const result: StoredUser = {
    name: typeof name === 'string' && name ? name : undefined,
    email: identity,
  }
  return result.name || result.email ? result : null
}

/**
 * The user stored at the last sign-in (OAuth2/Auth0).
 *
 * @returns The user, if well-formed.
 */
export function getStoredUser(): StoredUser | null {
  try {
    const parsed = JSON.parse(storage('local')?.getItem(USER_KEY) ?? 'null') as unknown
    return userFromSessionValues({ user: parsed })
  } catch {
    return null
  }
}

/**
 * Persists the displayed user for session resumes that return no identity.
 *
 * @param user - The user, or null to remove it.
 */
export function storeUser(user: StoredUser | null): void {
  if (user) storage('local')?.setItem(USER_KEY, JSON.stringify(user))
  else storage('local')?.removeItem(USER_KEY)
}

/**
 * Counts an automatic re-authentication and reports whether too many happened
 * recently (a backend that keeps rejecting fresh sessions must not loop forever).
 *
 * @param now - Current time in ms.
 * @returns True when the caller should stop re-authenticating automatically.
 */
export function recordReauthAttempt(now = Date.now()): boolean {
  const session = storage('session')
  let attempts: number[] = []
  try {
    attempts = (JSON.parse(session?.getItem(REAUTH_KEY) ?? '[]') as number[]).filter((time) => now - time < 60_000)
  } catch {
    attempts = []
  }
  attempts.push(now)
  session?.setItem(REAUTH_KEY, JSON.stringify(attempts))
  return attempts.length > 3
}

/** Clears the automatic re-authentication counter after a user-initiated sign-in. */
export function resetReauthAttempts(): void {
  storage('session')?.removeItem(REAUTH_KEY)
}

/** Removes per-user data kept in the browser (recently viewed records, stored identity). */
export function clearUserClientData(): void {
  clearRecentRecords()
  storeUser(null)
  storage('local')?.removeItem('accessToken')
}
