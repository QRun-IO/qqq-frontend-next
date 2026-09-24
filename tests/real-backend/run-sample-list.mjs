/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'
import { checkSampleWrites } from './check-sample-writes.mjs'
import { checkSampleAssociations } from './check-sample-associations.mjs'
import { checkSampleCopy } from './check-sample-copy.mjs'
import { checkSampleWidgets } from './check-sample-widgets.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const jar = path.resolve(process.argv[2] ?? '../qqq/qqq-sample-project/target/qqq-sample-project-4.0.0-RC.3-jar-with-dependencies.jar')
const jarSHA256 = createHash('sha256').update(readFileSync(jar)).digest('hex')
const mode = process.argv[3]
const apiPrefix = mode === 'write' || mode?.startsWith('association-') || mode?.startsWith('copy-') ? '/sample-context' : ''
const output = path.resolve(`test-results/real-backend-${mode ?? 'list'}`)
mkdirSync(output, { recursive: true })
const workingDirectory = mkdtempSync(path.join(tmpdir(), 'qqq-next-list-'))
const serverLog = path.join(output, 'sample.log')
writeFileSync(serverLog, '')
// Compile into the owned temporary directory so registered customizers are on the classpath.
const compilation = spawnSync('javac', ['-cp', jar, '-d', workingDirectory, path.join(here, 'SampleListServer.java')], { encoding: 'utf8' })
if (compilation.status !== 0) {
  appendFileSync(serverLog, compilation.stderr ?? '')
  rmSync(workingDirectory, { recursive: true, force: true })
  throw new Error(`Sample fixture compilation failed; see ${serverLog}`)
}
const sample = spawn('java', ['-cp', jar + path.delimiter + workingDirectory, 'SampleListServer', ...(mode ? [mode] : [])], {
  cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'],
})
let startup = ''
let spawnError
let stopped = false
sample.on('error', (error) => { spawnError = error })
sample.on('exit', () => { stopped = true })
for (const stream of [sample.stdout, sample.stderr]) {
  stream.on('data', (chunk) => {
    appendFileSync(serverLog, chunk)
    startup = (startup + chunk.toString()).slice(-200000)
  })
}
const evidence = { jar, jarSHA256, samplePid: sample.pid, runnerPid: process.pid, requests: [], checks: [], sampleStopped: false }
let nextApp, webServer, browser, page
try {
  const deadline = Date.now() + 30000
  while (!startup.includes('QQQ_ACCEPTANCE_PORT=')) {
    if (spawnError) throw spawnError
    if (stopped) throw new Error(`Sample exited before readiness; see ${serverLog}`)
    if (Date.now() > deadline) throw new Error(`Sample readiness timed out; see ${serverLog}`)
    await delay(100)
  }
  const samplePort = Number(startup.match(/QQQ_ACCEPTANCE_PORT=(\d+)/)?.[1])
  assert.ok(samplePort)
  evidence.samplePort = samplePort
  process.env.NEXT_PUBLIC_MOCK_API = 'false'
  process.env.NEXT_PUBLIC_API_BASE_URL = `${apiPrefix}/qqq/v1`
  process.env.NEXT_TELEMETRY_DISABLED = '1'
  process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = path.join(here, 'offline-fonts.cjs')
  const { default: next } = await import('next')
  nextApp = next({ dev: true, dir: process.cwd(), hostname: '127.0.0.1' })
  await nextApp.prepare()
  const handle = nextApp.getRequestHandler()
  webServer = createServer((incoming, outgoing) => {
    const apiPath = apiPrefix && incoming.url.startsWith(apiPrefix + '/') ? incoming.url.slice(apiPrefix.length) : incoming.url
    if (!apiPath.startsWith('/qqq/v1/') && !apiPath.startsWith('/data/') && !apiPath.startsWith('/widget/') && !apiPath.startsWith('/metaData')) return handle(incoming, outgoing)
    // Transparent same-origin forwarding: real routes, headers, bodies and status codes.
    const upstream = request({ hostname: '127.0.0.1', port: samplePort,
      path: apiPath, method: incoming.method, headers: incoming.headers }, (response) => {
      outgoing.writeHead(response.statusCode, response.headers)
      response.pipe(outgoing)
    })
    upstream.on('error', () => { outgoing.writeHead(502); outgoing.end('Sample unavailable') })
    incoming.pipe(upstream)
  })
  await new Promise((resolve, reject) => {
    webServer.once('error', reject)
    webServer.listen(0, '127.0.0.1', resolve)
  })
  const baseUrl = `http://127.0.0.1:${webServer.address().port}`
  evidence.baseUrl = baseUrl
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } })
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  const pageErrors = []
  const responseTasks = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    const endpoint = new URL(response.url()).pathname.slice(apiPrefix.length)
    if (!endpoint.startsWith('/qqq/v1/') && !endpoint.startsWith('/data/') && !endpoint.startsWith('/widget/') && !endpoint.startsWith('/metaData')) return
    responseTasks.push((async () => {
      const result = { endpoint, browserPath: new URL(response.url()).pathname, method: response.request().method(), status: response.status() }
      result.associationFormat = response.request().headers()['x-qqq-association-format']
      result.params = Object.fromEntries(new URL(response.url()).searchParams)
      // Copy asserts source-read status directly and awaits every mutation body; background reads can be cancelled by navigation.
      const copyMode = mode?.startsWith('copy-')
      if (/\/table\/person\/(query|count)$/.test(endpoint) || (endpoint.startsWith('/data/')
        && (!copyMode || (endpoint === '/data/person' && result.method === 'POST')))) {
        const contentType = response.request().headers()['content-type'] ?? ''
        result.body = contentType.includes('multipart/form-data')
          ? Object.fromEntries(await new Response(response.request().postDataBuffer(), { headers: { 'Content-Type': contentType } }).formData())
          : response.request().postDataJSON()
        result.response = await response.json()
      }
      if (!copyMode && /\/metaData(?:\/table\/person)?$/.test(endpoint)) {
        const metadata = await response.json()
        result.hasFullPersonFields = Boolean(metadata.fields ?? metadata.tables?.person?.fields)
      }
      evidence.requests.push(result)
    })())
  })
  if (mode === 'widgets') {
    await checkSampleWidgets({ page, baseUrl, samplePort, apiPrefix, output, evidence })
    await Promise.all(responseTasks)
    assert.deepEqual(pageErrors, [])
  } else if (mode?.startsWith('copy-')) {
    await checkSampleCopy({ page, baseUrl, samplePort, apiPrefix, output, evidence, mode })
    await Promise.all(responseTasks)
    assert.deepEqual(pageErrors, [])
    const inserts = evidence.requests.filter(({ endpoint, method }) => endpoint === '/data/person' && method === 'POST')
    assert.equal(inserts.length, mode === 'copy-denied' ? 1 : 2)
    assert.equal(inserts[0].associationFormat, undefined)
    assert.equal(inserts[0].body.associations, undefined)
    assert.equal(inserts[0].body.id, undefined)
    if (mode !== 'copy-denied') {
      assert.equal(inserts[1].associationFormat, 'record-v1')
      assert.equal(inserts[1].body.id, undefined)
      const groups = JSON.parse(inserts[1].body.associations)
      assert.deepEqual(Object.keys(groups).sort(), mode === 'copy-named' ? ['care group / primary', 'pets'] : ['pets'])
      if (mode === 'copy-empty') assert.deepEqual(groups, { pets: [] })
      for (const pets of Object.values(groups)) {
        for (const pet of pets) {
          assert.equal(pet.values.id, undefined)
          assert.equal(pet.values.personId, undefined)
          assert.ok(Array.isArray(pet.associatedRecords.notes))
          for (const note of pet.associatedRecords.notes) {
            assert.equal(note.values.id, undefined)
            assert.equal(note.values.petId, undefined)
            assert.deepEqual(note.values.payload, { base64: 'AAH/gEEA' })
            assert.equal(note.values.fileName, 'sample.bin')
            assert.equal(note.values.flag, false)
          }
        }
      }
    }
    assert.ok(evidence.requests.filter(({ method }) => ['POST', 'PUT', 'DELETE'].includes(method))
      .every(({ browserPath }) => browserPath.startsWith(apiPrefix + '/')))
  } else if (mode === 'write') {
    await checkSampleWrites({ page, baseUrl, samplePort, apiPrefix, output, evidence })
    await Promise.all(responseTasks)
    assert.deepEqual(pageErrors, [])
    assert.ok(evidence.requests.filter(({ method }) => ['POST', 'PUT', 'DELETE'].includes(method))
      .every(({ browserPath }) => browserPath.startsWith(apiPrefix + '/')))
  } else if (mode?.startsWith('association-')) {
    await checkSampleAssociations({ page, baseUrl, samplePort, apiPrefix, output, evidence, mode })
    await Promise.all(responseTasks)
    assert.deepEqual(pageErrors, [])
    const gets = evidence.requests.filter(({ endpoint }) => endpoint === '/data/person/1')
    assert.ok(gets.some(({ params, status }) => params.includeAssociations === 'false' && status === 200))
    assert.ok(gets.some(({ params, status }) => params.includeAssociations === 'true' && status === (mode === 'association-denied' ? 403 : 200)))
    const inserts = evidence.requests.filter(({ endpoint, method }) => endpoint === '/data/pet' && method === 'POST')
    assert.equal(inserts.length, 1)
    assert.equal(inserts[0].body.personId, mode === 'association-named' ? '2' : '1')
    assert.equal(inserts[0].body.associations, undefined)
    if (mode === 'association-named') assert.equal(inserts[0].body.birthDate, '1990-01-15')
  } else if (mode) {
    const expandedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/data/person/1'
      && new URL(response.url()).searchParams.get('includeAssociations') === 'true', { timeout: 45000 })
    await page.goto(`${baseUrl}/app/person/1?tab=related`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    const detail = page.locator('[data-qqq-id="record-view-person"]')
    await detail.waitFor({ timeout: 45000 })
    await detail.getByRole('heading', { name: 'Avery Sample' }).waitFor()
    const expanded = await expandedResponse
    assert.equal(expanded.status(), mode === 'detail-denied' ? 403 : 200)
    if (mode === 'detail-denied') {
      await page.getByText('Related records could not be loaded.', { exact: true }).waitFor()
      await detail.getByText('Related records are unavailable.', { exact: true }).waitFor()
    } else {
      await detail.getByText('Charlie', { exact: true }).waitFor()
    }
    assert.equal(await detail.getByText('No Pets records', { exact: true }).count(), 0)
    const add = detail.getByRole('button', { name: '+ Add Pet' })
    assert.equal(await add.isEnabled(), true)
    await add.click()
    const dialog = page.getByRole('dialog', { name: 'Add Pet' })
    await dialog.waitFor()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await page.screenshot({ path: path.join(output, 'person-detail.png'), fullPage: true })
    await Promise.all(responseTasks)
    assert.deepEqual(pageErrors, [])
    const gets = evidence.requests.filter(({ endpoint }) => endpoint === '/data/person/1')
    assert.ok(gets.some(({ params, status, response }) => params.includeAssociations === 'false' && status === 200 && response.values.firstName === 'Avery'))
    assert.ok(gets.some(({ params, status }) => params.includeAssociations === 'true' && status === (mode === 'detail-denied' ? 403 : 200)))
    assert.ok(!evidence.requests.some(({ endpoint }) => endpoint === '/qqq/v1/table/person/1'))
    if (mode === 'detail-allowed') {
      const expandedRecord = gets.find(({ params }) => params.includeAssociations === 'true').response
      assert.ok(expandedRecord.associatedRecords.pets.length > 0)
      assert.equal(expandedRecord.associatedRecords.pet, undefined)
    }
    if (mode === 'detail-allowed') {
      await page.goto(`${baseUrl}/app/pet/1?tab=section-basicInfo`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      const petDetail = page.locator('[data-qqq-id="record-view-pet"]')
      await petDetail.getByText('Charlie', { exact: true }).waitFor({ timeout: 30000 })
      const owner = petDetail.getByRole('link', { name: 'Avery Sample', exact: true }).first()
      await owner.waitFor()
      const metadataResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/metaData/table/person')
      const previewResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/data/person/1')
      await owner.hover()
      assert.equal((await metadataResponse).status(), 200)
      const preview = await previewResponse
      assert.equal(preview.status(), 200)
      assert.equal(new URL(preview.url()).searchParams.get('includeAssociations'), 'false')
      await page.getByRole('link', { name: 'View Record', exact: true }).waitFor()
      assert.deepEqual(pageErrors, [])
      await page.screenshot({ path: path.join(output, 'pet-owner-preview.png'), fullPage: true })
    }
    evidence.checks.push('Base detail visible without query joins; legacy base/expanded requests independent; Add Pet dialog opens; permitted named pets display and denied reads remain unavailable; no page errors')
  } else {
    await page.goto(`${baseUrl}/app/person`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.getByRole('grid', { name: 'Person records' }).waitFor({ timeout: 45000 })
    await page.getByRole('gridcell', { name: 'Avery', exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('gridcell', { name: 'Morgan', exact: true }).waitFor({ timeout: 15000 })
    assert.equal(await page.locator('[data-qqq-id^="grid-row-"]').count(), 5)
    await page.getByRole('button', { name: 'Create new Person record' }).waitFor()
    assert.equal(await page.locator('[data-qqq-id="record-query-person"]').getByRole('alert').count(), 0)
    await page.screenshot({ path: path.join(output, 'person-list.png'), fullPage: true })
    await Promise.all(responseTasks)
    assert.deepEqual(pageErrors, [])
    const registry = evidence.requests.find(({ endpoint }) => endpoint.endsWith('/metaData'))
    const fullTable = evidence.requests.find(({ endpoint }) => endpoint.endsWith('/metaData/table/person'))
    assert.equal(registry?.hasFullPersonFields, false)
    assert.equal(fullTable?.hasFullPersonFields, true)
    const queries = evidence.requests.filter(({ endpoint }) => endpoint.endsWith('/person/query'))
    const counts = evidence.requests.filter(({ endpoint }) => endpoint.endsWith('/person/count'))
    assert.ok(queries.some(({ status, response }) => status === 200 && response.records.length === 5))
    assert.ok(counts.some(({ status, response }) => status === 200 && response.count === 5))
    assert.ok(evidence.requests.some(({ endpoint, status }) => endpoint.endsWith('/manageSession') && status === 200))
    assert.ok(evidence.requests.every(({ status }) => status === 200))
    evidence.checks.push('Real MOCK session, light registry and full table metadata, five seeded rows, Count 5, base Create control, no browser errors')
  }
  evidence.passed = true
} catch (error) {
  evidence.error = error.stack ?? error.message
  if (page) {
    evidence.visibleAlerts = await page.getByRole('alert').allTextContents()
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
  }
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (webServer) {
    webServer.closeAllConnections()
    await new Promise((resolve) => webServer.close(resolve))
  }
  if (nextApp) await nextApp.close()
  if (!stopped) sample.kill('SIGTERM')
  const deadline = Date.now() + 5000
  while (!stopped && Date.now() < deadline) await delay(50)
  if (!stopped) {
    sample.kill('SIGKILL')
    const killDeadline = Date.now() + 5000
    while (!stopped && Date.now() < killDeadline) await delay(50)
  }
  evidence.sampleStopped = stopped
  evidence.webServerStopped = !webServer?.listening
  if (!stopped || webServer?.listening) process.exitCode = 1
  rmSync(workingDirectory, { recursive: true, force: true })
  writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence, null, 2))
}
// Next's development watcher keeps the event loop alive after closing its server.
process.exit(process.exitCode ?? 0)
