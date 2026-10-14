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
 * @file highlight — splits text into matched and unmatched segments, from backend match
 * ranges or by finding the search term's words locally. Pure string work: the result is
 * rendered as text nodes and `<mark>` elements, never as HTML.
 */

import type { RecordSearchMatch } from '@/lib/api/record-search'

/** A run of text that did or did not match the search. */
export interface TextSegment {
  /** The text. */
  text: string
  /** Whether it matched. */
  match: boolean
}

/**
 * The distinct, lowercased words of a search term, longest first (so a longer word wins
 * where two overlap).
 *
 * @param term - Search text.
 * @returns Words to highlight.
 */
export function termTokens(term: string): string[] {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean)
  return [...new Set(words)].sort((a, b) => b.length - a.length)
}

/**
 * Finds every occurrence of the term's words in a text (case-insensitive), merging
 * overlapping and adjacent occurrences.
 *
 * @param text - Text to search.
 * @param term - Search text.
 * @returns Sorted, non-overlapping match ranges.
 */
export function findMatches(text: string, term: string): RecordSearchMatch[] {
  const haystack = text.toLowerCase()
  const found: RecordSearchMatch[] = []
  for (const token of termTokens(term)) {
    for (let at = haystack.indexOf(token); at >= 0; at = haystack.indexOf(token, at + token.length)) {
      found.push({ start: at, end: at + token.length })
    }
  }
  found.sort((a, b) => a.start - b.start)
  const merged: RecordSearchMatch[] = []
  for (const match of found) {
    const last = merged[merged.length - 1]
    if (last && match.start <= last.end) last.end = Math.max(last.end, match.end)
    else merged.push({ ...match })
  }
  return merged
}

/**
 * Splits text into segments at the given match ranges. Ranges are assumed valid
 * (in bounds, sorted, non-overlapping; see `validMatches`).
 *
 * @param text - Text to split.
 * @param matches - Match ranges.
 * @returns Alternating unmatched and matched segments (empty segments omitted).
 */
export function segmentText(text: string, matches: RecordSearchMatch[]): TextSegment[] {
  const segments: TextSegment[] = []
  let at = 0
  for (const match of matches) {
    if (match.start > at) segments.push({ text: text.slice(at, match.start), match: false })
    segments.push({ text: text.slice(match.start, match.end), match: true })
    at = match.end
  }
  if (at < text.length) segments.push({ text: text.slice(at), match: false })
  return segments
}
