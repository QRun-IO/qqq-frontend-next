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

/** @file Shared discovery of registered UI API extensions. */

import { useQuery } from '@tanstack/react-query'
import { getUiApiVersion, type UiApiVersionInfo } from './ui-api-version'

/** Extension names published by the UI API contract. */
export const UI_API_EXTENSION = {
  alerts: 'alerts',
  assistant: 'assistant',
  sqlWorkbench: 'sql-workbench',
  esb: 'esb',
  collaboration: 'collaboration',
  dataAnalysis: 'data-analysis',
  quickSearch: 'quick-search',
} as const

/**
 * Query key of the shared version query (`['qqq', 'ui-api-version']`). Kept here rather than in
 * `queryKeys` so the test setup can reset discovery without importing the query client, whose
 * toast import injects styles into every test document.
 */
export const UI_API_VERSION_QUERY_KEY = ['qqq', 'ui-api-version'] as const

let version: Promise<UiApiVersionInfo> | null = null

/** Shares discovery across imperative callers and React queries, retrying after errors.
 * @returns The shared version request.
 */
function loadVersion(): Promise<UiApiVersionInfo> {
  if (!version) {
    const pending = getUiApiVersion().catch((error: unknown) => {
      if (version === pending) version = null
      throw error
    })
    version = pending
  }
  return version
}

/** Checks registration, returning false if discovery fails.
 * @param name - The extension's registered name.
 * @returns Whether the server announces the extension.
 */
export async function isUiApiExtensionInstalled(name: string): Promise<boolean> {
  try {
    return (await loadVersion()).extensions.some((extension) => extension?.name === name)
  } catch {
    return false
  }
}

/** Checks a core feature listed by `GET /version` (for example `preferences`), returning false if discovery fails.
 * @param name - The core feature name.
 * @returns Whether the server announces the feature.
 */
export async function isUiApiFeatureSupported(name: string): Promise<boolean> {
  try {
    return (await loadVersion()).features.includes(name)
  } catch {
    return false
  }
}

/** Forgets discovery for tests or a server change; also clear the session's QueryClient on server changes. */
export function resetUiApiExtensions(): void {
  version = null
}

/** Observes the shared version query; unavailable while loading, disabled, or failed.
 * @param name - The extension's registered name.
 * @param enabled - Whether discovery is enabled.
 * @returns Whether the server announces the extension.
 */
export function useUiApiExtensionInstalled(name: string, enabled = true): boolean {
  const { data, isError } = useQuery({
    queryKey: UI_API_VERSION_QUERY_KEY,
    queryFn: loadVersion,
    enabled,
    staleTime: Infinity,
    retry: false,
  })
  return enabled && !isError && Boolean(data?.extensions.some((extension) => extension?.name === name))
}

/** Observes a core capability using the shared server discovery query.
 * @param name - Feature name from the version response.
 * @returns Whether the server advertises the feature.
 */
export function useUiApiFeatureSupported(name: string): boolean {
  const { data } = useQuery({ queryKey: UI_API_VERSION_QUERY_KEY, queryFn: loadVersion, staleTime: Infinity, retry: false })
  return data?.features.includes(name) ?? false
}
