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
