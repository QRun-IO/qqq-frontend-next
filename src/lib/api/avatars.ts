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
 * @file Avatars — `GET /qqq/v1/avatars/{userId}` (UI API 1.7.0, feature `avatars`). Images load
 * through `<img>` with the session cookie; nothing calls a third party (a user's chosen Gravatar is
 * a server redirect). A 404 means "no avatar": the caller draws initials, and the miss is
 * remembered for the session so the same user is not asked for again.
 */

import { apiUrl } from './client'

/** The sizes the server renders. */
export const AVATAR_SIZES = [32, 64, 128, 256] as const

/** An avatar URL in session or preference values: `/qqq/v1/avatars/{encoded id}?v={version}`. */
const SERVER_AVATAR_URL = /^\/qqq\/v1\/avatars\/([^/?#]+)\?v=([^&#]+)$/

const misses = new Set<string>()

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
 * A user's avatar URL.
 *
 * @param userId - The user's id (as in comments, presence and mentions).
 * @param size - A server size.
 * @returns The URL under the API base.
 */
export function userAvatarUrl(userId: string, size: number): string {
  return apiUrl(`/avatars/${encodeURIComponent(userId)}?size=${size}`)
}

/**
 * Resolves a server avatar URL (`/qqq/v1/avatars/{id}?v=…`, from session or preference values)
 * against the API base, at a size. Other values (a `blob:` preview) pass through.
 *
 * @param url - The server's URL.
 * @param size - A server size.
 * @returns A loadable URL.
 */
export function versionedAvatarUrl(url: string, size: number): string {
  const match = SERVER_AVATAR_URL.exec(url)
  if (!match) return url
  const [, userId, version] = match
  return apiUrl(`/avatars/${userId}?v=${encodeURIComponent(decodeURIComponent(version))}&size=${size}`)
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

/** Forgets every remembered miss (after the user changes their own photo; tests). */
export function clearAvatarMisses(): void {
  misses.clear()
}
