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
 * @file assistant-deep-link — the `?assistant=open&assistantPrompt=<text>` link that opens the
 * assistant on a page with a pre-filled prompt (the record Developer screen links to it).
 */

/**
 * Reads the assistant deep link `?assistant=open&assistantPrompt=<text>` from a query string.
 *
 * @param search - The query string (with or without `?`).
 * @returns The prompt (may be empty) and the query string without both parameters (`?...` or
 *   empty), or null when the link is absent.
 */
export function readAssistantDeepLink(search: string): { prompt: string; remainingSearch: string } | null {
  const params = new URLSearchParams(search)
  if (params.get('assistant') !== 'open') return null
  const prompt = (params.get('assistantPrompt') ?? '').trim()
  params.delete('assistant')
  params.delete('assistantPrompt')
  const rest = params.toString()
  return { prompt, remainingSearch: rest ? `?${rest}` : '' }
}
