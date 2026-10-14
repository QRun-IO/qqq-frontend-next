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
 * @file internal-app-href — the same-origin `/app` link check shared by the assistant panel and
 * collaboration favorites. Model text, record data and saved favorites are untrusted, so only
 * same-origin `/app` paths ever become links.
 */

/**
 * Returns the in-app path for a link the assistant may render, or null when the link must be
 * shown as plain text: anything that is not a same-origin path under `/app` (other origins,
 * protocol-relative and backslash tricks, `javascript:`, control characters).
 *
 * @param href - A link from model text, a record reference or a render payload.
 * @param origin - The page origin (defaults to `window.location.origin`).
 * @returns The path with its query and hash (e.g. `/app/person/1?x=1#audit`), or null.
 */
export function internalAppHref(href: string | null | undefined, origin?: string): string | null {
  if (typeof href !== 'string') return null
  const trimmed = href.trim()
  if (!trimmed || /[\u0000-\u001f\u007f\\]/.test(trimmed)) return null
  const base = origin ?? (typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
  let url: URL
  try {
    url = new URL(trimmed, base)
  } catch {
    return null
  }
  if (url.origin !== new URL(base).origin) return null
  if (!trimmed.startsWith('/') && !/^https?:\/\//i.test(trimmed)) return null
  if (trimmed.startsWith('//')) return null
  if (url.pathname !== '/app' && !url.pathname.startsWith('/app/')) return null
  return `${url.pathname}${url.search}${url.hash}`
}
