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

/** @file Defensive client for the release-notes UI API extension. */

import type { ReleaseNotesCategory, ReleaseNotesItemV1, ReleaseNotesLatestV1, ReleaseNotesReleasesV1, ReleaseNotesSummaryV1 } from '@/types/release-notes'
import apiClient from './client'

/** The release history route. */
export const WHATS_NEW_PATH = '/app/whats-new'

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const str = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
const count = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
const date = (value: unknown): string | null => str(value) && Number.isFinite(Date.parse(value as string)) ? value as string : null
const categories: ReleaseNotesCategory[] = ['NEW', 'IMPROVED', 'FIXED', 'SECURITY', 'REMOVED']

/** Normalizes release identity, dropping entries without a usable id or title.
 * @param raw - Server value.
 * @returns The identity or null.
 */
function latest(raw: unknown): ReleaseNotesLatestV1 | null {
  const value = object(raw)
  if (typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id < 0 || !str(value.title)) return null
  return { id: value.id, title: str(value.title)!, version: str(value.version) ?? '', publishedAt: date(value.publishedAt) ?? '' }
}

/** Normalizes an item, dropping unrecognized categories and missing text.
 * @param raw - Server value.
 * @returns A displayable item or null.
 */
function item(raw: unknown): ReleaseNotesItemV1 | null {
  const value = object(raw)
  const category = value.category as ReleaseNotesCategory
  if (!categories.includes(category) || !str(value.text)) return null
  return { category, categoryLabel: str(value.categoryLabel) ?? category.charAt(0) + category.slice(1).toLowerCase(), text: str(value.text)!, linkUrl: str(value.linkUrl), screenshotUrl: str(value.screenshotUrl) }
}

/** Loads a page of published releases in server order.
 * @param limit - Maximum releases.
 * @param offset - Releases to skip.
 * @returns The normalized page.
 */
export async function getReleaseNotes(limit: number, offset: number): Promise<ReleaseNotesReleasesV1> {
  const data = object(await apiClient.get<unknown>('/qbit/release-notes/releases', { params: { limit: String(limit), offset: String(offset) } }))
  const releases = (Array.isArray(data.releases) ? data.releases : []).flatMap((raw: unknown) => {
    const identity = latest(raw)
    if (!identity) return []
    const value = object(raw)
    const items = (Array.isArray(value.items) ? value.items : []).map(item).filter((entry): entry is ReleaseNotesItemV1 => entry !== null)
    return [{ ...identity, summary: str(value.summary), isNew: value.isNew === true, items }]
  })
  return { releases, total: Math.max(count(data.total), releases.length), unreadCount: count(data.unreadCount), lastSeenAt: date(data.lastSeenAt) }
}

/** Loads the user menu's unread summary.
 * @returns The normalized summary.
 */
export async function getReleaseNotesSummary(): Promise<ReleaseNotesSummaryV1> {
  const data = object(await apiClient.get<unknown>('/qbit/release-notes/summary'))
  return { unreadCount: count(data.unreadCount), latest: latest(data.latest) }
}

/** Marks the release history seen, without a request body.
 * @returns The cleared unread count.
 */
export async function markReleaseNotesSeen(): Promise<{ unreadCount: number }> {
  await apiClient.post<unknown>('/qbit/release-notes/seen')
  return { unreadCount: 0 }
}
