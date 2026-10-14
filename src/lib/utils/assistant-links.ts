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
 * @file assistant-links — link safety and page context for the assistant panel. Model text
 * and record data are untrusted (prompt injection), so only same-origin `/app` paths ever
 * become links, and the page context sent with a turn is derived from the URL alone.
 */

import type { QInstance } from '@/types'
import type { AssistantPageContext } from '@/types/assistant'
import { deserializeFilter, isFilterEmpty } from './filter-utils'

// Kept apart so link checks (collaboration favorites) do not load the filter code below.
export { internalAppHref } from './internal-app-href'

/** A record or table screen the user is on, with what to call it. */
export interface AssistantPageInfo {
  /** Sent with the turn as a hint. */
  context: AssistantPageContext
  /** Shown on the composer chip after "On: ". */
  label: string
}

/**
 * Derives the page context from the current location: the table of a query or record
 * screen, the record id, and the query filter from the `filter` parameter.
 *
 * @param pathname - The current path.
 * @param search - The current query string (`?filter=...`), or empty.
 * @param metaData - Instance metadata, to tell tables from apps and processes.
 * @param recordLabel - The record's label when known (recently viewed records).
 * @returns The page info, or null when the page is not a table screen.
 */
export function assistantPageInfo(pathname: string, search: string, metaData: QInstance | undefined, recordLabel?: string): AssistantPageInfo | null {
  const segments = pathname.split('/').filter(Boolean).map(safeDecode)
  if (segments[0] !== 'app' || !segments[1]) return null
  const table = metaData?.tables?.[segments[1]]
  if (!table) return null
  const rest = segments.slice(2)
  const route = pathname
  if (rest.length === 0 || (rest[0] === 'savedView' && rest.length === 2)) {
    const filterParam = new URLSearchParams(search).get('filter')
    const filter = filterParam ? deserializeFilter(filterParam) : null
    if (filter && !isFilterEmpty(filter)) {
      return {
        context: { route, tableName: table.name, filter: { criteria: filter.criteria, subFilters: filter.subFilters, booleanOperator: filter.booleanOperator } },
        label: `${table.label} (filtered)`,
      }
    }
    return { context: { route, tableName: table.name }, label: table.label }
  }
  if (rest.length >= 1 && !['create', 'dev', 'key', 'savedView'].includes(rest[0])) {
    return {
      context: { route, tableName: table.name, recordId: rest[0] },
      label: recordLabel ? `${recordLabel} (${table.label})` : `${table.label} #${rest[0]}`,
    }
  }
  return { context: { route, tableName: table.name }, label: table.label }
}

/**
 * Decodes one path segment, keeping it as-is when it is malformed.
 *
 * @param segment - A path segment.
 * @returns The decoded segment.
 */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
