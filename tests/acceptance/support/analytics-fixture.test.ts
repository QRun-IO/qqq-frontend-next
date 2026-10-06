/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { once } from 'node:events'
import { connect, type Socket } from 'node:net'
import { afterEach, expect, it, vi } from 'vitest'

interface Service {
  origin: string
  deniedOrigin: string
  close: () => Promise<void>
}
type Fixture = (args: Record<string, never>, provide: (service: Service) => Promise<void>) => Promise<void>
const state = vi.hoisted(() => ({ fixture: undefined as Fixture | undefined, stopError: undefined as Error | undefined }))

// Run the actual fixture; replace only test registration and the Java process boundary.
vi.mock('@playwright/test', () => ({ expect }))
vi.mock('./fixtures', () => ({
  expect,
  open: () => {},
  test: { extend: (fixtures: { analytics: Fixture }) => {
    state.fixture = fixtures.analytics
    return () => {}
  } },
}))
vi.mock('../specs/security/support/variant', () => ({
  SECURITY_UI_URL: 'http://127.0.0.1:18775',
  startVariant: async () => {},
  resetVariant: async () => {},
  stopVariant: async () => { if (state.stopError) throw state.stopError },
}))

const sockets: Socket[] = []
const services: Service[] = []
const running: Promise<void>[] = []

async function socketAt(origin: string) {
  const socket = connect({ host: '127.0.0.1', port: Number(new URL(origin).port) })
  sockets.push(socket)
  await once(socket, 'connect')
  return socket
}

async function refused(origin: string) {
  const socket = connect({ host: '127.0.0.1', port: Number(new URL(origin).port) })
  sockets.push(socket)
  return new Promise<string>((resolve) => {
    socket.once('connect', () => { socket.destroy(); resolve('connected') })
    socket.once('error', (error: NodeJS.ErrnoException) => resolve(error.code ?? 'unknown'))
  })
}

afterEach(async () => {
  for (const socket of sockets) socket.destroy()
  await Promise.allSettled(running)
  await Promise.allSettled(services.map((service) => service.close()))
  sockets.length = 0; services.length = 0; running.length = 0
  state.stopError = undefined
})

it.each(['preconnected', 'incomplete request'])('closes both owned listeners and %s clients during fixture teardown', async (kind) => {
  await import('../specs/security/analytics-csp.spec')
  let service!: Service
  const clients: Socket[] = []
  const closed: Promise<unknown>[] = []
  const fixture = state.fixture!({}, async (value) => {
    service = value; services.push(value)
    for (const origin of [value.origin, value.deniedOrigin]) {
      const socket = await socketAt(origin)
      clients.push(socket)
      // A partial header keeps the HTTP parser active without invoking a fixture route.
      if (kind === 'incomplete request') socket.write('POST /collect HTTP/1.1\r\nHost: 127.0.0.1\r\n')
      socket.on('error', () => {})
      closed.push(new Promise<void>((resolve) => socket.once('close', () => resolve())))
    }
  })
  running.push(fixture)
  await fixture
  await Promise.all(closed)
  expect(clients.every((socket) => socket.destroyed)).toBe(true)
  expect(await refused(service.origin)).toBe('ECONNREFUSED')
  expect(await refused(service.deniedOrigin)).toBe('ECONNREFUSED')
})

it('still closes both owned listeners when stopping the backend rejects, preserving that error', async () => {
  await import('../specs/security/analytics-csp.spec')
  const failure = new Error('owned backend stop failed')
  state.stopError = failure
  let service!: Service
  const fixture = state.fixture!({}, async (value) => { service = value; services.push(value) })
  running.push(fixture)
  await expect(fixture).rejects.toBe(failure)
  expect(await refused(service.origin)).toBe('ECONNREFUSED')
  expect(await refused(service.deniedOrigin)).toBe('ECONNREFUSED')
})
