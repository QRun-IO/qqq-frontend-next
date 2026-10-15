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
 * @file Keeps Jam Recording Link parameters (`jam-recording`, `jam-title`, `jam-reference`, any
 * `jam-*`) across sign-in. The page a Recording Link opens may first send the user to /login and
 * the identity provider; the `returnTo` path normally carries the query, but any hop that drops it
 * (the root redirect, a failed callback) would lose the recording. So every page load stashes the
 * parameters in sessionStorage, and once signed in they are put back on the URL, where the Jam
 * SDK looks for them. Pure helpers plus two storage functions; nothing here loads Jam.
 */

/** sessionStorage key of the stash. */
export const JAM_PARAMS_STORAGE_KEY = 'qqq.qaCapture.jamParams'

/** How long a stash stays valid (a sign-in round trip). */
export const JAM_PARAMS_TTL_MS = 30 * 60 * 1000

const MAX_PARAMS = 20
const MAX_VALUE = 2048

/** Pages where the parameters are kept in the stash rather than restored. */
const AUTH_PATH = /^\/(login|token|callback)(\/|$)/

/**
 * The `jam-*` parameters of a query string.
 *
 * @param search - A query string (with or without `?`).
 * @returns The parameters, in order.
 */
export function readJamParams(search: string): [string, string][] {
  const result: [string, string][] = []
  for (const [key, value] of new URLSearchParams(search)) {
    if (key.startsWith('jam-') && key.length <= 64 && value.length <= MAX_VALUE) result.push([key, value])
    if (result.length >= MAX_PARAMS) break
  }
  return result
}

/**
 * Adds `jam-*` parameters to a query string, replacing existing ones of the same name.
 *
 * @param search - The current query string.
 * @param params - The parameters to add.
 * @returns The new query string (with `?`, or empty).
 */
export function withJamParams(search: string, params: [string, string][]): string {
  const query = new URLSearchParams(search)
  for (const [key] of params) query.delete(key)
  for (const [key, value] of params) query.append(key, value)
  const text = query.toString()
  return text ? `?${text}` : ''
}

/**
 * Reads the session storage, or null when it is unavailable.
 *
 * @returns The storage.
 */
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Stashes the `jam-*` parameters of the current URL, if it has a `jam-recording`.
 *
 * @param location - The location to read (defaults to `window.location`).
 * @param now - Clock (tests).
 */
export function stashJamParams(location: Pick<Location, 'search'> = window.location, now = Date.now()): void {
  const params = readJamParams(location.search)
  if (!params.some(([key]) => key === 'jam-recording')) return
  try {
    storage()?.setItem(JAM_PARAMS_STORAGE_KEY, JSON.stringify({ at: now, params }))
  } catch {
    // storage full or blocked: the returnTo path still carries the query
  }
}

/**
 * Puts stashed parameters back on the current URL (with `history.replaceState`) when the page is
 * not a sign-in page and has no `jam-recording` of its own, then clears the stash. A stash older
 * than {@link JAM_PARAMS_TTL_MS} is discarded.
 *
 * @param now - Clock (tests).
 * @returns Whether the URL was changed.
 */
export function restoreJamParams(now = Date.now()): boolean {
  const store = storage()
  if (!store) return false
  const { pathname, search, hash } = window.location
  if (AUTH_PATH.test(pathname)) return false
  let raw: string | null = null
  try {
    raw = store.getItem(JAM_PARAMS_STORAGE_KEY)
    if (raw) store.removeItem(JAM_PARAMS_STORAGE_KEY)
  } catch {
    return false
  }
  if (!raw) return false
  if (new URLSearchParams(search).has('jam-recording')) return false
  let stash: { at?: unknown; params?: unknown }
  try {
    stash = JSON.parse(raw) as { at?: unknown; params?: unknown }
  } catch {
    return false
  }
  if (typeof stash.at !== 'number' || now - stash.at > JAM_PARAMS_TTL_MS || now < stash.at) return false
  const params = Array.isArray(stash.params)
    ? readJamParams(
        new URLSearchParams(
          stash.params.filter((entry): entry is [string, string] => Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string')
        ).toString()
      )
    : []
  if (!params.some(([key]) => key === 'jam-recording')) return false
  window.history.replaceState(window.history.state, '', `${pathname}${withJamParams(search, params)}${hash}`)
  return true
}
