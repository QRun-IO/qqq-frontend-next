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
 * @file recent-searches — the user's recent search terms, newest first, in localStorage.
 * Storage may be unavailable (private windows, blocked site data): every access is guarded
 * and search works the same without it.
 */

const STORAGE_KEY = 'qqq-recent-searches'

/** Most terms kept. */
export const MAX_RECENT_SEARCHES = 8

/**
 * Reads the recent search terms.
 *
 * @returns Terms, newest first (empty when storage is unavailable or corrupt).
 */
export function getRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((term): term is string => typeof term === 'string' && term.trim() !== '').slice(0, MAX_RECENT_SEARCHES) : []
  } catch {
    return []
  }
}

/**
 * Writes the recent search terms.
 *
 * @param terms - Terms, newest first.
 */
function write(terms: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(terms.slice(0, MAX_RECENT_SEARCHES)))
  } catch {
    // storage unavailable: recent searches are a convenience
  }
}

/**
 * Records a search term as the most recent (case-insensitive duplicates move to the top).
 *
 * @param term - Search text; blank terms are ignored.
 * @returns The updated terms.
 */
export function addRecentSearch(term: string): string[] {
  const trimmed = term.trim()
  if (!trimmed) return getRecentSearches()
  const terms = [trimmed, ...getRecentSearches().filter((existing) => existing.toLowerCase() !== trimmed.toLowerCase())]
  write(terms)
  return terms.slice(0, MAX_RECENT_SEARCHES)
}

/**
 * Removes one recent search term.
 *
 * @param term - Term to remove.
 * @returns The updated terms.
 */
export function removeRecentSearch(term: string): string[] {
  const terms = getRecentSearches().filter((existing) => existing !== term)
  write(terms)
  return terms
}

/**
 * Removes every recent search term.
 */
export function clearRecentSearches(): void {
  write([])
}
