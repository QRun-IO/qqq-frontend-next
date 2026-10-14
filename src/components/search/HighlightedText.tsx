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
 * @file HighlightedText — text with its matches wrapped in `<mark>`. Matches come from the
 * backend (ranges) or are found locally from the search term. Rendered as text nodes only.
 */

import React from 'react'

import type { RecordSearchMatch } from '@/lib/api/record-search'
import { findMatches, segmentText } from '@/lib/search/highlight'

/** Props for {@link HighlightedText}. */
export interface HighlightedTextProps {
  /** Text to show. */
  text: string
  /** Match ranges from the backend; when omitted, the term's words are found locally. */
  matches?: RecordSearchMatch[]
  /** Search text (used when `matches` is omitted). */
  term?: string
}

/**
 * Renders text with matched runs marked.
 *
 * @param props - Component properties.
 * @returns Text and `<mark>` elements.
 */
export function HighlightedText({ text, matches, term = '' }: HighlightedTextProps) {
  const segments = segmentText(text, matches ?? findMatches(text, term))
  return (
    <>
      {segments.map((segment, index) => (segment.match
        ? <mark key={index} className="rounded-sm bg-primary/20 px-px font-semibold text-foreground">{segment.text}</mark>
        : <React.Fragment key={index}>{segment.text}</React.Fragment>))}
    </>
  )
}
