/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Exercises the real variant lifecycle with only process and filesystem boundaries replaced. */
import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  launched: [] as { command: string; args: string[]; options: unknown }[],
  mode: 'TABLE_BASED', failMetadata: false, deferNodeExit: false, ignoreAllKill: false, signals: [] as AbortSignal[], backendServesHtml: false, wrongTarget: false, hasExport: true, killed: [] as string[],
}))
vi.mock('node:child_process', () => {
  const processes = {
    spawnSync: () => ({ status: 0 }),
    spawn: (command: string, args: string[], options: unknown) => {
      state.launched.push({ command, args, options })
      const events = new EventEmitter()
      const child = Object.assign(events, {
        stdout: new EventEmitter(), stderr: new EventEmitter(), exitCode: null as number | null,
        kill(signal: string) {
          state.killed.push(`${command}:${signal}`)
          if (state.ignoreAllKill) return true
          if (state.deferNodeExit && command !== 'java') {
            if (signal === 'SIGKILL') setTimeout(() => { this.exitCode = 0; events.emit('exit', 0) }, 50)
            return true
          }
          this.exitCode = 0; events.emit('exit', 0); return true
        },
      })
      return child
    },
  }
  return { ...processes, default: processes }
})
// Existing stale export and build files cannot determine the browser's selected server.
vi.mock('node:fs', async (original) => {
  const fs = {
    ...await original<typeof import('node:fs')>(), existsSync: (file: string) => file.endsWith('next-dashboard/index.html') ? state.hasExport : true, mkdirSync: () => {}, rmSync: () => {},
    readdirSync: () => ['Fixture.java'],
    readFileSync: (file: string) => file.endsWith('routes-manifest.json')
      ? JSON.stringify({ rewrites: { beforeFiles: [], afterFiles: ['qqq', 'data', 'widget', 'metaData', 'download', 'processes', 'possibleValues', 'reports', 'manageSession', 'apis.json', 'api'].map((prefix) => ({ source: `/${prefix}/:path*`, destination: `http://127.0.0.1:${state.wrongTarget ? '18765' : '18775'}/${prefix}/:path*` })), fallback: [] } })
      : 'http://127.0.0.1:18775\n',
  }
  return { ...fs, default: fs }
})
// Test registration is outside this lifecycle contract; do not initialize a second runner in Vitest.
vi.mock('@playwright/test', () => ({ test: { extend: () => ({}) } }))
vi.mock('./fixtures', () => ({ test: { extend: () => ({}) }, expect }))

async function variant(mode = 'standalone') {
  vi.stubEnv('QQQ_ACCEPTANCE_MODE', mode)
  vi.stubEnv('QQQ_SAMPLE_JAR', '/owned/qqq-sample-project-4.1.0-RC.1-jar-with-dependencies.jar')
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.signal) state.signals.push(options.signal)
    if (state.failMetadata && url.endsWith('/metaData/authentication')) throw new Error('metadata request aborted')
    return {
    ok: !url.endsWith(':18775/login') || state.backendServesHtml,
    url, status: url.endsWith(':18775/login') && !state.backendServesHtml ? 404 : 200,
    headers: new Headers({ 'content-type': 'text/html' }),
    json: async () => ({ type: state.mode }),
  } }))
  return import('../specs/security/support/variant')
}

afterEach(() => {
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules()
  state.launched.length = 0; state.killed.length = 0; state.signals.length = 0
  state.failMetadata = false; state.deferNodeExit = false; state.ignoreAllKill = false; vi.useRealTimers()
  state.mode = 'TABLE_BASED'; state.backendServesHtml = false; state.wrongTarget = false; state.hasExport = true
})

it.each([true, false])('standalone disables the Javalin UI regardless of a retained export (%s)', async (hasExport) => {
  state.hasExport = hasExport
  const server = await variant()
  try {
    await server.startVariant('TABLE_BASED')
    const java = state.launched.find(({ command }) => command === 'java')!
    expect(java.args).toContain('-Dqqq.javalin.frontend=none')
    expect(java.args[java.args.indexOf('-cp') + 1]).not.toContain('export-classpath')
    expect(server.SECURITY_UI_URL).toBe('http://127.0.0.1:13785')
    expect(server.SECURITY_URL).toBe('http://127.0.0.1:18775')
    const node = state.launched.find(({ command }) => command !== 'java')!
    expect(node.args).toEqual(['qqq-server.mjs'])
    expect(node.options).toMatchObject({ env: { PORT: '13785', QQQ_DASHBOARD_CSP_SOURCES: '' } })
  } finally { await server.stopVariant() }
})

it('rejects a valid build marker whose actual rewrite still targets the shared backend', async () => {
  state.wrongTarget = true
  const server = await variant()
  await expect(server.startVariant('TABLE_BASED')).rejects.toThrow('wrong backend rewrite')
  expect(state.launched.map(({ command }) => command)).toEqual(['java'])
  expect(state.killed).toEqual(['java:SIGTERM'])
})

it('rejects a backend that still serves a dashboard despite standalone mode', async () => {
  state.backendServesHtml = true
  const server = await variant()
  await expect(server.startVariant('TABLE_BASED')).rejects.toThrow('unexpectedly serves a dashboard')
  expect(state.launched.map(({ command }) => command)).toEqual(['java'])
  expect(state.killed).toEqual(['java:SIGTERM'])
})

it('rejects metadata from the wrong backend mode before starting Node', async () => {
  state.mode = 'MOCK'
  const server = await variant()
  await expect(server.startVariant('TABLE_BASED')).rejects.toThrow('mode does not match')
  expect(state.launched.map(({ command }) => command)).toEqual(['java'])
})

it('preserves Javalin export serving and its browser origin', async () => {
  const server = await variant('javalin')
  try {
    await server.startVariant('TABLE_BASED')
    expect(state.launched).toHaveLength(1)
    expect(state.launched[0].args).toContain('-Dqqq.javalin.frontend=next')
    expect(state.launched[0].args.join(' ')).toContain('export-classpath')
    expect(server.SECURITY_UI_URL).toBe('http://127.0.0.1:18775')
  } finally { await server.stopVariant() }
})

it('reuses one mode but restarts Node before changing identity-provider metadata', async () => {
  const server = await variant()
  try {
    await server.startVariant('TABLE_BASED')
    await server.startVariant('TABLE_BASED')
    expect(state.launched).toHaveLength(2)
    state.mode = 'OAUTH2'
    await server.startVariant('OAUTH2')
    expect(state.launched).toHaveLength(4)
    expect(state.killed).toEqual([`${process.execPath}:SIGTERM`, 'java:SIGTERM'])
  } finally { await server.stopVariant() }
  expect(state.killed).toEqual([`${process.execPath}:SIGTERM`, 'java:SIGTERM', `${process.execPath}:SIGTERM`, 'java:SIGTERM'])
})

it('Javalin still requires an export rather than silently switching server modes', async () => {
  state.hasExport = false
  const server = await variant('javalin')
  await expect(server.startVariant('TABLE_BASED')).rejects.toThrow('No Next export')
  expect(state.launched).toEqual([])
})

it('bounds startup requests and cleans up Java when metadata loading aborts', async () => {
  state.failMetadata = true
  const server = await variant()
  await expect(server.startVariant('TABLE_BASED')).rejects.toThrow('metadata request aborted')
  expect(state.signals).toHaveLength(3)
  expect(state.signals.every((signal) => signal instanceof AbortSignal)).toBe(true)
  expect(state.killed).toEqual(['java:SIGTERM'])
})

it('waits for forced Node termination before replacing a variant backend', async () => {
  vi.useFakeTimers()
  const server = await variant()
  try {
    await server.startVariant('TABLE_BASED')
    state.deferNodeExit = true
    state.mode = 'OAUTH2'
    const replacing = server.startVariant('OAUTH2')
    expect(state.launched).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(15_001)
    expect(state.launched).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(50)
    await replacing
    expect(state.killed).toEqual([`${process.execPath}:SIGTERM`, `${process.execPath}:SIGKILL`, 'java:SIGTERM'])
    expect(state.launched).toHaveLength(4)
  } finally { state.deferNodeExit = false; await server.stopVariant() }
})

it('never reuses a same-mode server after its bounded teardown failed', async () => {
  vi.useFakeTimers()
  const server = await variant()
  try {
    await server.startVariant('TABLE_BASED')
    state.ignoreAllKill = true
    const stopping = server.stopVariant().catch((error: Error) => error)
    await vi.advanceTimersByTimeAsync(40_001)
    expect(await stopping).toBeInstanceOf(Error)
    const restarting = server.startVariant('TABLE_BASED').catch((error: Error) => error)
    await vi.advanceTimersByTimeAsync(40_001)
    expect(await restarting).toBeInstanceOf(Error)
    expect(state.launched).toHaveLength(2)
  } finally { state.ignoreAllKill = false; await server.stopVariant() }
})
