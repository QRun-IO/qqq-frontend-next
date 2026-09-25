/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Security-area backend variants (tests/acceptance/fixture/SecurityAcceptanceServer.java).
// One variant runs at a time on the security port; specs that need a different
// authentication module stop the running one first. The variant serves the same
// static Next export as the shared acceptance backend (javalin mode).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { test as base, type APIRequestContext } from '@playwright/test'
import { ACCEPTANCE_BACKEND_PORT, ACCEPTANCE_FRONTEND_PORT } from '../../../support/ports'
import type { Diagnostics, Persona, SampleUser } from '../../../support/fixtures'
import { test as acceptanceTest } from '../../../support/fixtures'

export type AuthMode = 'MOCK' | 'OAUTH2' | 'AUTH_0' | 'FULLY_ANONYMOUS' | 'TABLE_BASED'

export const SECURITY_PORT = Number(process.env.QQQ_ACCEPTANCE_SECURITY_BACKEND_PORT ?? ACCEPTANCE_BACKEND_PORT + 10)
export const IDP_PORT = Number(process.env.QQQ_ACCEPTANCE_SECURITY_IDP_PORT ?? ACCEPTANCE_FRONTEND_PORT + 10)
export const SECURITY_URL = `http://127.0.0.1:${SECURITY_PORT}`
export const IDP_URL = `http://127.0.0.1:${IDP_PORT}`

const EXPORT_CLASSPATH = path.resolve('test-results/acceptance/export-classpath')
const CLASSES = path.resolve('test-results/acceptance/security-classes')

function sampleJar(): string {
  const jar = process.env.QQQ_SAMPLE_JAR
  if (!jar || !existsSync(jar)) throw new Error('Set QQQ_SAMPLE_JAR (see tests/acceptance/README.md).')
  return path.resolve(jar)
}

let compiled = false
function compileFixtures(jar: string) {
  if (compiled) return
  rmSync(CLASSES, { recursive: true, force: true })
  mkdirSync(CLASSES, { recursive: true })
  const directory = path.resolve('tests/acceptance/fixture')
  const sources = readdirSync(directory).filter((name) => name.endsWith('.java')).map((name) => path.join(directory, name))
  const result = spawnSync('javac', ['-proc:none', '-encoding', 'UTF-8', '-cp', jar, '-d', CLASSES, ...sources], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`Security fixture compilation failed:\n${result.stderr}`)
  compiled = true
}

interface Running { mode: AuthMode; key: string; process: ChildProcess; output: string[] }
let running: Running | null = null
process.on('exit', () => { if (running?.process.exitCode === null) running.process.kill('SIGKILL') })

async function waitForReady(child: Running, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.process.exitCode !== null) throw new Error(`Security variant exited (${child.process.exitCode}):\n${child.output.slice(-40).join('')}`)
    try {
      const response = await fetch(`${SECURITY_URL}/acceptance/ready`)
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
  if (current.process.exitCode === null) {
    const exited = new Promise((resolve) => current.process.once('exit', resolve))
    current.process.kill('SIGTERM')
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 15_000))])
    if (current.process.exitCode === null) current.process.kill('SIGKILL')
  }
}

/**
 * Starts (or reuses) the backend variant for an authentication mode.
 * `env` and `properties` are part of the reuse key, so a different IdP setup restarts it.
 */
export async function startVariant(mode: AuthMode, options: { env?: Record<string, string>; properties?: Record<string, string> } = {}) {
  const key = JSON.stringify({ mode, ...options })
  if (running?.key === key && running.process.exitCode === null) return
  await stopVariant()
  if (!existsSync(path.join(EXPORT_CLASSPATH, 'next-dashboard', 'index.html'))) {
    throw new Error('No Next export on the acceptance classpath; run node scripts/acceptance.mjs (javalin mode) first.')
  }
  const jar = sampleJar()
  compileFixtures(jar)
  // OAUTH2 uses the sample's own OAuth2 provider (non-mock instance); others start from the mock instance
  const mock = mode !== 'OAUTH2'
  const args = [
    `-Dqqq.sample.mockAuthentication=${mock}`,
    `-Dqqq.sample.sharing=${mode === 'MOCK'}`,
    `-Dqqq.sample.port=${SECURITY_PORT}`,
    `-Dqqq.security.auth=${mode}`,
    '-Duser.timezone=UTC',
    '-Dqqq.javalin.frontend=next',
    ...Object.entries(options.properties ?? {}).map(([name, value]) => `-D${name}=${value}`),
    '-cp', [EXPORT_CLASSPATH, CLASSES, jar].join(path.delimiter),
    'SecurityAcceptanceServer',
  ]
  const child = spawn('java', args, { env: { ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'] })
  const output: string[] = []
  const keep = (chunk: Buffer) => { output.push(chunk.toString()); if (output.length > 400) output.shift() }
  child.stdout?.on('data', keep)
  child.stderr?.on('data', keep)
  running = { mode, key, process: child, output }
  await waitForReady(running)
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
  securityVariant: [async ({}, use) => {
    await startVariant('MOCK')
    await use()
    await stopVariant()
  }, { scope: 'worker' }],
  baseURL: async ({ securityVariant }, use) => { void securityVariant; await use(SECURITY_URL) },
  security: async ({ context, persona, user, playwright, securityVariant }, use) => {
    void securityVariant
    await startVariant('MOCK')
    const sessionId = randomUUID()
    await control('reset', {})
    await control('persona', { sessionId, persona, user })
    await context.addCookies([{ name: 'sessionId', value: sessionId, url: 'http://127.0.0.1' }])
    const api = await playwright.request.newContext({ baseURL: SECURITY_URL, extraHTTPHeaders: { Cookie: `sessionId=${sessionId}` } })
    await use({
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

export { expect } from '../../../support/fixtures'
export type { Diagnostics }
export { base }
