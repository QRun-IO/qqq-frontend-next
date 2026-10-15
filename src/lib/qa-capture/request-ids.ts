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
 * @file The last request ids the backend returned (`X-Request-Id`, or the header the QA capture
 * capability names), so a bug report can point at the server logs. Collected only while QA
 * capture is enabled; disabling clears the buffer.
 */

import type { AxiosInstance, AxiosResponse } from 'axios'
import { isAxiosError } from 'axios'

/** One API response's request id. */
export interface RequestIdEntry {
  id: string
  method: string
  /** Path without query string. */
  path: string
  status: number
  /** ISO timestamp. */
  at: string
}

/** Entries kept. */
export const REQUEST_ID_CAPACITY = 50

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

let entries: RequestIdEntry[] = []
let headerName: string | null = null

/**
 * Starts (with a header name) or stops (null) collecting. Stopping clears the buffer.
 *
 * @param header - The response header carrying the request id, or null to stop.
 */
export function setRequestIdCollection(header: string | null): void {
  headerName = header ? header.toLowerCase() : null
  if (!headerName) entries = []
}

/**
 * Whether ids are being collected.
 *
 * @returns True while enabled.
 */
export function isCollectingRequestIds(): boolean {
  return headerName !== null
}

/**
 * Records one response, if collection is on and it carries a valid id.
 *
 * @param entry - The response's method, URL, status and headers.
 * @param entry.method - HTTP method.
 * @param entry.url - Request URL (absolute or relative to the page).
 * @param entry.status - HTTP status.
 * @param entry.headers - Response headers.
 * @param now - Clock (tests).
 */
export function recordRequestId(
  entry: { method?: string; url?: string; status?: number; headers?: unknown },
  now: () => Date = () => new Date()
): void {
  if (!headerName) return
  const id = readHeader(entry.headers, headerName)
  if (!id || !ID_PATTERN.test(id)) return
  entries.push({
    id,
    method: (entry.method ?? 'GET').toUpperCase(),
    path: pathOf(entry.url ?? ''),
    status: entry.status ?? 0,
    at: now().toISOString(),
  })
  if (entries.length > REQUEST_ID_CAPACITY) entries = entries.slice(-REQUEST_ID_CAPACITY)
}

/**
 * The collected entries, oldest first.
 *
 * @returns A copy of the buffer.
 */
export function recentRequestIds(): RequestIdEntry[] {
  return entries.slice()
}

/**
 * Reads a header from axios headers (an AxiosHeaders instance or a plain object).
 *
 * @param headers - The headers.
 * @param name - Lowercase header name.
 * @returns The value, or null.
 */
function readHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== 'object') return null
  const getter = (headers as { get?: unknown }).get
  if (typeof getter === 'function') {
    const value: unknown = (getter as (n: string) => unknown).call(headers, name)
    if (typeof value === 'string') return value
  }
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() === name && typeof value === 'string') return value
  }
  return null
}

/**
 * The path of a URL, without query or hash.
 *
 * @param url - Any URL.
 * @returns The path.
 */
function pathOf(url: string): string {
  try {
    return new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin).pathname
  } catch {
    return url.split(/[?#]/)[0]
  }
}

/**
 * Records a completed axios response.
 *
 * @param client - The axios instance (for the full URL).
 * @param response - The response.
 */
function recordAxiosResponse(client: AxiosInstance, response: AxiosResponse | undefined): void {
  if (!response || !headerName) return
  let url = response.config?.url ?? ''
  try {
    url = client.getUri(response.config)
  } catch {
    // keep the relative url
  }
  recordRequestId({ method: response.config?.method, url, status: response.status, headers: response.headers })
}

const installed = new WeakSet<AxiosInstance>()

/**
 * Adds a response interceptor that records request ids (success and error responses). It does
 * nothing while collection is off. Idempotent per instance.
 *
 * @param client - The axios instance.
 */
export function installRequestIdInterceptor(client: AxiosInstance): void {
  if (installed.has(client)) return
  installed.add(client)
  client.interceptors.response.use(
    (response) => {
      recordAxiosResponse(client, response)
      return response
    },
    (error: unknown) => {
      if (isAxiosError(error)) recordAxiosResponse(client, error.response)
      return Promise.reject(error)
    }
  )
}

/** Clears the buffer and stops collecting (tests). */
export function resetRequestIds(): void {
  entries = []
  headerName = null
}
