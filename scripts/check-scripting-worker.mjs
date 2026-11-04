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


/** @file Real Chromium smoke test for the generated offline worker, served only on loopback. */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import { chromium } from '@playwright/test'

const workerBytes = await readFile(new URL('../public/scripting-generated/typescript-6.0.3.worker.js', import.meta.url))
const server = http.createServer((request, response) => {
  if (request.url === '/worker.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); response.end(workerBytes)
  } else if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'none'" })
    response.end('<!doctype html><title>Offline TypeScript fixture</title>')
  } else { response.writeHead(404); response.end() }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const requested = []
  page.on('request', (request) => requested.push(new URL(request.url()).pathname))
  await page.goto('http://127.0.0.1:' + server.address().port)
  const result = await page.evaluate(async () => {
    const worker = new Worker('/worker.js')
    let id = 0
    const request = (operation, files, position = 0) => new Promise((resolve, reject) => {
      const requestId = ++id
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker deadline exceeded')) }, 10_000)
      worker.onmessage = (event) => { clearTimeout(timer); if (event.data.id !== requestId || event.data.error) reject(new Error('Worker protocol failed')); else resolve(event.data.result) }
      worker.onerror = () => { clearTimeout(timer); reject(new Error('Worker failed')) }
      worker.postMessage({ id: requestId, operation, files, file: 'src/main.ts', position, declarations: '' })
    })
    try {
      const diagnostics = await request('diagnostics', [{ path: 'src/main.ts', content: 'export const count: number = "wrong";' }])
      const source = 'import { order } from "./order.js";\norder.status;\norder.'
      const files = [{ path: 'src/main.ts', content: source }, { path: 'src/order.ts', content: 'export const order = { status: "READY" };' }]
      const completion = await request('completion', files, source.length)
      const hover = await request('hover', files, source.indexOf('status') + 1)
      const definition = await request('definition', files, source.indexOf('order.status') + 1)
      const formatting = await request('format', [{ path: 'src/main.ts', content: 'export const value={a:1,b:2};' }])
      await request('diagnostics', [{ path: 'src/main.ts', content: 'fetch("https://example.invalid/leak"); globalThis.__qqqNeverExecute = true;' }])
      return { diagnostics, completion, hover, definition, formatting, executed: globalThis.__qqqNeverExecute === true }
    } finally { worker.terminate() }
  })
  assert(result.diagnostics.diagnostics.some((item) => item.code === 2322))
  assert(result.completion.completions.some((item) => item.label === 'status'))
  assert.match(result.hover.hover.text, /string/)
  assert.equal(result.definition.definitions[0].file, 'src/order.ts')
  assert(result.formatting.edits.length > 0)
  assert.equal(result.executed, false)
  assert.deepEqual(requested.sort(), ['/', '/worker.js'])
  console.log('PASS real Chromium: strict diagnostics, multi-file completion/hover/definition, formatting, no source execution or external requests')
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}

