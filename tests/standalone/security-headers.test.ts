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

// Security headers of the standalone (container image) server (QRun-IO/qqq#734): the same
// headers the QQQ server sends with the export (NextDashboardSecurityHeaders, QRun-IO/qqq#695).
import { createHash } from 'node:crypto'
import { createServer, request, type IncomingMessage, type RequestListener, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { gunzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyDashboardSecurityHeaders,
  buildContentSecurityPolicy,
  createIdentityProviderOrigins,
  identityProviderOrigins,
  inlineScriptHashes,
  isBackendPath,
  parseSourceAdditions,
  SECURITY_HEADERS,
} from '../../standalone/security-headers.mjs'
import nextConfig from '../../next.config'

/** The policy NextDashboardSecurityHeaders builds with no additions, before script hashes. */
const JAVALIN_DEFAULT_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "
  + "font-src 'self' data:; connect-src 'self'; frame-src 'self'; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' data: blob:; "
  + "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

const sha256 = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`

const servers: { close: () => void }[] = []
afterEach(() => {
  for (const server of servers.splice(0)) server.close()
})

/**
 * Serves a handler behind the dashboard headers, as qqq-server.mjs wraps the Next server.
 *
 * @param handler - Writes the response, as Next would.
 * @returns The server origin.
 */
async function serve(handler: RequestListener): Promise<string> {
  const server = createServer((req, res) => {
    applyDashboardSecurityHeaders(req, res, (scriptHashes) => buildContentSecurityPolicy({ connectOrigins: ['https://idp.example'], scriptHashes }))
    handler(req, res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

/**
 * A raw request (no automatic decompression).
 *
 * @param url - The URL.
 * @param options - Method and headers.
 * @returns Status, headers and the body bytes as sent.
 */
function get(url: string, options: { method?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; headers: IncomingMessage['headers']; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method ?? 'GET', headers: options.headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    req.end()
  })
}

const DOCUMENT = '<!doctype html><html><head><script src="/_next/static/app.js"></script><script>self.__boot = 1</script></head>'
  + '<body><SCRIPT type="text/javascript">\r\nself.__next_f.push([1, "payload"])\r\n</SCRIPT><script>self.__boot = 1</script></body></html>'
const DOCUMENT_HASHES = [sha256('self.__boot = 1'), sha256('\nself.__next_f.push([1, "payload"])\n')]

describe('dashboard policy (QRun-IO/qqq#734)', () => {
  it('has the directives and sources of the policy the QQQ server sends with the export', () => {
    expect(buildContentSecurityPolicy()).toBe(JAVALIN_DEFAULT_POLICY)
    expect(SECURITY_HEADERS).toEqual({
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=()',
      'X-Content-Type-Options': 'nosniff',
    })
  })

  it('adds the identity provider, the deployment additions, then the document hashes', () => {
    const policy = buildContentSecurityPolicy({
      connectOrigins: ['https://idp.example'],
      additions: parseSourceAdditions('frame-src https://*.quicksight.aws.amazon.com http://127.0.0.1:9; script-src https://cdn.example; report-uri /csp'),
      scriptHashes: ["'sha256-abc='"],
    })
    const directives = Object.fromEntries(policy.split('; ').map((part) => [part.split(' ')[0], part.split(' ').slice(1)]))
    expect(directives['connect-src']).toEqual(["'self'", 'https://idp.example'])
    expect(directives['frame-src']).toEqual(["'self'", 'https://*.quicksight.aws.amazon.com', 'http://127.0.0.1:9'])
    expect(directives['script-src']).toEqual(["'self'", 'https://cdn.example', "'sha256-abc='"])
    expect(directives['report-uri']).toEqual(['/csp'])
    expect(policy.split('; ').map((part) => part.split(' ')[0]).slice(-2)).toEqual(['frame-ancestors', 'report-uri'])
  })

  it('refuses malformed additions', () => {
    expect(parseSourceAdditions(undefined)).toEqual([])
    expect(parseSourceAdditions(' ; ')).toEqual([])
    expect(() => parseSourceAdditions('Frame-Src https://a.example')).toThrow('Invalid Content-Security-Policy directive name')
    expect(() => parseSourceAdditions('frame-src https://a.example,https://b.example')).toThrow('Invalid Content-Security-Policy source expression')
  })

  it('hashes each distinct inline script as the browser does, skipping external scripts', () => {
    expect(inlineScriptHashes(DOCUMENT)).toEqual(DOCUMENT_HASHES)
    expect(inlineScriptHashes('<p>no scripts</p>')).toEqual([])
  })

  it('allows the OAUTH2 or AUTH_0 identity provider origin from the authentication metadata', () => {
    expect(identityProviderOrigins({ type: 'OAUTH2', values: { baseUrl: 'https://login.example.com/realms/qqq/' } })).toEqual(['https://login.example.com'])
    expect(identityProviderOrigins({ type: 'AUTH_0', values: { baseUrl: 'https://tenant.auth0.com:8443/' } })).toEqual(['https://tenant.auth0.com:8443'])
    expect(identityProviderOrigins({ type: 'OAUTH2', values: { baseUrl: 'javascript:alert(1)' } })).toEqual([])
    expect(identityProviderOrigins({ type: 'MOCK' })).toEqual([])
    expect(identityProviderOrigins(null)).toEqual([])
  })

  it('leaves the backend routes the server forwards to the backend (the same prefixes as the rewrites)', async () => {
    for (const path of ['/qqq/v1/metaData', '/qqq', '/apis.json', '/api/person/v1', '/manageSession?x=1']) expect(isBackendPath(path)).toBe(true)
    for (const path of ['/', '/login', '/app/person/2', '/_next/static/app.js', '/qqqx', '/apis.jsonx']) expect(isBackendPath(path)).toBe(false)
    const previous = process.env.QQQ_BACKEND_URL
    process.env.QQQ_BACKEND_URL = 'http://backend.invalid'
    try {
      const rewrites = await (nextConfig.rewrites as () => Promise<{ source: string }[]>)()
      expect(rewrites.map((rewrite) => rewrite.source.split('/')[1]).every((prefix) => isBackendPath(`/${prefix}/x`))).toBe(true)
    } finally {
      if (previous === undefined) delete process.env.QQQ_BACKEND_URL
      else process.env.QQQ_BACKEND_URL = previous
    }
  })
})

describe('identity provider origins from the authentication metadata', () => {
  it('waits for the first load, refreshes in the background and keeps the last value on failure', async () => {
    let now = 1_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const load = vi.fn()
      .mockResolvedValueOnce({ type: 'OAUTH2', values: { baseUrl: 'https://one.example' } })
      .mockRejectedValueOnce(new Error('backend down'))
      .mockResolvedValueOnce({ type: 'OAUTH2', values: { baseUrl: 'https://two.example' } })
    const origins = createIdentityProviderOrigins(load, 100)
    expect(await origins()).toEqual(['https://one.example'])
    expect(await origins()).toEqual(['https://one.example'])
    expect(load).toHaveBeenCalledTimes(1)
    now += 200
    expect(await origins()).toEqual(['https://one.example'])
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    now += 200
    await origins()
    await vi.waitFor(async () => expect(await origins()).toEqual(['https://two.example']))
    expect(load).toHaveBeenCalledTimes(3)
    vi.restoreAllMocks()
  })

  it('without any metadata allows no identity provider', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const origins = createIdentityProviderOrigins(() => Promise.reject(new Error('backend down')))
    expect(await origins()).toEqual([])
    vi.restoreAllMocks()
  })
})

describe('response headers', () => {
  it('gives a streamed document the policy with the hashes of its own inline scripts', async () => {
    const origin = await serve((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.flushHeaders()
      res.write(DOCUMENT.slice(0, 50))
      res.write(Buffer.from(DOCUMENT.slice(50, 120)))
      res.end(DOCUMENT.slice(120))
    })
    const response = await get(`${origin}/app/person/2`)
    expect(response.status).toBe(200)
    expect(response.body.toString()).toBe(DOCUMENT)
    expect(response.headers['content-security-policy']).toBe(buildContentSecurityPolicy({ connectOrigins: ['https://idp.example'], scriptHashes: DOCUMENT_HASHES }))
    expect(response.headers['x-frame-options']).toBe('DENY')
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['permissions-policy']).toContain('camera=()')
  })

  it('hashes the decoded body of a compressed document (the Next server compresses)', async () => {
    const compression = createRequire(import.meta.url)('next/dist/compiled/compression') as () => (req: IncomingMessage, res: ServerResponse, next: () => void) => void
    const compress = compression()
    const origin = await serve((req, res) => {
      compress(req, res, () => undefined)
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.write(DOCUMENT)
      res.end()
    })
    const response = await get(`${origin}/app/nothing`, { headers: { 'Accept-Encoding': 'gzip' } })
    expect(response.status).toBe(404)
    expect(response.headers['content-encoding']).toBe('gzip')
    expect(gunzipSync(response.body).toString()).toBe(DOCUMENT)
    expect(response.headers['content-security-policy']).toContain(`script-src 'self' ${DOCUMENT_HASHES.join(' ')};`)
  })

  it('sends no policy with revalidations and HEAD requests, so a cached document keeps its own', async () => {
    const origin = await serve((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      if (req.headers['if-none-match']) {
        res.statusCode = 304
        res.end()
      } else {
        res.end(req.method === 'HEAD' ? undefined : DOCUMENT)
      }
    })
    const revalidated = await get(`${origin}/login`, { headers: { 'If-None-Match': '"v1"' } })
    expect(revalidated.status).toBe(304)
    expect(revalidated.headers['content-security-policy']).toBeUndefined()
    expect(revalidated.headers['x-frame-options']).toBe('DENY')
    const head = await get(`${origin}/login`, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers['content-security-policy']).toBeUndefined()
    expect(head.headers['x-content-type-options']).toBe('nosniff')
  })

  it('passes other responses through unbuffered, with the other headers but no policy', async () => {
    let flushedBeforeEnd = false
    const origin = await serve((_req, res) => {
      res.writeHead(200, ['Content-Type', 'text/x-component'])
      res.write('0:["payload"]\n')
      flushedBeforeEnd = res.headersSent
      res.end()
    })
    const response = await get(`${origin}/app/person?_rsc=1`)
    expect(response.body.toString()).toBe('0:["payload"]\n')
    expect(flushedBeforeEnd).toBe(true)
    expect(response.headers['content-security-policy']).toBeUndefined()
    expect(response.headers['x-content-type-options']).toBe('nosniff')
  })
})
