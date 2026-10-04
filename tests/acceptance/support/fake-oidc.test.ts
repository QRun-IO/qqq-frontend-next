/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Actual owned-provider issuer, discovery and signed-token contracts. */
import { createHash, createPublicKey, verify } from 'node:crypto'
import { createServer } from 'node:net'
import { bypass } from 'msw'
import { expect, it } from 'vitest'
import { startFakeOidc } from './fake-oidc'

/** Reserve an available loopback port without using any shared acceptance server. */
async function unusedPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test port')
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return address.port
}

it.each([false, true])('keeps endpoints on the origin and signs consistent issuer claims (Auth0=%s)', async (auth0Issuer) => {
  const port = await unusedPort()
  const origin = `http://127.0.0.1:${port}`
  const expectedIssuer = origin + (auth0Issuer ? '/' : '')
  const clientId = 'owned-client'
  const redirectUri = 'http://127.0.0.1:13999/callback'
  const provider = await startFakeOidc({ port, clientId, clientSecret: 'owned-secret', allowedRedirectPrefix: 'http://127.0.0.1:13999/', auth0Issuer })
  try {
    const discoveryResponse = await fetch(bypass(`${origin}/.well-known/openid-configuration`))
    expect(discoveryResponse.status).toBe(200)
    const discovery = await discoveryResponse.json()
    const verifier = 'owned-pkce-verifier-with-enough-characters-for-this-test'
    const form = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid profile', state: 'owned-state', code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'), decision: 'allow' })
    const authorization = await fetch(bypass(`${origin}/authorize/decision`, { method: 'POST', body: form, redirect: 'manual' }))
    expect(authorization.status).toBe(302)
    const code = new URL(authorization.headers.get('location')!).searchParams.get('code')!
    const tokenResponse = await fetch(bypass(discovery.token_endpoint, { method: 'POST', body: new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', redirect_uri: redirectUri, code, code_verifier: verifier }) }))
    expect(tokenResponse.status).toBe(200)
    const tokens = await tokenResponse.json()
    const jwksResponse = await fetch(bypass(discovery.jwks_uri))
    expect(jwksResponse.status).toBe(200)
    const jwks = await jwksResponse.json()
    const key = createPublicKey({ key: jwks.keys[0], format: 'jwk' })
    for (const token of [tokens.access_token, tokens.id_token] as string[]) {
      const [header, claims, signature] = token.split('.')
      expect(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), key, Buffer.from(signature, 'base64url'))).toBe(true)
      expect(JSON.parse(Buffer.from(claims, 'base64url').toString()).iss).toBe(expectedIssuer)
    }
    expect(discovery).toMatchObject({ issuer: expectedIssuer, authorization_endpoint: `${origin}/authorize`, token_endpoint: `${origin}/oauth/token`, jwks_uri: `${origin}/.well-known/jwks.json`, userinfo_endpoint: `${origin}/userinfo`, end_session_endpoint: `${origin}/logout` })
    expect(provider.issuer).toBe(expectedIssuer)
    if (auth0Issuer) expect(provider.origin).toBe(origin)
    expect(provider.requests.every(request => !request.path.startsWith('//'))).toBe(true)
  } finally {
    await provider.close()
  }
})
