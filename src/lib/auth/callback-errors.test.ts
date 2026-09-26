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

import { describe, expect, it } from 'vitest'
import { callbackErrorMessage } from './callback-errors'

describe('callbackErrorMessage (QRun-IO/qqq#696)', () => {
  it('explains known provider and callback codes', () => {
    expect(callbackErrorMessage('access_denied')).toBe('Sign-in was denied by the identity provider.')
    expect(callbackErrorMessage('callback_failed')).toBe('Sign-in could not be completed.')
    expect(callbackErrorMessage('temporarily_unavailable')).toBe('The identity provider is temporarily unavailable. Try again shortly.')
  })

  it('shows other well-formed codes as a code', () => {
    expect(callbackErrorMessage('invalid_scope')).toBe('Sign-in failed (invalid_scope).')
  })

  it.each([
    'Your account is locked. Call 555-0100 to unlock it.',
    '<b>Session expired</b>',
    'ACCESS_DENIED',
    'x'.repeat(65),
    'toString',
    '__proto__',
  ])('never displays free text such as %j', (value) => {
    const message = callbackErrorMessage(value)
    expect(message === 'Sign-in failed.' || message === `Sign-in failed (${value}).`).toBe(true)
    expect(message).not.toContain('555')
    expect(message).not.toContain('<b>')
    expect(message).not.toContain('function')
  })

  it('returns null without an error', () => {
    expect(callbackErrorMessage(null)).toBeNull()
    expect(callbackErrorMessage('')).toBeNull()
  })
})
