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

/** @file Tools catalog contract and metadata-based navigation. */
import { z } from 'zod'
import type { QInstance } from '@/types'
import { buildRouteMap } from '@/lib/hooks/use-routes'

export const toolsCatalogSchema = z.object({
  serverUrl: z.string().nullish(),
  tools: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      summary: z.string(),
      platforms: z.string(),
      available: z.boolean(),
      downloadUrl: z.string().nullish(),
      downloadLabel: z.string(),
      guideUrl: z.string(),
      manageApp: z.string().nullish(),
      note: z.string(),
      steps: z.array(z.string()),
      commands: z.array(z.string()).default([]),
      installOptions: z
        .array(
          z.object({
            platform: z.string(),
            platformLabel: z.string(),
            method: z.string(),
            shell: z.string().default(''),
            instructions: z.string(),
            commands: z.array(z.string()).default([]),
          })
        )
        .default([]),
    })
  ),
})
export type Tool = z.infer<typeof toolsCatalogSchema>['tools'][number]

/** Find the visible app that hosts the tools widget, independent of app naming.
 * @param metadata - Permission-filtered instance metadata.
 * @returns The Tools destination, if visible.
 */
export function toolsTarget(metadata: QInstance | undefined) {
  return buildRouteMap(metadata).navTargets.find(
    (target) =>
      target.nodeType === 'APP' &&
      metadata?.apps[target.key]?.widgets?.some(
        (name) =>
          metadata.widgets[name]?.type === 'QQQ_TOOLS' &&
          metadata.widgets[name]?.hasPermission !== false
      )
  )
}

/** HTTPS external links only.
 * @param value - Configured download or guide URL.
 * @returns Safe external URL, or undefined.
 */
export function downloadLink(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}

/** Resolve the client-facing server root, retaining reverse-proxy path prefixes.
 * @param configured - Optional explicit public server root.
 * @param apiBase - Configured UI API base.
 * @param origin - Browser origin for relative API paths.
 * @returns Safe server root, or undefined when configuration is ambiguous.
 */
export function connectionUrl(
  configured: string | null | undefined,
  apiBase: string,
  origin: string
): string | undefined {
  try {
    const url = new URL(configured || apiBase, origin)
    if (!configured) {
      if (!url.pathname.replace(/\/+$/, '').endsWith('/qqq/v1')) return undefined
      url.pathname = url.pathname.replace(/\/qqq\/v1\/*$/, '')
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return undefined
    if (url.username || url.password || url.search || url.hash) return undefined
    const value = url.href.replace(/\/+$/, '')
    // Safe inside quoted shell commands on Windows, macOS and Linux.
    return /^https?:\/\/[A-Za-z0-9.:/_[\]~%+-]+$/.test(value) ? value : undefined
  } catch {
    return undefined
  }
}
