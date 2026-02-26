// Recently viewed records tracker — persists to localStorage
// Used by GlobalSearch to show recent items when no search term is entered

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
 * Deduplicates by path — if the same path already exists, updates the timestamp.
 * Trims the list to MAX_RECORDS entries.
 */
export function addRecentRecord(record: Omit<RecentRecord, 'viewedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    const existing = getRecentRecords()

    // Remove any existing entry with the same path (deduplication)
    const filtered = existing.filter((r) => r.path !== record.path)

    // Prepend the new record with current timestamp
    const updated: RecentRecord[] = [
      { ...record, viewedAt: Date.now() },
      ...filtered,
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
