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
 * @file search-failure — turns a failed record search, or a provider that fell back to the
 * default search, into an honest, specific message: what failed (the failure class), the
 * backend's own explanation, and whether retrying can help.
 */

import { isAxiosError } from 'axios'

import { RecordSearchResponseError, type RecordSearchProviderStatus } from '@/lib/api/record-search'

/** Class of a record search failure. */
export type SearchFailureKind =
  | 'offline'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'unsupported'
  | 'bad-request'
  | 'server'
  | 'invalid-response'
  | 'unknown'

/** A record search failure, described for the user. */
export interface SearchFailure {
  /** Failure class. */
  kind: SearchFailureKind
  /** Short headline, e.g. "Record search failed: server error (HTTP 500)". */
  title: string
  /** The backend's or browser's own explanation, when there is one. */
  detail?: string
  /** HTTP status, when the server answered. */
  status?: number
  /** Whether trying again may help. */
  retryable: boolean
}

/**
 * Shortens a message to one line of at most 200 characters.
 *
 * @param message - Raw message.
 * @returns The first line, truncated, or `undefined` when blank.
 */
function oneLine(message: string | undefined): string | undefined {
  const line = message?.split('\n')[0]?.trim()
  if (!line) return undefined
  return line.length > 200 ? `${line.slice(0, 199)}…` : line
}

/**
 * Describes why a record search request failed.
 *
 * @param error - The rejected value of the search request.
 * @returns The failure class and a message for the user.
 */
export function describeSearchFailure(error: unknown): SearchFailure {
  if (error instanceof RecordSearchResponseError) {
    return { kind: 'invalid-response', title: 'Record search failed: the server sent an unexpected response', retryable: false }
  }
  if (isAxiosError(error)) {
    const status = error.response?.status
    // the client interceptor puts the backend's own `error` text in the message
    const backend = status ? oneLine(error.message) : undefined
    const detail = backend && !/^Request failed with status code/.test(backend) ? backend : undefined
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return { kind: 'timeout', title: 'Record search failed: the server took too long to answer', retryable: true }
      }
      return { kind: 'offline', title: 'Record search failed: the server could not be reached', detail: oneLine(error.message), retryable: true }
    }
    if (status === 401) return { kind: 'unauthorized', title: 'Record search failed: your session has ended', detail, status, retryable: false }
    if (status === 403) return { kind: 'forbidden', title: 'Record search failed: permission denied', detail, status, retryable: false }
    if (status === 404 || status === 405 || status === 501) {
      return { kind: 'unsupported', title: 'Record search is not available on this server', detail, status, retryable: false }
    }
    if (status && status >= 400 && status < 500) {
      return { kind: 'bad-request', title: `Record search failed: the search was rejected (HTTP ${status})`, detail, status, retryable: false }
    }
    if (status === 504) return { kind: 'timeout', title: 'Record search failed: the server took too long to answer (HTTP 504)', detail, status, retryable: true }
    return { kind: 'server', title: `Record search failed: server error (HTTP ${status})`, detail, status, retryable: true }
  }
  return { kind: 'unknown', title: 'Record search failed', detail: error instanceof Error ? oneLine(error.message) : undefined, retryable: true }
}

/** A provider that failed while its tables still answered from the default search. */
export interface SearchFallback {
  /** Headline, e.g. "Search index unavailable". */
  title: string
  /** Failure class and message, e.g. "ConnectException: Connection refused". */
  detail?: string
}

/**
 * Describes a provider fallback, when the response reports one.
 *
 * @param provider - Provider status from the response.
 * @returns The fallback notice, or `undefined` when the provider was fine or absent.
 */
export function describeProviderFallback(provider: RecordSearchProviderStatus | undefined): SearchFallback | undefined {
  if (provider?.status !== 'FAILED') return undefined
  const message = oneLine(provider.message)
  const detail = [provider.failureClass, message].filter(Boolean).join(': ') || undefined
  return { title: 'Search index unavailable — showing basic matches instead', detail }
}
