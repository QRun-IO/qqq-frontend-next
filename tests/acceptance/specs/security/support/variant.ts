/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Security-area backend variants (tests/acceptance/fixture/SecurityAcceptanceServer.java).
// One variant runs at a time on the security port; specs that need a different
// authentication module stop the running one first. The variant serves the same
// static Next export in Javalin mode, or its own immutable Node build in standalone mode.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { test as base, type APIRequestContext } from '@playwright/test'
import type { Diagnostics, Persona, SampleUser } from '../../../support/fixtures'
import { test as acceptanceTest } from '../../../support/fixtures'
import { ACCEPTANCE_MODE, SECURITY_BACKEND_PORT, SECURITY_BACKEND_URL, SECURITY_FRONTEND_PORT, SECURITY_IDP_PORT, SECURITY_STANDALONE, SECURITY_UI_URL, resolveFixtureClasspath } from '../../../../../scripts/acceptance-paths.mjs'

import { assertStandaloneTarget } from '../../../../../scripts/acceptance-standalone.mjs'

export { SECURITY_UI_URL }

export type AuthMode = 'MOCK' | 'OAUTH2' | 'AUTH_0' | 'FULLY_ANONYMOUS' | 'TABLE_BASED' | 'UNSUPPORTED'

export const SECURITY_PORT = SECURITY_BACKEND_PORT
export const SECURITY_ESB_PORT = Number(process.env.QQQ_ACCEPTANCE_SECURITY_ESB_PORT ?? Number(process.env.QQQ_ACCEPTANCE_ESB_PORT ?? 61616) + 1)
export const IDP_PORT = SECURITY_IDP_PORT
export const SECURITY_URL = SECURITY_BACKEND_URL
export const IDP_URL = `http://127.0.0.1:${IDP_PORT}`

const EXPORT_CLASSPATH = path.resolve('test-results/acceptance/export-classpath')
const CLASSES = path.resolve('test-results/acceptance/security-classes')

function sampleJar(): string {
  const jar = process.env.QQQ_SAMPLE_JAR
  if (!jar || !existsSync(jar)) throw new Error('Set QQQ_SAMPLE_JAR (see tests/acceptance/README.md).')
  return path.resolve(jar)
}

let compiled = false
function compileFixtures(classpath: string) {
  if (compiled) return
  rmSync(CLASSES, { recursive: true, force: true })
  mkdirSync(CLASSES, { recursive: true })
  const directory = path.resolve('tests/acceptance/fixture')
  const sources = readdirSync(directory).filter((name) => name.endsWith('.java')).map((name) => path.join(directory, name))
  const result = spawnSync('javac', ['-proc:none', '-sourcepath', '', '-encoding', 'UTF-8', '-cp', classpath, '-d', CLASSES, ...sources], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`Security fixture compilation failed:\n${result.stderr}`)
  compiled = true
}

interface Running { mode: AuthMode; key: string; process: ChildProcess; frontend?: ChildProcess; output: string[] }
let running: Running | null = null
process.on('exit', () => {
  if (running?.frontend?.exitCode === null) running.frontend.kill('SIGKILL')
  if (running?.process.exitCode === null) running.process.kill('SIGKILL')
})

async function waitForReady(child: Running, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.process.exitCode !== null) throw new Error(`Security variant exited (${child.process.exitCode}):\n${child.output.slice(-40).join('')}`)
    try {
      const response = await fetch(`${SECURITY_URL}/acceptance/ready`, { signal: AbortSignal.timeout(5_000) })
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Security variant did not become ready:\n${child.output.slice(-40).join('')}`)
}

export async function stopVariant() {
  if (!running) return
  const current = running
  running = null
  // Stop the browser-facing server first; its metadata cache belongs to this backend mode.
  let stopped = true
  for (const child of [current.frontend, current.process]) {
    if (!child || child.exitCode !== null || child.signalCode) continue
    let onExit: () => void
    const exited = new Promise<boolean>((resolve) => { onExit = () => resolve(true); child.once('exit', onExit) })
    const wait = async (milliseconds: number) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const result = await Promise.race([exited, new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), milliseconds) })])
      clearTimeout(timer)
      return result
    }
    child.kill('SIGTERM')
    if (!await wait(15_000)) {
      child.kill('SIGKILL')
      if (!await wait(5_000)) stopped = false
    }
    child.removeListener('exit', onExit!)
  }
  if (!stopped) {
    current.key = '' // failed teardown must never be eligible for same-mode reuse
    running = current // retain ownership for final cleanup; no new variant can bypass this child
    throw new Error('An owned security server did not exit; refusing to start another variant on its port.')
  }
}

/** Starts the actual container entrypoint, with a separately baked variant rewrite target. */
async function startStandalone(current: Running) {
  assertStandaloneTarget(SECURITY_STANDALONE, SECURITY_URL)
  // A retained export must not turn this into a Javalin qualification.
  const backendDocument = await fetch(`${SECURITY_URL}/login`, { signal: AbortSignal.timeout(5_000) })
  if (backendDocument.ok && /text\/html/i.test(backendDocument.headers.get('content-type') ?? '')) {
    throw new Error('Standalone security backend unexpectedly serves a dashboard document.')
  }
  const authentication = await fetch(`${SECURITY_URL}/qqq/v1/metaData/authentication`, { signal: AbortSignal.timeout(5_000) })
  if (!authentication.ok) throw new Error('Security authentication metadata request failed.')
  const metadata = await authentication.json()
  if (metadata.type !== (current.mode === 'UNSUPPORTED' ? 'ACCEPTANCE_UNKNOWN' : current.mode)) {
    throw new Error('Security backend authentication mode does not match the selected variant.')
  }
  current.frontend = spawn(process.execPath, ['qqq-server.mjs'], {
    cwd: SECURITY_STANDALONE,
    env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(SECURITY_FRONTEND_PORT), QQQ_DASHBOARD_CSP_SOURCES: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const keep = (chunk: Buffer) => { current.output.push(chunk.toString()); if (current.output.length > 400) current.output.shift() }
  current.frontend.stdout?.on('data', keep)
  current.frontend.stderr?.on('data', keep)
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (current.frontend.exitCode !== null || current.frontend.signalCode) throw new Error(`Standalone security server exited (${current.frontend.exitCode})`)
    try {
      const response = await fetch(`${SECURITY_UI_URL}/login`, { signal: AbortSignal.timeout(Math.min(5_000, Math.max(1, deadline - Date.now()))) })
      if (response.ok && new URL(response.url).origin === SECURITY_UI_URL && /text\/html/i.test(response.headers.get('content-type') ?? '')) return
    } catch {
      // the Node server is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Standalone security server did not become ready on its own browser origin.')
}

/**
 * Starts (or reuses) the backend variant for an authentication mode.
 * `env` and `properties` are part of the reuse key, so a different IdP setup restarts it.
 */
export async function startVariant(mode: AuthMode, options: { env?: Record<string, string>; properties?: Record<string, string> } = {}) {
  const key = JSON.stringify({ mode, ...options })
  if (running?.key === key && running.process.exitCode === null && !running.process.signalCode
    && (ACCEPTANCE_MODE === 'javalin' || (running.frontend?.exitCode === null && !running.frontend.signalCode))) return
  await stopVariant()
  if (ACCEPTANCE_MODE === 'javalin' && !existsSync(path.join(EXPORT_CLASSPATH, 'next-dashboard', 'index.html'))) {
    throw new Error('No Next export on the acceptance classpath; run node scripts/acceptance.mjs (javalin mode) first.')
  }
  const classpath = resolveFixtureClasspath(sampleJar())
  compileFixtures(classpath)
  // OAUTH2 uses the sample's own OAuth2 provider (non-mock instance); others start from the mock instance
  const mock = mode !== 'OAUTH2'
  const args = [
    `-Dqqq.sample.mockAuthentication=${mock}`,
    `-Dqqq.sample.sharing=${mode === 'MOCK'}`,
    `-Dqqq.sample.port=${SECURITY_PORT}`,
    `-Dqqq.sample.esb.port=${SECURITY_ESB_PORT}`,
    `-Dqqq.security.auth=${mode}`,
    '-Duser.timezone=UTC',
    `-Dqqq.javalin.frontend=${ACCEPTANCE_MODE === 'standalone' ? 'none' : 'next'}`,
    ...Object.entries(options.properties ?? {}).map(([name, value]) => `-D${name}=${value}`),
    '-cp', [...(ACCEPTANCE_MODE === 'javalin' ? [EXPORT_CLASSPATH] : []), CLASSES, classpath].join(path.delimiter),
    'SecurityAcceptanceServer',
  ]
  const child = spawn('java', args, { env: { ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'] })
  const output: string[] = []
  const keep = (chunk: Buffer) => { output.push(chunk.toString()); if (output.length > 400) output.shift() }
  child.stdout?.on('data', keep)
  child.stderr?.on('data', keep)
  running = { mode, key, process: child, output }
  try {
    await waitForReady(running)
    if (ACCEPTANCE_MODE === 'standalone') await startStandalone(running)
  } catch (error) {
    await stopVariant()
    throw error
  }
}

async function control(pathName: string, body: unknown) {
  const response = await fetch(`${SECURITY_URL}/acceptance/${pathName}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Security control ${pathName} failed ${response.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

type Row = Record<string, string | null>

export interface SecurityBackend {
  url: string
  sessionId: string
  /** Read-only SELECT against the variant's own in-memory database. */
  sql: (query: string) => Promise<Row[]>
  /** Direct backend HTTP call with this test's session. */
  api: APIRequestContext
  setPersona: (persona: Persona, user?: SampleUser) => Promise<void>
}

/**
 * Specs against the MOCK security variant: stock sample + SecurityFixtures, same
 * personas and sample users as the shared backend, a fresh database per test.
 */
export const test = acceptanceTest.extend<{ security: SecurityBackend }, { securityVariant: void }>({
  securityVariant: [async ({}, provide) => {
    await startVariant('MOCK')
    await provide()
    await stopVariant()
  }, { scope: 'worker' }],
  baseURL: async ({ securityVariant }, provide) => { void securityVariant; await provide(SECURITY_UI_URL) },
  security: async ({ context, persona, user, playwright, securityVariant }, provide) => {
    void securityVariant
    await startVariant('MOCK')
    const sessionId = randomUUID()
    await control('reset', {})
    await control('persona', { sessionId, persona, user })
    await context.addCookies([{ name: 'sessionId', value: sessionId, url: 'http://127.0.0.1', httpOnly: true }])
    const api = await playwright.request.newContext({ baseURL: SECURITY_URL, extraHTTPHeaders: { Cookie: `sessionId=${sessionId}` } })
    await provide({
      url: SECURITY_URL,
      sessionId,
      api,
      sql: async (query) => (await control('sql', { query })).rows,
      setPersona: async (next, nextUser = user) => { await control('persona', { sessionId, persona: next, user: nextUser }) },
    })
    await api.dispose()
  },
})

/** SELECT against whichever variant is running (for non-MOCK specs). */
export async function variantSql(query: string): Promise<Row[]> {
  return (await control('sql', { query })).rows
}

/** Restores the running variant's seed data (fresh database per test). */
export async function resetVariant(): Promise<void> {
  await control('reset', {})
}

/**
 * TABLE_BASED variant: makes every stored session idle past the module's inactivity
 * timeout, so the next request with it fails the module's real expiry check.
 *
 * @returns How many sessions were expired.
 */
export async function expireTableSessions(): Promise<number> {
  return (await control('expire-table-sessions', {})).expired
}

export { expect } from '../../../support/fixtures'
export type { Diagnostics }
export { base }
