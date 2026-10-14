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

/** @file Canonical URL mapping for app-prefixed resource links. */

import type { QInstance } from '@/types'

/**
 * Removes one app prefix only when both names are known and the prefix is not a table.
 * The untouched suffix preserves encoded IDs, actions, query strings and fragments.
 * Each redirect removes a segment, so even repeated app names cannot loop.
 *
 * @param href - Local URL beginning with /app/.
 * @param metadata - Instance resource registries.
 * @returns The canonical URL, or null when the URL should remain unchanged.
 */
export function nestedAppUrl(href: string, metadata: Pick<QInstance, 'apps' | 'tables' | 'processes'>): string | null {
  const match = /^\/app\/([^/?#]+)\/([^/?#]+)(.*)$/.exec(href)
  if (!match) return null

  let appName: string
  let resourceName: string
  try {
    appName = decodeURIComponent(match[1])
    resourceName = decodeURIComponent(match[2])
  } catch {
    // Malformed URL encoding is not a resource name.
    return null
  }

  if (!Object.prototype.hasOwnProperty.call(metadata.apps ?? {}, appName) || Object.prototype.hasOwnProperty.call(metadata.tables ?? {}, appName)) return null
  const knownResource = [metadata.tables, metadata.processes, metadata.apps]
    .some((registry) => Object.prototype.hasOwnProperty.call(registry ?? {}, resourceName))
  return knownResource ? `/app/${match[2]}${match[3]}` : null
}
