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
 * @file The page URL a QA report and the Jam metadata carry, without sensitive query parameters.
 * Kept apart from the sanitizers, which load only with Jam.
 */

/** Query parameters always redacted (OAuth2 callback values). */
export const BASELINE_QUERY_PARAM_NAMES = ['code', 'state', 'access_token', 'id_token']

/**
 * The page URL to report: same path, with the configured query parameters and every `jam-*`
 * parameter removed.
 *
 * @param href - The page URL.
 * @param queryParamNames - Parameters to remove (case-insensitive).
 * @returns The filtered URL.
 */
export function filterPageUrl(href: string, queryParamNames: string[]): string {
  const names = new Set([...BASELINE_QUERY_PARAM_NAMES, ...queryParamNames].map((name) => name.toLowerCase()))
  try {
    const url = new URL(href)
    const params = new URLSearchParams()
    for (const [key, value] of url.searchParams) {
      if (!names.has(key.toLowerCase()) && !key.startsWith('jam-')) params.append(key, value)
    }
    url.search = params.toString()
    return url.href
  } catch {
    return href.split('?')[0]
  }
}
