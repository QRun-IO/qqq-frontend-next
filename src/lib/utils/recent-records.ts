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
 * Used by the command palette, the header search, the search dialog and the dashboard.
 * On first use it imports the Material dashboard's history (`qqq.history`), so users
 * moving from the Material dashboard keep their recently viewed records.
 */

import type { QIcon } from '@/types'

/** One recently viewed record. */
export interface RecentRecord {
  /** Backend table name. */
  tableName: string
  /** Table label when the record was viewed. */
  tableLabel: string
  /** The table's icon when the record was viewed (Material stores it with each history entry). */
  tableIcon?: QIcon
  /** Primary key, as a string. */
  recordId: string
  /** Record label. */
  recordLabel: string
  /** Record view path (`/app/{table}/{id}`). */
  path: string
  /** When the record was last viewed (epoch milliseconds). */
  viewedAt: number
}

const STORAGE_KEY = 'qqq-recent-records'
const MAX_RECORDS = 20
/** The Material dashboard's history key (`HistoryUtils.LS_KEY`). */
export const MATERIAL_HISTORY_KEY = 'qqq.history'
/** Set once the Material history was imported, so it is imported only once. */
const MIGRATED_KEY = 'qqq-recent-records-migrated'

/** A Material dashboard history entry (`QHistoryEntry`). */
interface MaterialHistoryEntry {
  iconName?: string
  label?: string
  path?: string
  date?: string
}

/**
 * Converts the Material dashboard's history into recent records. Material paths nest the
 * table under its apps (`/{app}/{table}/{id}`) and labels read `{table label}: {record label}`;
 * entries that do not end with a table and a record id are skipped.
 *
 * @param raw - The stored `qqq.history` JSON.
 * @returns Recent records, newest first.
 */
export function recentRecordsFromMaterialHistory(raw: string | null): RecentRecord[] {
  if (!raw) return []
  let entries: MaterialHistoryEntry[] = []
  try {
    const parsed = JSON.parse(raw) as { entries?: unknown }
    if (Array.isArray(parsed?.entries)) entries = parsed.entries as MaterialHistoryEntry[]
  } catch {
    return []
  }
  const records: RecentRecord[] = []
  entries.forEach((entry, index) => {
    const segments = typeof entry?.path === 'string' ? entry.path.split(/[?#]/)[0].split('/').filter(Boolean) : []
    if (segments.length < 2 || typeof entry.label !== 'string') return
    const [tableName, recordId] = segments.slice(-2).map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    const separator = entry.label.indexOf(': ')
    const tableLabel = separator > 0 ? entry.label.slice(0, separator) : tableName
    const recordLabel = separator > 0 ? entry.label.slice(separator + 2) : entry.label
    const date = entry.date ? Date.parse(entry.date) : NaN
    records.push({
      tableName,
      tableLabel,
      tableIcon: entry.iconName ? { name: entry.iconName } : undefined,
      recordId,
      recordLabel,
      path: `/app/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`,
      // Material appends newest last; without a date, keep that order
      viewedAt: Number.isFinite(date) ? date : index,
    })
  })
  return records.sort((a, b) => b.viewedAt - a.viewedAt).slice(0, MAX_RECORDS)
}

/**
 * Imports the Material dashboard history once, when this dashboard has no recent records yet.
 */
function migrateMaterialHistory(): void {
  if (localStorage.getItem(MIGRATED_KEY)) return
  localStorage.setItem(MIGRATED_KEY, 'true')
  if (localStorage.getItem(STORAGE_KEY)) return
  const imported = recentRecordsFromMaterialHistory(localStorage.getItem(MATERIAL_HISTORY_KEY))
  if (imported.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(imported))
}

/**
 * Returns recently viewed records sorted by viewedAt descending (most recent first).
 *
 * @returns Array of `RecentRecord` objects sorted newest-first, or an empty array on SSR or parse errors.
 */
export function getRecentRecords(): RecentRecord[] {
  if (typeof window === 'undefined') return []
  try {
    migrateMaterialHistory()
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
 * Removes a record from the recently viewed list, as Material does when a record view
 * answers 404 (deleted) or 403 (no longer permitted), and after the record is deleted.
 *
 * @param tableName - Backend table name.
 * @param recordId - Primary key of the record.
 */
export function removeRecentRecord(tableName: string, recordId: string | number): void {
  if (typeof window === 'undefined') return
  try {
    const existing = getRecentRecords()
    const kept = existing.filter((r) => !(r.tableName === tableName && r.recordId === String(recordId)))
    if (kept.length !== existing.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
  } catch {
    console.warn('[recent-records] Failed to remove recent record')
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
