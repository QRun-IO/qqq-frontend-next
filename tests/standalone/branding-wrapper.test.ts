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

/** @file Real standalone wrapper dispatch for declared branding assets. */
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, copyFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'

let child: ChildProcess | undefined
let backend: Server | undefined
let stage: string | undefined
afterEach(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise<void>((resolve) => child!.once('exit', () => resolve()))
    child.kill('SIGKILL')
    await exited
  }
  if (backend) await new Promise<void>((resolve, reject) => backend!.close((error) => error ? reject(error) : resolve()))
  if (stage) rmSync(stage, { recursive: true, force: true })
})

async function startWrapper(metadataFails = false) {
  const requests: string[] = []
  backend = createServer((req, res) => {
    requests.push(req.url ?? '')
    if (req.url === '/qqq/v1/metaData/authentication') {
      if (metadataFails) return
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ type: 'FULLY_ANONYMOUS', branding: { logo: '/brand/logo.png?version=1', icon: '/local-icon.svg' } }))
    } else if (req.url === '/qqq/branding/logo') {
      res.setHeader('Content-Type', 'image/png')
      res.end('owned image bytes')
    } else { res.statusCode = 404; res.end() }
  })
  await new Promise<void>((resolve) => backend!.listen(0, '127.0.0.1', resolve))
  const target = `http://127.0.0.1:${(backend.address() as AddressInfo).port}`
  const lease = createServer()
  await new Promise<void>((resolve) => lease.listen(0, '127.0.0.1', resolve))
  const port = (lease.address() as AddressInfo).port
  await new Promise<void>((resolve) => lease.close(() => resolve()))
  stage = mkdtempSync(path.join(tmpdir(), 'branding-wrapper-'))
  for (const name of readdirSync('standalone').filter((name) => /\.(mjs|json)$/.test(name))) copyFileSync(path.join('standalone', name), path.join(stage, name))
  mkdirSync(path.join(stage, 'public'))
  writeFileSync(path.join(stage, 'public/local-icon.svg'), '<svg>local public bytes</svg>')
  // The controlled Next listener forwards only the existing baked /qqq prefix.
  writeFileSync(path.join(stage, 'server.js'), `const http = require('node:http');
http.createServer(async (req, res) => {
  if (req.url.startsWith('/qqq/')) {
    const response = await fetch(${JSON.stringify(target)} + req.url, { method: req.method });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } else if (req.url === '/local-icon.svg') { res.end(require('node:fs').readFileSync('public/local-icon.svg')); }
  else { res.statusCode = 404; res.end('Next route not found'); }
}).listen(process.env.PORT, '127.0.0.1', () => process.send('ready'));`)
  child = spawn(process.execPath, ['qqq-server.mjs'], { cwd: stage, env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), QQQ_DASHBOARD_CSP_SOURCES: '' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('wrapper startup timeout')), 5000)
    child!.once('message', () => { clearTimeout(timer); resolve() })
    child!.once('exit', (code) => { clearTimeout(timer); reject(new Error(`wrapper exited ${code}`)) })
  })
  return { origin: `http://127.0.0.1:${port}`, requests }
}

it('aliases only declared images through the baked backend route and keeps local files with Next', async () => {
  const { origin, requests } = await startWrapper()
  const response = await fetch(`${origin}/brand/logo.png?cache=2`)
  expect(response.status).toBe(200)
  expect(await response.text()).toBe('owned image bytes')
  expect(requests).toContain('/qqq/branding/logo')
  const before = requests.length
  expect((await fetch(`${origin}/unlisted.png`)).status).toBe(404)
  expect(requests.slice(before)).not.toContain('/qqq/branding/logo')
  expect(await (await fetch(`${origin}/local-icon.svg`)).text()).toBe('<svg>local public bytes</svg>')
  expect(requests).not.toContain('/qqq/branding/icon')
  expect((await fetch(`${origin}/brand/logo.png`, { method: 'HEAD' })).status).toBe(200)
}, 15000)

it('bounds unavailable metadata at startup and preserves the real not-found response', async () => {
  const { origin, requests } = await startWrapper(true)
  const started = Date.now()
  // Alias and existing CSP first-load requests each retain their independent 5s bound.
  const response = await fetch(`${origin}/brand/logo.png`, { signal: AbortSignal.timeout(13000) })
  expect(response.status).toBe(404)
  expect(Date.now() - started).toBeLessThan(12500)
  expect(requests.filter((url) => url === '/qqq/v1/metaData/authentication')).toHaveLength(2)
  expect(requests).not.toContain('/qqq/branding/logo')
}, 15000)
