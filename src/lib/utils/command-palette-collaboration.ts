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
 * @file The command palette's collaboration helpers: favorites matching, server record recents
 * and the current page's star target. Only the lazily loaded palette favorites use them.
 */

import type { QInstance } from '@/types'
import type { CollaborationFavorite, CollaborationTarget } from '@/types/collaboration'
import type { RecentRecord } from './recent-records'
import { commandMatches, compareCommandLabels, tableScreenFor } from './command-palette'

/**
 * Applies existing palette matching to safe, available favorites, preserving saved order when blank.
 * @param items - Normalized favorites.
 * @param search - Palette input.
 * @returns Matching navigation entries.
 */
export function paletteFavorites(items: CollaborationFavorite[], search: string): CollaborationFavorite[] {
  return items.filter(item => item.available && item.href && (!search || commandMatches(item.label, search)))
    .sort((a, b) => compareCommandLabels(a.label, b.label, search))
}

/**
 * Selects server record recents when installed; otherwise retains local history.
 * @param available - Whether collaboration is installed.
 * @param server - Normalized recent targets.
 * @param local - Browser history fallback.
 * @param metaData - Metadata for table labels and icons.
 * @returns Record-only palette history.
 */
export function paletteRecents(available: boolean, server: CollaborationFavorite[], local: RecentRecord[], metaData?: QInstance): RecentRecord[] {
  if (!available) return local
  return server.flatMap(item => item.targetType === 'RECORD' && item.available && item.href && item.recordId ? [{
    tableName: item.targetName, tableLabel: metaData?.tables?.[item.targetName]?.label ?? '',
    tableIcon: metaData?.tables?.[item.targetName]?.icon, recordId: item.recordId,
    recordLabel: item.label, path: item.href, viewedAt: 0,
  }] : [])
}

/**
 * Resolves a star action only on record, table and app home screens.
 * @param pathname - Current route.
 * @param hash - Current hash.
 * @param metaData - Visible instance metadata.
 * @returns Navigation identity or null.
 */
export function favoritePageTarget(pathname: string, hash: string, metaData?: QInstance): CollaborationTarget | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'app') return null
  let name: string
  try { name = decodeURIComponent(segments[1] ?? '') } catch { return null }
  if (segments.length === 2 && metaData?.apps?.[name]) return { targetType: 'APP', targetName: name }
  const screen = tableScreenFor(pathname, hash, metaData)
  return screen ? { targetType: screen.recordId ? 'RECORD' : 'TABLE', targetName: screen.table.name, recordId: screen.recordId } : null
}
