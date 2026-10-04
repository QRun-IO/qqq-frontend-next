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
 * @file Security headers of the standalone (container image) Next server (QRun-IO/qqq#734):
 * the headers the QQQ server sends with the dashboard export it hosts (NextDashboardRouteProvider
 * and NextDashboardSecurityHeaders, QRun-IO/qqq#695). Every dashboard response gets
 * X-Frame-Options, Referrer-Policy, Permissions-Policy and nosniff; each HTML document also gets
 * a Content-Security-Policy whose script-src lists the SHA-256 hash of each inline script of
 * that document. Responses the server forwards from the QQQ backend keep the backend's headers.
 */

import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'

/** Backend route prefixes the standalone server forwards (shared with next.config.ts). */
export const BACKEND_PREFIXES = createRequire(import.meta.url)('./backend-prefixes.json')

/** The policy directives and their default sources, in the order the QQQ server sends them. */
export const DEFAULT_DIRECTIVES = [
  ['default-src', ["'self'"]],
  ['script-src', ["'self'"]],
  ['style-src', ["'self'", "'unsafe-inline'"]],
  ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
  ['font-src', ["'self'", 'data:']],
  ['connect-src', ["'self'"]],
  ['frame-src', ["'self'"]],
  ['worker-src', ["'self'", 'blob:']],
  ['manifest-src', ["'self'"]],
  ['media-src', ["'self'", 'data:', 'blob:']],
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'self'"]],
  ['frame-ancestors', ["'none'"]],
]

/** Browser features the dashboard never uses. */
export const DEFAULT_PERMISSIONS_POLICY = ['accelerometer', 'camera', 'display-capture', 'geolocation', 'gyroscope', 'hid',
  'magnetometer', 'microphone', 'midi', 'payment', 'serial', 'usb'].map((feature) => `${feature}=()`).join(', ')

/** Headers on every dashboard response. */
export const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': DEFAULT_PERMISSIONS_POLICY,
  'X-Content-Type-Options': 'nosniff',
}

export const CONTENT_SECURITY_POLICY = 'Content-Security-Policy'

const DIRECTIVE_NAME = /^[a-z][a-z0-9-]*$/
const SOURCE_TOKEN = /^[^\s;,]+$/
const SCRIPT_ELEMENT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
const SRC_ATTRIBUTE = /(^|\s)src\s*=/i

/**
 * Whether a request path is one the server forwards to the QQQ backend.
 *
 * @param {string} url - The request URL (path and query).
 * @returns {boolean} True for backend routes.
 */
export function isBackendPath(url) {
  const path = new URL(url, 'http://dashboard.invalid').pathname
  return BACKEND_PREFIXES.some((prefix) => path === `/${prefix}` || path.startsWith(`/${prefix}/`))
}

/**
 * The origin (scheme, host and port) of an http(s) URL.
 *
 * @param {unknown} url - The URL.
 * @returns {string | null} The origin, or null when the value is not an http(s) URL.
 */
export function originOf(url) {
  if (typeof url !== 'string' || !url.trim()) return null
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null
  } catch {
    return null
  }
}

/**
 * Origins of the identity provider the browser calls (OIDC discovery for OAUTH2, the token
 * exchange for AUTH_0), from `GET /qqq/v1/metaData/authentication`, as the QQQ server does.
 *
 * @param {unknown} authentication - The authentication metadata.
 * @returns {string[]} Zero or one origin.
 */
export function identityProviderOrigins(authentication) {
  const { type, values } = /** @type {{ type?: unknown; values?: { baseUrl?: unknown } }} */ (authentication ?? {})
  if (type !== 'OAUTH2' && type !== 'AUTH_0') return []
  const origin = originOf(values?.baseUrl)
  return origin ? [origin] : []
}

/**
 * Parses the deployment's policy additions (`QQQ_DASHBOARD_CSP_SOURCES`), the standalone
 * server's counterpart of the QQQ server's `withNextDashboardSecurityHeadersCustomizer`:
 * `directive source source; directive source`, for example
 * `frame-src https://*.quicksight.aws.amazon.com; script-src https://cdn.example.com`.
 *
 * @param {string | undefined} text - The value.
 * @returns {[string, string[]][]} Each directive with the sources to add.
 * @throws {Error} When a directive name or source is malformed.
 */
export function parseSourceAdditions(text) {
  const additions = []
  for (const part of (text ?? '').split(';')) {
    const [directive, ...sources] = part.trim().split(/\s+/).filter(Boolean)
    if (!directive) continue
    if (!DIRECTIVE_NAME.test(directive)) throw new Error(`Invalid Content-Security-Policy directive name: ${directive}`)
    for (const source of sources) {
      if (!SOURCE_TOKEN.test(source)) throw new Error(`Invalid Content-Security-Policy source expression: ${source}`)
    }
    additions.push([directive, sources])
  }
  return additions
}

/**
 * The CSP hash sources of the inline scripts in an HTML document. Line breaks are normalized
 * first, as the HTML parser does before hashing.
 *
 * @param {string} html - The document.
 * @returns {string[]} One `'sha256-...'` source per distinct inline script, in document order.
 */
export function inlineScriptHashes(html) {
  const hashes = new Set()
  for (const [, attributes, body] of html.matchAll(SCRIPT_ELEMENT)) {
    if (SRC_ATTRIBUTE.test(attributes)) continue
    hashes.add(`'sha256-${createHash('sha256').update(body.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`)
  }
  return [...hashes]
}

const SOURCE_FIELDS = { connectSrc: 'connect-src', scriptSrc: 'script-src', frameSrc: 'frame-src', styleSrc: 'style-src' }
const SPECIAL_SOURCES = {
  connectSrc: new Set(['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://accounts.google.com/gsi/']),
  scriptSrc: new Set(['https://accounts.google.com/gsi/client']),
  frameSrc: new Set(['https://*.quicksight.aws.amazon.com', 'https://accounts.google.com/gsi/']),
  styleSrc: new Set(['https://accounts.google.com/gsi/style']),
}

/**
 * Copies four lists of at most 64 sources of 512 characters each. Invalid or
 * oversized metadata is rejected as a whole; refresh retains the last valid inputs.
 * Only origins and the backend's fixed wildcard/path constants are admitted.
 * @param {unknown} value - The backend's optional source object.
 * @returns {Record<string, string[]> | undefined} Validated source lists.
 */
function validatedDashboardSources(value) {
  if (value === undefined) return undefined
  const invalid = () => { throw new Error('Invalid dashboard CSP source metadata') }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const fields = Object.keys(value)
  if (fields.length !== 4 || fields.some((field) => !Object.hasOwn(SOURCE_FIELDS, field))) return invalid()
  const copied = {}
  for (const field of Object.keys(SOURCE_FIELDS)) {
    const sources = value[field]
    if (!Array.isArray(sources) || sources.length > 64) return invalid()
    copied[field] = sources.map((source) => {
      if (typeof source !== 'string' || source.length > 512 || /[\s;,'"?#@\\]/.test(source)) return invalid()
      if (SPECIAL_SOURCES[field].has(source)) return source
      if (source.includes('*')) return invalid()
      try {
        const url = new URL(source)
        const origin = /^(https?):\/\/(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?$/.exec(source)
        if (!origin || !['http:', 'https:'].includes(url.protocol)) return invalid()
        if (!origin[2].startsWith('[') && url.hostname !== origin[2]) return invalid()
        if (origin[3] && Number(origin[3]) > 65535) return invalid()
      } catch { return invalid() }
      return source
    })
  }
  return copied
}

/**
 * Builds a document's Content-Security-Policy: the defaults, the identity provider origins
 * (connect-src), the deployment's additions, then the document's inline script hashes.
 *
 * @param {object} options - The policy inputs.
 * @param {string[]} [options.connectOrigins] - Identity provider origins.
 * @param {[string, string[]][]} [options.additions] - The deployment's additions.
 * @param {unknown} [options.dashboardCspSources] - Bounded source additions from public metadata.
 * @param {string[]} [options.scriptHashes] - The document's inline script hashes.
 * @returns {string} The header value.
 */
export function buildContentSecurityPolicy({ connectOrigins = [], additions = [], scriptHashes = [], dashboardCspSources } = {}) {
  const directives = new Map(DEFAULT_DIRECTIVES.map(([name, sources]) => [name, new Set(sources)]))
  for (const origin of connectOrigins) directives.get('connect-src').add(origin)
  const metadataSources = validatedDashboardSources(dashboardCspSources)
  for (const [field, sources] of Object.entries(metadataSources ?? {})) {
    for (const source of sources) directives.get(SOURCE_FIELDS[field]).add(source)
  }
  for (const [name, sources] of additions) {
    if (!directives.has(name)) directives.set(name, new Set())
    for (const source of sources) directives.get(name).add(source)
  }
  for (const hash of scriptHashes) directives.get('script-src').add(hash)
  return [...directives].map(([name, sources]) => (sources.size ? `${name} ${[...sources].join(' ')}` : name)).join('; ')
}

/**
 * Keeps validated policy inputs from authentication metadata, refreshed in the
 * background once they are older than `ttlMs`; a failed refresh keeps the last value.
 *
 * @param {() => Promise<unknown>} loadAuthentication - Fetches the authentication metadata.
 * @param {number} [ttlMs] - How long a value is fresh.
 * @returns {() => Promise<{connectOrigins: string[], dashboardCspSources?: Record<string, string[]>}>} Current inputs; waits only for first load.
 */
export function createDashboardPolicyInputs(loadAuthentication, ttlMs = 60_000) {
  let inputs = null
  let loadedAt = 0
  let loading = null
  const load = () => {
    loading ??= loadAuthentication()
      .then((authentication) => {
        const dashboardCspSources = validatedDashboardSources(authentication?.dashboardCspSources)
        inputs = { connectOrigins: identityProviderOrigins(authentication), dashboardCspSources }
      })
      .catch((error) => { console.warn('[qqq] Could not read the authentication metadata for the security policy:', error instanceof Error ? error.name : 'unknown') })
      .finally(() => { loadedAt = Date.now(); loading = null })
    return loading
  }
  return async () => {
    if (inputs === null) await load()
    else if (Date.now() - loadedAt > ttlMs) void load()
    return inputs ?? { connectOrigins: [] }
  }
}

/**
 * Decodes a response body the server compressed, to hash what the browser will parse.
 *
 * @param {Buffer} body - The body as sent.
 * @param {unknown} encoding - The Content-Encoding header.
 * @returns {Buffer} The decoded body.
 */
function decodeBody(body, encoding) {
  switch (String(encoding ?? '').trim().toLowerCase()) {
    case 'gzip': return gunzipSync(body)
    case 'deflate': return inflateSync(body)
    case 'br': return brotliDecompressSync(body)
    default: return body
  }
}

/**
 * Adds the dashboard security headers to a response. HTML documents are buffered so the
 * Content-Security-Policy can list the hashes of their inline scripts; revalidations (304)
 * and HEAD requests get no policy, so a cached document keeps the policy of its own body.
 *
 * @param {import('node:http').IncomingMessage} req - The request.
 * @param {import('node:http').ServerResponse} res - The response, before any handler writes it.
 * @param {(scriptHashes: string[]) => string} policyFor - Builds the policy for a document.
 */
export function applyDashboardSecurityHeaders(req, res, policyFor) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value)
  const writeHead = res.writeHead
  const write = res.write
  const end = res.end
  const flushHeaders = res.flushHeaders
  const chunks = []
  let document = null

  // decided when the headers are first written: only HTML documents are buffered
  const buffering = () => {
    document ??= req.method !== 'HEAD' && /^text\/html\b/i.test(String(res.getHeader('content-type') ?? ''))
    return document
  }
  const toBuffer = (chunk, encoding) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8'))

  res.writeHead = function (statusCode, reason, headers) {
    if (reason !== null && typeof reason === 'object') {
      headers = reason
      reason = undefined
    }
    if (Array.isArray(headers)) {
      for (let i = 0; i + 1 < headers.length; i += 2) this.setHeader(headers[i], headers[i + 1])
    } else if (headers) {
      for (const [name, value] of Object.entries(headers)) if (value !== undefined) this.setHeader(name, value)
    }
    if (!buffering()) return reason === undefined ? writeHead.call(this, statusCode) : writeHead.call(this, statusCode, reason)
    this.statusCode = statusCode
    if (reason !== undefined) this.statusMessage = reason
    return this
  }
  res.flushHeaders = function () {
    if (!buffering()) flushHeaders.call(this)
  }
  res.write = function (chunk, encoding, callback) {
    if (!buffering()) return write.call(this, chunk, encoding, callback)
    const done = typeof encoding === 'function' ? encoding : callback
    if (chunk !== undefined && chunk !== null) chunks.push(toBuffer(chunk, encoding))
    if (typeof done === 'function') process.nextTick(done)
    return true
  }
  res.end = function (chunk, encoding, callback) {
    if (!buffering()) return end.call(this, chunk, encoding, callback)
    const done = [chunk, encoding, callback].find((argument) => typeof argument === 'function')
    if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') chunks.push(toBuffer(chunk, encoding))
    const body = Buffer.concat(chunks)
    document = false // from here on the original methods write the response
    if (this.statusCode !== 304 && !this.headersSent) {
      this.setHeader(CONTENT_SECURITY_POLICY, policyFor(inlineScriptHashes(decodeBody(body, this.getHeader('content-encoding')).toString('utf8'))))
    }
    return end.call(this, body, done)
  }
}
