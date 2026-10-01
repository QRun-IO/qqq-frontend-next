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
 * @file Messages for sign-in errors passed to the login page as `?error=`.
 */

/** Messages for the provider and callback error codes the login page explains. */
const CALLBACK_ERRORS: Record<string, string> = {
  access_denied: 'Sign-in was denied by the identity provider.',
  callback_failed: 'Sign-in could not be completed.',
  login_required: 'The identity provider requires you to sign in again.',
  consent_required: 'The identity provider needs your consent before you can sign in.',
  interaction_required: 'The identity provider needs you to complete sign-in there.',
  temporarily_unavailable: 'The identity provider is temporarily unavailable. Try again shortly.',
  server_error: 'The identity provider could not complete sign-in.',
}

/** An OAuth 2.0 style error code (RFC 6749 §4.1.2.1): lowercase words joined by underscores. */
const ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/
const PROVIDER_ERROR_KEY = 'oauth_provider_error'

/** Discard a description when a new authorization attempt starts. */
export function clearProviderError(): void {
  sessionStorage.removeItem(PROVIDER_ERROR_KEY)
}

/**
 * Carry a provider's explanation across the callback redirect, never through the URL.
 * @param code - The provider's error code.
 * @param description - The provider's explanation.
 */
export function saveProviderError(code: string, description: string | null): void {
  clearProviderError()
  const message = description?.replace(/\p{Cc}/gu, ' ').trim().slice(0, 300)
  if (ERROR_CODE.test(code) && message) {
    sessionStorage.setItem(PROVIDER_ERROR_KEY, JSON.stringify({ code, message }))
  }
}

/**
 * Return the provider's explanation once, only for its matching callback error.
 * @param code - The login page's error code.
 * @returns The saved explanation or null.
 */
export function consumeProviderError(code: string | null): string | null {
  const stored = sessionStorage.getItem(PROVIDER_ERROR_KEY)
  sessionStorage.removeItem(PROVIDER_ERROR_KEY)
  if (!stored || !code) return null
  try {
    const value = JSON.parse(stored) as { code?: unknown; message?: unknown }
    return value.code === code && typeof value.message === 'string' ? value.message : null
  } catch {
    return null
  }
}

/**
 * The login page message for an `?error=` value. Anyone can link to the login
 * page, so only known codes get a sentence and other well-formed codes are shown
 * as a code; free text is never displayed (QRun-IO/qqq#696).
 *
 * @param code - The `error` query parameter.
 * @returns The message, or null when there is no error.
 */
export function callbackErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  if (Object.prototype.hasOwnProperty.call(CALLBACK_ERRORS, code)) return CALLBACK_ERRORS[code]
  return ERROR_CODE.test(code) ? `Sign-in failed (${code}).` : 'Sign-in failed.'
}
