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
 * @file The QQQ context of the current page for QA reports and Jam metadata: app, table, record
 * id and process, resolved from the `/app/<slug>[/<recordId>[/<action>]]` route against the
 * instance metadata, plus the metadata object Jam attaches to a capture (kept under 10 KB).
 */

import type { QaCaptureCapabilityV1 } from '@/types/qa-capture'
import type { RequestIdEntry } from './request-ids'
import { filterPageUrl } from './sanitizers'

/** The parts of the instance metadata the resolver reads. */
export interface RouteMetaData {
  apps?: Record<string, unknown>
  tables?: Record<string, unknown>
  processes?: Record<string, unknown>
  reports?: Record<string, unknown>
}

/** What the current page shows. */
export interface QaRouteContext {
  appName: string | null
  tableName: string | null
  recordId: string | null
  processName: string | null
}

/** Second path segments that are screens of a table rather than record ids. */
const TABLE_SCREENS = new Set(['create', 'dev', 'key', 'savedView'])

/**
 * Decodes one path segment.
 *
 * @param segment - The raw segment.
 * @returns The decoded segment.
 */
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Resolves the page's app, table, record and process from its path.
 *
 * @param pathname - The page path.
 * @param metaData - The instance metadata, when loaded.
 * @returns The context (nulls when unknown).
 */
export function resolveRouteContext(pathname: string, metaData: RouteMetaData | undefined | null): QaRouteContext {
  const context: QaRouteContext = { appName: null, tableName: null, recordId: null, processName: null }
  const segments = pathname.split('/').filter(Boolean).map(decode)
  if (segments[0] !== 'app' || !segments[1]) return context
  const [, slug, second, third] = segments
  if (metaData?.apps?.[slug]) context.appName = slug
  else if (metaData?.tables?.[slug]) {
    context.tableName = slug
    if (second && !TABLE_SCREENS.has(second)) context.recordId = second
    // /app/<table>/<id>/<process> launches a record action
    if (third && metaData.processes?.[third]) context.processName = third
  } else if (metaData?.processes?.[slug] || metaData?.reports?.[slug]) context.processName = slug
  return context
}

/** Most bytes of the Jam metadata object. */
export const METADATA_MAX_BYTES = 9_500

/**
 * The object Jam attaches to a capture: QQQ route context, versions, backend context, the last
 * request ids and the page path without sensitive query parameters. Request ids are dropped,
 * oldest first, until it fits {@link METADATA_MAX_BYTES}.
 *
 * @param input - The inputs.
 * @param input.capability - The enabled capability.
 * @param input.route - The route context.
 * @param input.href - The page URL.
 * @param input.requestIds - Recent request ids, oldest first.
 * @param input.reportReference - Reference of the report this capture belongs to, if any.
 * @returns A JSON-serializable object.
 */
export function buildJamMetadata(input: {
  capability: QaCaptureCapabilityV1
  route: QaRouteContext
  href: string
  requestIds: RequestIdEntry[]
  reportReference: string | null
}): Record<string, string | null | Record<string, string | null> | Array<Record<string, string | number>>> {
  const page = filterPageUrl(input.href, input.capability.sanitizer?.queryParamNames ?? [])
  let pagePath = page
  try {
    const url = new URL(page)
    pagePath = `${url.pathname}${url.search}`
  } catch {
    // keep as is
  }
  const clip = (value: string | null) => (value && value.length > 256 ? value.slice(0, 256) : value)
  let ids = input.requestIds.map((entry) => ({ id: entry.id.slice(0, 128), method: entry.method, path: entry.path.slice(0, 256), status: entry.status, at: entry.at }))
  const build = () => ({
    app: clip(input.route.appName),
    table: clip(input.route.tableName),
    recordId: clip(input.route.recordId),
    process: clip(input.route.processName),
    frontendVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    backend: {
      environment: clip(input.capability.context.environment),
      backendVersion: clip(input.capability.context.backendVersion),
      node: clip(input.capability.context.node),
    },
    reportReference: clip(input.reportReference),
    pagePath: pagePath.slice(0, 1024),
    requestIds: ids,
  })
  let metadata = build()
  const size = (value: object) => new TextEncoder().encode(JSON.stringify(value)).length
  while (ids.length && size(metadata) > METADATA_MAX_BYTES) {
    ids = ids.slice(Math.max(1, Math.ceil(ids.length / 4)))
    metadata = build()
  }
  return metadata
}
