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
import { safeReturnTo } from '@/lib/auth/return-to'
import { JAM_PARAMS_STORAGE_KEY, JAM_PARAMS_TTL_MS, readJamParams, restoreJamParams, stashJamParams, withJamParams } from './jam-params'

const NOW = 1_800_000_000_000

/**
 * Moves the jsdom page to a path.
 *
 * @param url - Path and query.
 */
function goTo(url: string): void {
  window.history.replaceState(null, '', url)
}

afterEach(() => {
  sessionStorage.clear()
  goTo('/')
})

describe('Jam Recording Link parameters across sign-in', () => {
  it('reads only jam-* parameters', () => {
    expect(readJamParams('?a=1&jam-recording=r1&jam-title=Bug%20x&jam-reference=qa-1')).toEqual([
      ['jam-recording', 'r1'],
      ['jam-title', 'Bug x'],
      ['jam-reference', 'qa-1'],
    ])
    expect(readJamParams(`jam-recording=${'x'.repeat(5000)}`)).toEqual([])
  })

  it('merges parameters into a query string', () => {
    expect(withJamParams('?a=1&jam-title=old', [['jam-recording', 'r'], ['jam-title', 'new']])).toBe('?a=1&jam-recording=r&jam-title=new')
    expect(withJamParams('', [])).toBe('')
  })

  it('survives the OIDC round trip: stash on the Recording Link page, restore after the callback', () => {
    // 1. the Recording Link opens a protected page; the dashboard sends the user to /login
    goTo('/app/person/42?jam-recording=r1&jam-title=Bug&jam-reference=qa-1')
    stashJamParams(window.location, NOW)
    // 2. the provider redirects back to /token?code=...&state=...: nothing is restored on auth pages
    goTo('/token?code=c&state=s')
    expect(restoreJamParams(NOW + 1000)).toBe(false)
    expect(sessionStorage.getItem(JAM_PARAMS_STORAGE_KEY)).not.toBeNull()
    // 3. a hop that dropped the query (e.g. the root redirect) lands on the app without them
    goTo('/app/person/42')
    expect(restoreJamParams(NOW + 2000)).toBe(true)
    expect(window.location.search).toBe('?jam-recording=r1&jam-title=Bug&jam-reference=qa-1')
    expect(sessionStorage.getItem(JAM_PARAMS_STORAGE_KEY)).toBeNull()
  })

  it('keeps the parameters in the returnTo path through the login redirect and the 401 path', () => {
    const returnTo = '/app/person/42?jam-recording=r1&jam-title=Bug'
    expect(safeReturnTo(returnTo, 'http://localhost')).toBe(returnTo)
  })

  it('does nothing when the page already has a recording (and clears the stash)', () => {
    goTo('/app/x?jam-recording=r1')
    stashJamParams(window.location, NOW)
    expect(restoreJamParams(NOW)).toBe(false)
    expect(sessionStorage.getItem(JAM_PARAMS_STORAGE_KEY)).toBeNull()
  })

  it('does not stash without jam-recording, and discards expired or malformed stashes', () => {
    goTo('/app/x?jam-title=t')
    stashJamParams(window.location, NOW)
    expect(sessionStorage.getItem(JAM_PARAMS_STORAGE_KEY)).toBeNull()

    goTo('/app/x?jam-recording=r1')
    stashJamParams(window.location, NOW)
    goTo('/app/x')
    expect(restoreJamParams(NOW + JAM_PARAMS_TTL_MS + 1)).toBe(false)

    sessionStorage.setItem(JAM_PARAMS_STORAGE_KEY, '{not json')
    expect(restoreJamParams(NOW)).toBe(false)
    sessionStorage.setItem(JAM_PARAMS_STORAGE_KEY, JSON.stringify({ at: NOW, params: [['jam-title', 't'], 'junk'] }))
    expect(restoreJamParams(NOW)).toBe(false)
    sessionStorage.setItem(JAM_PARAMS_STORAGE_KEY, JSON.stringify({ at: NOW, params: 'nope' }))
    expect(restoreJamParams(NOW)).toBe(false)
    sessionStorage.setItem(JAM_PARAMS_STORAGE_KEY, JSON.stringify({ at: NOW + 10, params: [['jam-recording', 'r']] }))
    expect(restoreJamParams(NOW)).toBe(false)
    expect(restoreJamParams(NOW)).toBe(false)
    expect(window.location.search).toBe('')
  })

  it('keeps the existing query and hash when restoring', () => {
    goTo('/app/x?jam-recording=r2')
    stashJamParams(window.location, NOW)
    goTo('/app/x?filter=1#top')
    expect(restoreJamParams(NOW)).toBe(true)
    expect(`${window.location.search}${window.location.hash}`).toBe('?filter=1&jam-recording=r2#top')
  })
})
