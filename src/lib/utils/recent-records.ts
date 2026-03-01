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
 * @file recent-records — recently viewed records tracker persisted to localStorage.
 * Used by GlobalSearch to show recent items when no search term is entered.
 */

export interface RecentRecord {
  tableName: string
  tableLabel: string
  recordId: string
  recordLabel: string
  path: string
  viewedAt: number // timestamp
}

const STORAGE_KEY = 'qqq-recent-records'
const MAX_RECORDS = 20

/**
 * Returns recently viewed records sorted by viewedAt descending (most recent first).
 *
 * @returns Array of `RecentRecord` objects sorted newest-first, or an empty array on SSR or parse errors.
 */
export function getRecentRecords(): RecentRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentRecord[]
    if (!Array.isArray(parsed)) return []
    return parsed.sort((a, b) => b.viewedAt - a.viewedAt)
  } catch {
    return []
  }
}

/**
 * Adds or updates a recently viewed record.
 * Deduplicates by tableName + recordId combination — if the same record already
 * exists, the existing entry is removed and the new one is prepended with a fresh
 * timestamp. Trims the list to MAX_RECORDS entries.
 *
 * @param record - The record to add, without a `viewedAt` timestamp (added automatically).
 */
export function addRecentRecord(record: Omit<RecentRecord, 'viewedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    const existing = getRecentRecords()

    // Remove any existing entry with the same tableName + recordId (deduplication)
    const deduped = existing.filter(
      (r) => !(r.tableName === record.tableName && r.recordId === record.recordId)
    )

    // Prepend the new record with current timestamp, then trim to the max size
    const updated: RecentRecord[] = [
      { ...record, viewedAt: Date.now() },
      ...deduped,
    ].slice(0, MAX_RECORDS)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    console.warn('[recent-records] Failed to persist recent record')
  }
}

/**
 * Clears all recently viewed records from localStorage.
 */
export function clearRecentRecords(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    console.warn('[recent-records] Failed to clear recent records')
  }
}
