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
 * @file Post-login return path validation (open-redirect guard).
 */

/**
 * Returns a same-origin, in-app path for a post-login redirect, or `fallback`.
 *
 * Rejects absolute and protocol-relative URLs (`//host`, `/\host`), non-http
 * schemes and the login page itself, also when they only appear after the URL is
 * normalized (`/.//host` and `/app/..//host` normalize to `//host`, which a
 * navigation would treat as another origin; QRun-IO/qqq#696). The value is used
 * as-is: `URLSearchParams` has already decoded it once, and decoding again would
 * corrupt encoded query values.
 *
 * @param raw - The `returnTo` value from the URL or storage.
 * @param origin - The application origin (defaults to `window.location.origin`).
 * @param fallback - Path used when `raw` is missing or unsafe.
 * @returns A path beginning with a single `/`.
 */
export function safeReturnTo(raw: string | null | undefined, origin?: string, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  const base = origin ?? (typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return fallback
  }
  if (url.origin !== new URL(base).origin) return fallback
  if (url.pathname.startsWith('//') || url.pathname.startsWith('/\\')) return fallback
  if (/^\/(login|token|callback)(\/|$)/.test(url.pathname)) return fallback
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * The current page as a `returnTo` value.
 *
 * @returns pathname + search of the current location.
 */
export function currentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}`
}
