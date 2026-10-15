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

/** @file Typed, feature-gated core help search. */
import apiClient from './client'
import { getUiApiVersion } from './ui-api-version'

/** A permission-filtered result from the core help index. */
export interface HelpSearchResult {
  kind: string
  key: string
  name: string
  table?: string
  process?: string
  label: string
  summary?: string
  text: string
  contentAsHtml?: string
  href?: string
}

/**
 * Searches only servers advertising the optional core help feature.
 * @param q - Search text.
 * @param limit - Maximum results.
 * @param signal - Cancellation signal.
 * @returns Permission-filtered help results, or an empty list on older servers.
 */
export async function searchHelp(
  q: string,
  limit = 10,
  signal?: AbortSignal
): Promise<HelpSearchResult[]> {
  if (q.trim().length < 2) return []
  const version = await getUiApiVersion()
  if (!version.features.includes('help') || signal?.aborted) return []
  const response = await apiClient.get<{ results: HelpSearchResult[] }>('/help/search', {
    params: { q: q.trim(), limit },
    signal,
  })
  return response.results
}
