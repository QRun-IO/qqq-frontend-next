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
 * @file Jam capture sanitizers built from the server's rules (`capability.sanitizer`). Pure,
 * synchronous and deterministic (Jam runs a request sanitizer twice per request); they never log
 * or fetch. When a rule cannot be applied (an invalid value pattern) the affected sanitizers
 * throw, and Jam then redacts the data they cover (fail closed).
 *
 * A small baseline is always applied on top of the server's rules: credential headers, the QQQ
 * session and token body fields, and JWTs.
 */

import type {
  ConsoleLog,
  JamSanitizerOptions,
  JsonValue,
  NetworkRequest,
  NetworkResponse,
  WebSocketMessage,
} from '@jam.dev/recording-links/sdk'
import type { QaCaptureSanitizerV1 } from '@/types/qa-capture'
import { BASELINE_QUERY_PARAM_NAMES } from './page-url'

/** Headers always removed, whatever the server's rules say. */
export const BASELINE_HEADER_NAMES = ['authorization', 'proxy-authorization', 'cookie', 'set-cookie']

/** Body fields always redacted (compared case-insensitively). */
export const BASELINE_BODY_FIELD_NAMES = ['password', 'sessionUUID', 'accessToken', 'refreshToken', 'idToken', 'clientSecret', 'code_verifier']


/** JWTs, always redacted. */
export const BASELINE_VALUE_PATTERNS = ['eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+']

/** The rules after merging the baseline, ready to apply. */
export interface CompiledRules {
  redaction: string
  headerNames: Set<string>
  bodyFieldNames: Set<string>
  queryParamNames: Set<string>
  patterns: RegExp[]
  /** Set when a server pattern is not a valid RegExp: sanitizers that apply patterns then throw. */
  invalidPattern: string | null
  dropPathPrefixes: string[]
  origin: string
}

/**
 * Lower-cased set of names.
 *
 * @param lists - Name lists.
 * @returns The set.
 */
function lowerSet(...lists: string[][]): Set<string> {
  return new Set(lists.flat().map((name) => name.toLowerCase()))
}

/**
 * Merges the baseline into the server's rules and compiles the patterns.
 *
 * @param rules - The server's sanitizer rules.
 * @param origin - This page's origin (for same-origin path prefixes).
 * @returns The compiled rules.
 */
export function compileRules(rules: QaCaptureSanitizerV1, origin: string): CompiledRules {
  const patterns: RegExp[] = []
  let invalidPattern: string | null = null
  for (const source of [...BASELINE_VALUE_PATTERNS, ...rules.valuePatterns]) {
    if (!source) continue
    try {
      patterns.push(new RegExp(source, 'g'))
    } catch {
      invalidPattern ??= source
    }
  }
  return {
    redaction: rules.redaction || '[redacted]',
    headerNames: lowerSet(BASELINE_HEADER_NAMES, rules.headerNames),
    bodyFieldNames: lowerSet(BASELINE_BODY_FIELD_NAMES, rules.bodyFieldNames),
    queryParamNames: lowerSet(BASELINE_QUERY_PARAM_NAMES, rules.queryParamNames),
    patterns,
    invalidPattern,
    dropPathPrefixes: rules.dropPathPrefixes.filter((prefix) => prefix.startsWith('/')),
    origin,
  }
}

/**
 * Throws when the rules have an invalid pattern, so Jam redacts the data instead.
 *
 * @param rules - The compiled rules.
 */
function assertPatterns(rules: CompiledRules): void {
  if (rules.invalidPattern !== null) throw new Error('QA capture: invalid value pattern')
}

/**
 * Applies the value patterns to a string.
 *
 * @param text - Any text.
 * @param rules - The compiled rules.
 * @returns The text with every match replaced.
 */
export function redactText(text: string, rules: CompiledRules): string {
  assertPatterns(rules)
  let result = text
  for (const pattern of rules.patterns) {
    pattern.lastIndex = 0
    result = result.replace(pattern, rules.redaction)
  }
  return result
}

/**
 * Redacts a parsed JSON value: the values of matching keys at any depth (whatever their type)
 * and pattern matches in every string. Returns a new value.
 *
 * @param value - Any JSON value.
 * @param rules - The compiled rules.
 * @returns The redacted copy.
 */
export function redactJson(value: JsonValue, rules: CompiledRules): JsonValue {
  if (typeof value === 'string') return redactText(value, rules)
  if (Array.isArray(value)) return value.map((item) => redactJson(item, rules))
  if (value && typeof value === 'object') {
    const result: Record<string, JsonValue> = {}
    for (const [key, item] of Object.entries(value)) {
      result[key] = rules.bodyFieldNames.has(key.toLowerCase()) ? rules.redaction : redactJson(item, rules)
    }
    return result
  }
  return value
}

const FORM_BODY = /^[^=&\s{}[\]"]+=[^&\s]*(?:&[^=&\s]+=[^&\s]*)*$/

/**
 * Redacts a body: JSON stays valid JSON, form-encoded stays form-encoded, anything else gets the
 * value patterns.
 *
 * @param body - The body text.
 * @param rules - The compiled rules.
 * @returns The redacted body.
 */
export function redactBody(body: string, rules: CompiledRules): string {
  assertPatterns(rules)
  const trimmed = body.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: JsonValue | undefined
    try {
      parsed = JSON.parse(trimmed) as JsonValue
    } catch {
      parsed = undefined
    }
    if (parsed !== undefined) return JSON.stringify(redactJson(parsed, rules))
  }
  if (FORM_BODY.test(trimmed)) {
    const params = new URLSearchParams(trimmed)
    const result = new URLSearchParams()
    for (const [key, value] of params) {
      result.append(key, rules.bodyFieldNames.has(key.toLowerCase()) ? rules.redaction : redactText(value, rules))
    }
    return result.toString()
  }
  return redactText(body, rules)
}

/**
 * Redacts the configured query parameters (and value patterns in parameter values) of a URL,
 * keeping a relative URL relative.
 *
 * @param url - The URL.
 * @param rules - The compiled rules.
 * @returns The redacted URL.
 */
export function redactUrl(url: string, rules: CompiledRules): string {
  let parsed: URL
  try {
    parsed = new URL(url, rules.origin)
  } catch {
    return redactText(url, rules)
  }
  if (parsed.search) {
    const params = new URLSearchParams()
    for (const [key, value] of parsed.searchParams) {
      params.append(key, rules.queryParamNames.has(key.toLowerCase()) ? rules.redaction : redactText(value, rules))
    }
    parsed.search = params.toString()
  }
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
  const result = absolute ? parsed.href : `${parsed.pathname}${parsed.search}${parsed.hash}`
  return redactText(result, rules)
}

/**
 * Removes the configured headers. Returns a new object.
 *
 * @param headers - Headers with lowercase names.
 * @param rules - The compiled rules.
 * @returns The remaining headers.
 */
export function redactHeaders(headers: Record<string, string>, rules: CompiledRules): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (!rules.headerNames.has(name.toLowerCase())) result[name] = value
  }
  return result
}

/**
 * Whether a URL is on this origin under one of the drop prefixes.
 *
 * @param url - The request URL.
 * @param rules - The compiled rules.
 * @returns True when its bodies must be dropped.
 */
export function isDroppedPath(url: string, rules: CompiledRules): boolean {
  if (!rules.dropPathPrefixes.length) return false
  try {
    const parsed = new URL(url, rules.origin)
    return parsed.origin === rules.origin && rules.dropPathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))
  } catch {
    return false
  }
}

/**
 * Builds the four Jam sanitizers.
 *
 * @param sanitizer - The server's rules.
 * @param origin - This page's origin.
 * @returns Options to spread into `jam.initialize`.
 */
export function buildJamSanitizers(sanitizer: QaCaptureSanitizerV1, origin: string): Required<JamSanitizerOptions> {
  const rules = compileRules(sanitizer, origin)
  return {
    network: {
      requestSanitizer: (request: NetworkRequest): NetworkRequest => {
        const dropped = isDroppedPath(request.url, rules)
        return {
          ...request,
          url: redactUrl(request.url, rules),
          headers: redactHeaders(request.headers, rules),
          body: dropped || request.body === undefined ? undefined : redactBody(request.body, rules),
        }
      },
      responseSanitizer: (response: NetworkResponse): NetworkResponse => {
        const dropped = isDroppedPath(response.url, rules)
        return {
          ...response,
          headers: redactHeaders(response.headers, rules),
          body: dropped || response.body === undefined ? undefined : redactBody(response.body, rules),
        }
      },
      webSocketSanitizer: (message: WebSocketMessage): WebSocketMessage => ({ ...message, data: redactBody(message.data, rules) }),
    },
    console: {
      logSanitizer: (log: ConsoleLog): ConsoleLog => ({ ...log, args: log.args.map((arg) => redactJson(arg, rules)) }),
    },
  }
}
