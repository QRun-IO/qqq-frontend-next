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

/** @file Typed collaboration favorites, recents, and optional-extension discovery. */

import type {
  CollaborationFavorite,
  CollaborationFavoriteOrder,
  CollaborationList,
  CollaborationMutationResult,
  CollaborationTarget,
  CollaborationTargetType,
} from '@/types/collaboration'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { internalAppHref } from '@/lib/utils/internal-app-href'
import apiClient from './client'

const BASE = '/qbit/collaboration'
const TARGET_TYPES: CollaborationTargetType[] = [
  'TABLE',
  'APP',
  'RECORD',
  'PROCESS',
  'REPORT',
  'SAVED_VIEW',
]
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const string = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null
const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/**
 * Drops malformed targets and never exposes cached labels or links for unavailable entries.
 * @param raw - Untrusted response body.
 * @returns A safe list retaining its opaque continuation cursor.
 */
export function normalizeCollaborationList(raw: unknown): CollaborationList {
  const data = object(raw)
  const items: CollaborationFavorite[] = []
  for (const value of Array.isArray(data.items) ? data.items : []) {
    const item = object(value)
    const targetType = item.targetType as CollaborationTargetType
    const targetName = string(item.targetName)
    const recordId = string(item.recordId)
    if (!TARGET_TYPES.includes(targetType) || !targetName || (targetType === 'RECORD' && !recordId))
      continue
    const available = item.available === true
    items.push({
      targetType,
      targetName,
      recordId,
      id: number(item.id),
      available,
      label: available ? (string(item.label) ?? 'Unavailable') : 'Unavailable',
      href: available ? internalAppHref(string(item.href)) : null,
      folder: string(item.folder),
      sortOrder: number(item.sortOrder),
    })
  }
  return { items, nextCursor: string(data.nextCursor) }
}

/**
 * Detects the extension through version metadata, falling back only on older backends.
 * Session caching belongs to the availability query (including negative results).
 * @returns Whether collaboration is installed for this session.
 */
export async function isCollaborationInstalled(): Promise<boolean> {
  try {
    const version = object(await apiClient.get<unknown>('/version'))
    if (Array.isArray(version.extensions))
      return version.extensions.some((extension) => object(extension).name === 'collaboration')
    if (typeof version.apiVersion === 'string') return false
  } catch (error) {
    if (![403, 404].includes(getErrorStatusCode(error) ?? 0)) throw error
  }
  try {
    const data = object(await apiClient.get<unknown>(`${BASE}/favorites`, { params: { limit: 1 } }))
    return Array.isArray(data.items) || data.items === null
  } catch (error) {
    if ([403, 404].includes(getErrorStatusCode(error) ?? 0)) return false
    throw error
  }
}

/**
 * Reads all favorite pages, preserving server order.
 * @returns The complete personal favorites list.
 */
export async function listFavorites(): Promise<CollaborationList> {
  const items: CollaborationFavorite[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  do {
    const page: CollaborationList = normalizeCollaborationList(
      await apiClient.get<unknown>(`${BASE}/favorites`, {
        params: { limit: 100, ...(cursor ? { cursor } : {}) },
      })
    )
    items.push(...page.items)
    cursor = page.nextCursor
    if (cursor && seen.has(cursor))
      throw new Error('Favorites returned a repeated continuation cursor')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return { items, nextCursor: null }
}

/**
 * Rejects invalid mutation acknowledgements so optimistic changes roll back.
 * @param raw - Response body.
 * @returns Successful acknowledgement.
 */
function acknowledgement(raw: unknown): CollaborationMutationResult {
  if (object(raw).success !== true) throw new Error('Collaboration update was not acknowledged')
  return { success: true }
}

/**
 * Stars a target for the current user.
 * @param target - Navigation identity.
 * @returns Mutation acknowledgement.
 */
export async function starFavorite(
  target: CollaborationTarget
): Promise<CollaborationMutationResult> {
  return acknowledgement(await apiClient.put(`${BASE}/favorites`, target))
}

/**
 * Removes a favorite, including an unavailable target.
 * @param target - Navigation identity.
 * @returns Mutation acknowledgement.
 */
export async function unstarFavorite(
  target: CollaborationTarget
): Promise<CollaborationMutationResult> {
  return acknowledgement(await apiClient.delete(`${BASE}/favorites`, { data: target }))
}

/**
 * Reorders favorites and changes their folders.
 * @param order - Ordered identifiers and optional folder assignments.
 * @returns Mutation acknowledgement.
 */
export async function reorderFavorites(
  order: CollaborationFavoriteOrder
): Promise<CollaborationMutationResult> {
  return acknowledgement(await apiClient.patch(`${BASE}/favorites/order`, order))
}

/**
 * Loads the newest visible targets; the server caps this list at fifty.
 * @param limit - Maximum number of targets.
 * @returns Visible recent targets in server order.
 */
export async function listRecents(limit = 50): Promise<CollaborationList> {
  const page = normalizeCollaborationList(
    await apiClient.get<unknown>(`${BASE}/recents`, { params: { limit } })
  )
  return { ...page, items: page.items.filter((item) => item.available && item.href) }
}

/**
 * Records one page open; the server also throttles repeated views.
 * @param target - Navigation identity.
 * @returns Mutation acknowledgement.
 */
export async function recordRecent(
  target: CollaborationTarget
): Promise<CollaborationMutationResult> {
  return acknowledgement(await apiClient.post(`${BASE}/recents`, target))
}
