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

import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const here = path.dirname(fileURLToPath(import.meta.url))
const jar = path.resolve(process.argv[2] ?? '../qqq/qqq-sample-project/target/qqq-sample-project-4.0.0-RC.3-jar-with-dependencies.jar')
const jarSHA256 = createHash('sha256').update(readFileSync(jar)).digest('hex')
const mode = process.argv[3]
const output = path.resolve(`test-results/real-backend-probe${mode ? '-' + mode : ''}`)
mkdirSync(output, { recursive: true })
const workingDirectory = mkdtempSync(path.join(tmpdir(), 'qqq-next-api-probe-'))
const serverLog = path.join(output, 'server.log')
writeFileSync(serverLog, '')
// Compile into the owned temporary directory so registered customizers are on the classpath.
const compilation = spawnSync('javac', ['-cp', jar, '-d', workingDirectory, path.join(here, 'SampleListServer.java')], { encoding: 'utf8' })
if (compilation.status !== 0) {
  appendFileSync(serverLog, compilation.stderr ?? '')
  rmSync(workingDirectory, { recursive: true, force: true })
  throw new Error(`Sample fixture compilation failed; see ${serverLog}`)
}
const server = spawn('java', ['-cp', jar + path.delimiter + workingDirectory, 'SampleListServer', ...(mode ? [mode] : [])], {
  cwd: workingDirectory,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let startup = ''
let spawnError
let stopped = false
server.on('error', (error) => { spawnError = error })
server.on('exit', () => { stopped = true })
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', (chunk) => {
    appendFileSync(serverLog, chunk)
    startup = (startup + chunk.toString()).slice(-200000)
  })
}

const evidence = { jar, jarSHA256, serverPid: server.pid, checks: [], blockers: [], serverStopped: false }
try {
  const deadline = Date.now() + 30000
  while (!startup.includes('QQQ_ACCEPTANCE_PORT=')) {
    if (spawnError) throw spawnError
    if (stopped) throw new Error(`Sample exited before readiness; see ${serverLog}`)
    if (Date.now() > deadline) throw new Error(`Sample readiness timed out; see ${serverLog}`)
    await delay(100)
  }
  const port = Number(startup.match(/QQQ_ACCEPTANCE_PORT=(\d+)/)?.[1])
  if (!port) throw new Error('Missing ephemeral sample port')
  const base = `http://127.0.0.1:${port}/qqq/v1`
  evidence.baseUrl = base
  let cookies = ''
  async function request(endpoint, options = {}, expectedStatus = 200) {
    const response = await fetch(endpoint.startsWith('/data/') ? base.replace('/qqq/v1', '') + endpoint : base + endpoint, {
      ...options,
      headers: { ...(cookies ? { Cookie: cookies } : {}), ...options.headers },
      signal: AbortSignal.timeout(10000),
    })
    const setCookies = response.headers.getSetCookie()
    if (setCookies.length) cookies = setCookies.map((cookie) => cookie.split(';')[0]).join('; ')
    const content = await response.text()
    let body
    try { body = JSON.parse(content) } catch { body = content }
    evidence.checks.push({ endpoint, status: response.status, keys: typeof body === 'object' ? Object.keys(body) : [] })
    if (response.status !== expectedStatus) throw new Error(`${endpoint} returned ${response.status}, expected ${expectedStatus}`)
    return body
  }

  const authentication = await request('/metaData/authentication')
  evidence.authenticationType = authentication.type
  const form = new FormData()
  form.append('accessToken', 'anonymous')
  const session = await request('/manageSession', { method: 'POST', body: form })
  evidence.sessionEstablished = typeof session.uuid === 'string'
  evidence.sessionCookieReceived = Boolean(cookies)

  const metadata = await request('/metaData?frontendName=qqq-frontend-next&frontendVersion=0.1.0')
  evidence.registryPersonKeys = Object.keys(metadata.tables?.person ?? {})
  evidence.registryPersonHasFields = Boolean(metadata.tables?.person?.fields)
  evidence.requiresFullTableRequest = !evidence.registryPersonHasFields
  const table = await request('/metaData/table/person')
  evidence.tableMetadataTopLevelHasFields = Boolean(table.fields)
  evidence.tableMetadataEnvelopeHasFields = Boolean(table.tableMetaData?.fields)
  if (!evidence.tableMetadataTopLevelHasFields) {
    evidence.blockers.push('loadTableMetaData expects a bare table, but the V1 endpoint wraps it under tableMetaData.')
  }
  if (mode) {
    const missingGet = await request('/table/person/1?includeAssociations=true')
    evidence.missingV1GetReturnsHtml = typeof missingGet === 'string' && /<html/i.test(missingGet)
    if (!evidence.missingV1GetReturnsHtml) throw new Error('Expected missing V1 Get to reach packaged SPA fallback')
    const baseRecord = await request('/data/person/1?includeAssociations=false')
    evidence.baseRecordName = baseRecord.values?.firstName
    const expanded = await request('/data/person/1?includeAssociations=true', {}, mode === 'detail-denied' ? 403 : 200)
    evidence.associationNames = Object.keys(expanded.associatedRecords ?? {})
    evidence.relatedPetRead = table.exposedJoins?.[0]?.joinTable?.readPermission
    evidence.relatedPetInsert = table.exposedJoins?.[0]?.joinTable?.insertPermission
    evidence.legacyBaseReadable = baseRecord.values?.firstName === 'Avery'
    if (!evidence.legacyBaseReadable) throw new Error('Expected independently readable base record')
  }
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filter: { limit: 2 } }) }
  const query = await request('/table/person/query', options)
  evidence.queryRecordCount = query.records?.length
  evidence.queryFirstRecordKeys = Object.keys(query.records?.[0] ?? {})
  const count = await request('/table/person/count?includeDistinct=false', options)
  evidence.count = count.count
  evidence.countType = typeof count.count
  if (query.records?.length !== 2 || count.count !== 5) throw new Error('Unexpected seeded query/count contract')
} catch (error) {
  evidence.error = error.message
  process.exitCode = 1
} finally {
  if (!stopped) server.kill('SIGTERM')
  const deadline = Date.now() + 5000
  while (!stopped && Date.now() < deadline) await delay(50)
  if (!stopped) {
    server.kill('SIGKILL')
    const killDeadline = Date.now() + 5000
    while (!stopped && Date.now() < killDeadline) await delay(50)
  }
  evidence.serverStopped = stopped
  if (!stopped) process.exitCode = 1
  rmSync(workingDirectory, { recursive: true, force: true })
  writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence, null, 2))
}
if (evidence.blockers.length) process.exitCode = 1
