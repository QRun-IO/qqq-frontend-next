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
 * @file Avatars (UI API 1.7.0, feature `avatars`). The people on screen are batched into one
 * `POST /avatars/lookup` (user ids never go in a URL), and each returned URL —
 * `GET /avatars/{avatarId}`, an opaque id — loads through `<img>` with the session cookie. Nothing
 * calls a third party: a user's chosen Gravatar is fetched by the server. A user without an avatar,
 * or an image that fails, is remembered for the session so it is not asked for again.
 */

import apiClient, { apiUrl } from './client'

/** The sizes the server renders. */
export const AVATAR_SIZES = [32, 64, 128, 256] as const

/** Most user ids one lookup call accepts. */
const LOOKUP_LIMIT = 200

/** An avatar URL in session, preference or lookup values: `/qqq/v1/avatars/{avatarId}?v={version}`. */
const SERVER_AVATAR_URL = /^\/qqq\/v1\/avatars\/([0-9a-zA-Z_-]+)\?v=([^&#]+)$/

const misses = new Set<string>()
const known = new Map<string, Promise<string | null>>()
let pending: Map<string, (url: string | null) => void> | null = null

/**
 * The smallest rendered size that stays sharp at a CSS size on a 2x display.
 *
 * @param cssPixels - Displayed edge in CSS pixels.
 * @returns A server size.
 */
export function avatarSizeFor(cssPixels: number): number {
  return AVATAR_SIZES.find((size) => size >= cssPixels * 2) ?? 256
}

/**
 * Resolves a server avatar URL against the API base, at a size. Other values (a `blob:` preview)
 * pass through.
 *
 * @param url - The server's URL.
 * @param size - A server size.
 * @returns A loadable URL.
 */
export function versionedAvatarUrl(url: string, size: number): string {
  const match = SERVER_AVATAR_URL.exec(url)
  if (!match) return url
  const [, avatarId, version] = match
  return apiUrl(`/avatars/${avatarId}?v=${encodeURIComponent(decodeURIComponent(version))}&size=${size}`)
}

/**
 * A user's avatar URL (server form), or null when they have none. Calls made in the same tick
 * share one `POST /avatars/lookup`; answers are kept for the session.
 *
 * @param userId - The user's id (as in comments, presence and mentions).
 * @returns The URL, or null.
 */
export function lookupAvatarUrl(userId: string): Promise<string | null> {
  const cached = known.get(userId)
  if (cached) return cached
  const promise = new Promise<string | null>((resolve) => {
    if (!pending) {
      pending = new Map()
      setTimeout(flush, 0)
    }
    pending.set(userId, resolve)
  })
  known.set(userId, promise)
  return promise
}

/** Sends the waiting ids, at most {@link LOOKUP_LIMIT} per call; a failure means "no avatar". */
async function flush(): Promise<void> {
  const batch = pending
  pending = null
  if (!batch) return
  const ids = [...batch.keys()]
  for (let start = 0; start < ids.length; start += LOOKUP_LIMIT) {
    const userIds = ids.slice(start, start + LOOKUP_LIMIT)
    let avatars: Record<string, string> = {}
    try {
      avatars = (await apiClient.post<{ avatars?: Record<string, string> }>('/avatars/lookup', { userIds }))?.avatars ?? {}
    } catch {
      avatars = {}
    }
    for (const userId of userIds) batch.get(userId)?.(typeof avatars[userId] === 'string' ? avatars[userId] : null)
  }
}

/**
 * Whether an avatar URL already failed this session.
 *
 * @param url - The image URL.
 * @returns True after a failure.
 */
export function isAvatarMiss(url: string): boolean {
  return misses.has(url)
}

/**
 * Remembers a failed avatar URL for the session.
 *
 * @param url - The image URL.
 */
export function recordAvatarMiss(url: string): void {
  misses.add(url)
}

/** Forgets every lookup and miss (after the user changes their own photo; tests). */
export function clearAvatarCache(): void {
  misses.clear()
  known.clear()
}
