/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// An owned, loopback-only OpenID Connect provider for acceptance tests of the OAUTH2 and
// AUTH_0 flows: discovery, an interactive /authorize login page (with SSO cookie), the
// authorization-code + PKCE token endpoint (confidential Basic client auth, or a public
// client for Auth0-style browser exchanges), JWKS, and end-session. Tokens are RS256 JWTs.
// Every request is recorded so specs can assert exactly what the UI and backend sent.
import { createHash, createSign, generateKeyPairSync, randomBytes, type KeyObject } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

export interface FakeUser { sub: string; name: string; email: string }

export interface FakeOidcOptions {
  port: number
  clientId: string
  clientSecret: string
  /** Redirect URIs must start with this (the QQQ server origin). */
  allowedRedirectPrefix: string
  /** Extra access-token claims (e.g. an Auth0 audience). */
  audience?: string
  users?: FakeUser[]
}

export interface RecordedRequest {
  method: string
  path: string
  query: Record<string, string>
  form: Record<string, string>
  authorization?: string
}

interface PendingCode {
  clientId: string
  redirectUri: string
  challenge: string
  method: string
  user: FakeUser
  scope: string
  nonce?: string
}

export interface FakeOidcProvider {
  issuer: string
  requests: RecordedRequest[]
  /** Makes the next token exchange fail with invalid_grant. */
  failNextTokenExchange: () => void
  /** Number of currently signed-in provider sessions. */
  activeSessions: () => number
  /** Forgets every code, provider session and recorded request (per-test isolation). */
  reset: () => void
  close: () => Promise<void>
}

const SESSION_COOKIE = 'fake_idp_session'
const DEFAULT_USERS: FakeUser[] = [
  { sub: 'oidc|dana', name: 'Dana Owner (OIDC)', email: 'dana@qrun.example' },
  { sub: 'oidc|eli', name: 'Eli Reader (OIDC)', email: 'eli@qrun.example' },
]

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signJwt(privateKey: KeyObject, kid: string, claims: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }))
  const payload = base64Url(JSON.stringify(claims))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  return `${header}.${payload}.${base64Url(signer.sign(privateKey))}`
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
}

/**
 * Starts the provider on 127.0.0.1:`port`.
 *
 * @param options - Client registration and users.
 * @returns The running provider.
 */
export async function startFakeOidc(options: FakeOidcOptions): Promise<FakeOidcProvider> {
  const issuer = `http://127.0.0.1:${options.port}`
  const users = options.users ?? DEFAULT_USERS
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const kid = base64Url(randomBytes(8))
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }
  const codes = new Map<string, PendingCode>()
  const sessions = new Map<string, FakeUser>()
  const requests: RecordedRequest[] = []
  let failNext = false

  const discovery = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    userinfo_endpoint: `${issuer}/userinfo`,
    end_session_endpoint: `${issuer}/logout`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
  }

  const cors = (request: IncomingMessage, response: ServerResponse) => {
    const origin = request.headers.origin
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    }
  }
  const json = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(body))
  }
  const redirect = (response: ServerResponse, location: string, cookie?: string) => {
    response.writeHead(302, { Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) })
    response.end()
  }
  const sessionUser = (request: IncomingMessage) => {
    const cookie = (request.headers.cookie ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    return cookie ? sessions.get(cookie.slice(SESSION_COOKIE.length + 1)) : undefined
  }
  const issueCode = (params: URLSearchParams, user: FakeUser) => {
    const code = base64Url(randomBytes(24))
    codes.set(code, {
      clientId: params.get('client_id') ?? '', redirectUri: params.get('redirect_uri') ?? '',
      challenge: params.get('code_challenge') ?? '', method: params.get('code_challenge_method') ?? '',
      user, scope: params.get('scope') ?? '', nonce: params.get('nonce') ?? undefined,
    })
    const target = new URL(params.get('redirect_uri') ?? '')
    target.searchParams.set('code', code)
    if (params.get('state')) target.searchParams.set('state', params.get('state') ?? '')
    return target.toString()
  }
  const authorizeError = (params: URLSearchParams): string | null => {
    if (params.get('response_type') !== 'code') return 'unsupported_response_type'
    if (params.get('client_id') !== options.clientId) return 'unauthorized_client'
    if (!(params.get('redirect_uri') ?? '').startsWith(options.allowedRedirectPrefix)) return 'invalid_redirect_uri'
    if (params.get('code_challenge_method') !== 'S256' || !params.get('code_challenge')) return 'invalid_request'
    if (!params.get('state')) return 'invalid_request'
    if (!(params.get('scope') ?? '').split(' ').includes('openid')) return 'invalid_scope'
    return null
  }

  const handler = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', issuer)
    const body = request.method === 'POST' ? await readBody(request) : ''
    const form = Object.fromEntries(new URLSearchParams(body))
    requests.push({ method: request.method ?? 'GET', path: url.pathname, query: Object.fromEntries(url.searchParams), form, authorization: request.headers.authorization })
    cors(request, response)
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }

    if (url.pathname === '/.well-known/openid-configuration') return json(response, 200, discovery)
    if (url.pathname === '/.well-known/jwks.json' || url.pathname === '/jwks') return json(response, 200, { keys: [jwk] })

    if (url.pathname === '/authorize' && request.method === 'GET') {
      const error = authorizeError(url.searchParams)
      if (error) return json(response, 400, { error })
      const existing = sessionUser(request)
      if (existing) return redirect(response, issueCode(url.searchParams, existing))
      const hidden = [...url.searchParams].map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join('')
      const options = users.map((user) => `<option value="${escapeHtml(user.sub)}">${escapeHtml(user.name)}</option>`).join('')
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html lang="en"><head><title>QRun Test Identity Provider</title></head><body><main>
        <h1>QRun Test Identity Provider</h1>
        <form method="post" action="/authorize/decision">${hidden}
          <label for="user">Account</label><select id="user" name="user">${options}</select>
          <button type="submit" name="decision" value="allow">Sign in</button>
          <button type="submit" name="decision" value="deny">Deny</button>
        </form></main></body></html>`)
      return
    }

    if (url.pathname === '/authorize/decision' && request.method === 'POST') {
      const params = new URLSearchParams(body)
      const error = authorizeError(params)
      if (error) return json(response, 400, { error })
      if (params.get('decision') !== 'allow') {
        const target = new URL(params.get('redirect_uri') ?? '')
        target.searchParams.set('error', 'access_denied')
        target.searchParams.set('error_description', 'The user denied the sign-in.')
        if (params.get('state')) target.searchParams.set('state', params.get('state') ?? '')
        return redirect(response, target.toString())
      }
      const user = users.find((candidate) => candidate.sub === params.get('user')) ?? users[0]
      const session = base64Url(randomBytes(16))
      sessions.set(session, user)
      return redirect(response, issueCode(params, user), `${SESSION_COOKIE}=${session}; Path=/; HttpOnly; SameSite=Lax`)
    }

    if (url.pathname === '/oauth/token' && request.method === 'POST') {
      let clientId = form.client_id
      const basic = request.headers.authorization?.match(/^Basic (.+)$/)
      if (basic) {
        const [id, secret] = Buffer.from(basic[1], 'base64').toString('utf8').split(':').map((part) => decodeURIComponent(part))
        if (id !== options.clientId || secret !== options.clientSecret) return json(response, 401, { error: 'invalid_client' })
        clientId = id
      } else if (clientId !== options.clientId) {
        return json(response, 401, { error: 'invalid_client' })
      }
      if (form.grant_type !== 'authorization_code') return json(response, 400, { error: 'unsupported_grant_type' })
      const pending = codes.get(form.code ?? '')
      codes.delete(form.code ?? '')
      if (failNext) {
        failNext = false
        return json(response, 400, { error: 'invalid_grant', error_description: 'The authorization code was rejected by the provider.' })
      }
      if (!pending || pending.clientId !== clientId || pending.redirectUri !== form.redirect_uri) {
        return json(response, 400, { error: 'invalid_grant', error_description: 'Unknown, used or mismatched authorization code.' })
      }
      const expected = base64Url(createHash('sha256').update(form.code_verifier ?? '').digest())
      if (pending.method !== 'S256' || expected !== pending.challenge) {
        return json(response, 400, { error: 'invalid_grant', error_description: 'PKCE verification failed.' })
      }
      const now = Math.floor(Date.now() / 1000)
      const identity = { sub: pending.user.sub, name: pending.user.name, email: pending.user.email }
      const accessToken = signJwt(privateKey, kid, {
        ...identity, iss: issuer, aud: options.audience ?? options.clientId, azp: options.clientId,
        iat: now, exp: now + 3600, scope: pending.scope, permissions: [],
      })
      const idToken = signJwt(privateKey, kid, { ...identity, iss: issuer, aud: options.clientId, iat: now, exp: now + 3600, ...(pending.nonce ? { nonce: pending.nonce } : {}) })
      return json(response, 200, { access_token: accessToken, id_token: idToken, token_type: 'Bearer', expires_in: 3600, scope: pending.scope })
    }

    if (url.pathname === '/userinfo') {
      const token = request.headers.authorization?.replace(/^Bearer /, '') ?? ''
      try {
        const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as FakeUser
        return json(response, 200, { sub: claims.sub, name: claims.name, email: claims.email })
      } catch {
        return json(response, 401, { error: 'invalid_token' })
      }
    }

    if (url.pathname === '/logout' || url.pathname === '/v2/logout') {
      const cookie = (request.headers.cookie ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      if (cookie) sessions.delete(cookie.slice(SESSION_COOKIE.length + 1))
      const target = url.searchParams.get('post_logout_redirect_uri') ?? url.searchParams.get('returnTo') ?? ''
      const clear = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
      if (target.startsWith(options.allowedRedirectPrefix)) return redirect(response, target, clear)
      response.writeHead(200, { 'Content-Type': 'text/plain', 'Set-Cookie': clear })
      response.end('Signed out')
      return
    }

    json(response, 404, { error: 'not_found' })
  }

  const server: Server = createServer((request, response) => {
    handler(request, response).catch((error: unknown) => json(response, 500, { error: String(error) }))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, '127.0.0.1', () => resolve())
  })
  return {
    issuer,
    requests,
    failNextTokenExchange: () => { failNext = true },
    activeSessions: () => sessions.size,
    reset: () => { codes.clear(); sessions.clear(); requests.length = 0; failNext = false },
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(() => resolve()) }),
  }
}
