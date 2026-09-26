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
 * @file Loads an external analytics script once per URL. The dashboard's Content-Security-Policy
 * allows only the origins of the providers the backend configures (QRun-IO/qqq#695, #730).
 */

const loads = new Map<string, Promise<void>>()

/**
 * Appends a script element once per URL.
 *
 * @param url - The script URL (resolved against this origin).
 * @param options - The element id and whether to request it in CORS mode.
 * @returns A promise settled when the script loads or fails.
 */
export function loadScript(url: string, options: { id?: string; crossOrigin?: boolean } = {}): Promise<void> {
  const resolved = new URL(url, window.location.origin).toString()
  const existing = loads.get(resolved)
  if (existing) return existing
  const load = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.type = 'text/javascript'
    if (options.id) script.id = options.id
    if (options.crossOrigin) script.crossOrigin = 'anonymous'
    script.src = resolved
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load analytics script: ${resolved}`))
    document.head.appendChild(script)
  })
  loads.set(resolved, load)
  return load
}
