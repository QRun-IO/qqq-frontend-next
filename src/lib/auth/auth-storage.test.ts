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

import { afterEach, describe, expect, it } from 'vitest'
import {
  readCurrentSavedViewId,
  readStoredQueryView,
  writeCurrentSavedViewId,
  writeStoredQueryView,
} from '@/lib/utils/query-view-storage'
import {
  claimClientData,
  clearUserClientData,
  getStoredSessionValues,
  getStoredUser,
  hasSessionHint,
  isSignedOut,
  recordReauthAttempt,
  resetReauthAttempts,
  setSessionHint,
  setSignedOut,
  storeSessionValues,
  storeUser,
  userFromSessionValues,
} from './auth-storage'

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('auth-storage', () => {
  it('reads the displayed user from manageSession values (QRun-IO/qqq#332)', () => {
    expect(userFromSessionValues({ user: { name: 'Alice (sample)', email: 'sample:alice' } })).toEqual({ name: 'Alice (sample)', email: 'sample:alice' })
    expect(userFromSessionValues({ user: { name: '', email: 7 } })).toBeNull()
    expect(userFromSessionValues(undefined)).toBeNull()
  })

  it('shows a TABLE_BASED username as the identity line (QRun-IO/qqq#700)', () => {
    expect(userFromSessionValues({ user: { name: 'Tess Table', username: 'tess.table' } })).toEqual({ name: 'Tess Table', email: 'tess.table' })
    expect(userFromSessionValues({ user: { name: 'Tess Table', email: 'tess@example.test', username: 'tess.table' } })).toEqual({ name: 'Tess Table', email: 'tess@example.test' })
  })

  it('persists and validates the stored user', () => {
    storeUser({ name: 'Dana' })
    expect(getStoredUser()).toEqual({ name: 'Dana', email: undefined })
    localStorage.setItem('qqqUser', '{"name": 42}')
    expect(getStoredUser()).toBeNull()
    localStorage.setItem('qqqUser', 'not json')
    expect(getStoredUser()).toBeNull()
  })

  it('keeps the full session values for analytics identity until sign-out (QRun-IO/qqq#730)', () => {
    const values = { user: { name: 'Alice (sample)', email: 'sample:alice' }, analyticsValues: { user_id: 'u-1' } }
    storeSessionValues(values)
    expect(getStoredSessionValues()).toEqual(values)
    storeSessionValues(undefined)
    expect(getStoredSessionValues()).toEqual(values)
    localStorage.setItem('qqq.sessionValues', '[1]')
    expect(getStoredSessionValues()).toBeNull()
    storeSessionValues(values)
    clearUserClientData()
    expect(getStoredSessionValues()).toBeNull()
  })

  it('tracks an explicit sign-out per tab', () => {
    expect(isSignedOut()).toBe(false)
    setSignedOut(true)
    expect(isSignedOut()).toBe(true)
    setSignedOut(false)
    expect(isSignedOut()).toBe(false)
  })

  it('remembers across tabs that a resumable session was established (QRun-IO/qqq#733)', () => {
    expect(hasSessionHint()).toBe(false)
    setSessionHint(true)
    expect(hasSessionHint()).toBe(true)
    expect(localStorage.getItem('qqq.sessionHint')).toBe('1')
    setSessionHint(false)
    expect(hasSessionHint()).toBe(false)
  })

  it('clears per-user browser data on sign-out (QRun-IO/qqq#669)', () => {
    localStorage.setItem('qqq-recent-records', JSON.stringify([{ path: '/app/pet/1' }]))
    storeUser({ name: 'Alice' })
    localStorage.setItem('accessToken', 'token')
    clearUserClientData()
    expect(localStorage.getItem('qqq-recent-records')).toBeNull()
    expect(localStorage.getItem('qqqUser')).toBeNull()
    expect(localStorage.getItem('accessToken')).toBeNull()
  })

  it('clears every table\'s remembered filters and saved-view selection without resetting machine preferences (QRun-IO/qqq#1006)', () => {
    for (const table of ['person', 'pet']) {
      writeStoredQueryView(table, {
        queryFilter: { criteria: [{ fieldName: 'name', operator: 'EQUALS', values: ['Private Alice'] }] },
        viewIdentity: 'empty',
      })
      writeCurrentSavedViewId(table, 7)
      expect(readStoredQueryView(table)).toMatchObject({
        queryFilter: { criteria: [{ fieldName: 'name', operator: 'EQUALS', values: ['Private Alice'] }] },
      })
      expect(readCurrentSavedViewId(table)).toBe(7)
    }
    const preferences = {
      'qqq.density': 'compact',
      'qqq-dark-mode': 'true',
      'qqq-person-column-widths': '{"name":240}',
      'qqq.recordQueryViews.person': 'unrelated plural key',
      'another-application': 'keep',
    }
    for (const [key, value] of Object.entries(preferences)) localStorage.setItem(key, value)

    clearUserClientData()

    for (const table of ['person', 'pet']) {
      expect(readStoredQueryView(table)).toBeNull()
      expect(readCurrentSavedViewId(table)).toBeNull()
    }
    for (const [key, value] of Object.entries(preferences)) expect(localStorage.getItem(key)).toBe(value)
  })

  it('keeps remembered query state for the same identity and clears it before another identity claims the browser (QRun-IO/qqq#1006)', () => {
    claimClientData({ name: 'Alice', email: 'alice@example.test' })
    writeStoredQueryView('person', {
      queryFilter: { criteria: [{ fieldName: 'name', operator: 'EQUALS', values: ['Private Alice'] }] },
      viewIdentity: 'savedView:7',
    })
    writeCurrentSavedViewId('person', 7)

    claimClientData({ name: 'Alice', email: 'alice@example.test' })
    expect(readStoredQueryView('person')).toMatchObject({
      queryFilter: { criteria: [{ fieldName: 'name', operator: 'EQUALS', values: ['Private Alice'] }] },
      viewIdentity: 'savedView:7',
    })
    expect(readCurrentSavedViewId('person')).toBe(7)

    claimClientData({ name: 'Bob', email: 'bob@example.test' })
    expect(readStoredQueryView('person')).toBeNull()
    expect(readCurrentSavedViewId('person')).toBeNull()
    expect(localStorage.getItem('qqq.clientDataOwner')).toBe('bob@example.test')
  })

  it('clears the previous user\'s data when someone else signs in in this browser (QRun-IO/qqq#696)', () => {
    claimClientData({ name: 'Alice', email: 'alice@example.com' })
    localStorage.setItem('qqq-recent-records', JSON.stringify([{ path: '/app/pet/1', recordLabel: 'Alice private' }]))
    storeUser({ name: 'Alice', email: 'alice@example.com' })

    claimClientData({ name: 'Alice', email: 'alice@example.com' })
    expect(localStorage.getItem('qqq-recent-records')).not.toBeNull()

    claimClientData({ name: 'Bob', email: 'bob@example.com' })
    expect(localStorage.getItem('qqq-recent-records')).toBeNull()
    expect(getStoredUser()).toBeNull()
    expect(localStorage.getItem('qqq.clientDataOwner')).toBe('bob@example.com')
  })

  it('keeps data without an identity to compare, and forgets the owner on sign-out', () => {
    localStorage.setItem('qqq-recent-records', '[]')
    claimClientData(null)
    claimClientData({})
    expect(localStorage.getItem('qqq-recent-records')).toBe('[]')
    claimClientData({ name: 'Casey' })
    expect(localStorage.getItem('qqq-recent-records')).toBe('[]')
    clearUserClientData()
    expect(localStorage.getItem('qqq.clientDataOwner')).toBeNull()
  })

  it('stops automatic re-authentication after repeated attempts within a minute', () => {
    const now = 1_000_000
    expect(recordReauthAttempt(now)).toBe(false)
    expect(recordReauthAttempt(now + 1)).toBe(false)
    expect(recordReauthAttempt(now + 2)).toBe(false)
    expect(recordReauthAttempt(now + 3)).toBe(true)
    expect(recordReauthAttempt(now + 120_000)).toBe(false)
    resetReauthAttempts()
    expect(recordReauthAttempt(now)).toBe(false)
  })
})
