/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Checks the UI API document bundled with this app (src/lib/api/openapi/qqq-v1.json) against the
// server's: the committed openapi.yaml of the QQQ checkout being tested, or a running server.
//
//   node scripts/check-ui-api-spec.mjs --server-spec qqq-backend/qqq-middleware-javalin/src/main/resources/openapi/v1/openapi.yaml
//   node scripts/check-ui-api-spec.mjs --server-url http://127.0.0.1:18765
//
// Fails when the majors differ, when the bundled document is newer than the server's, or when the
// bundled document has an operation the server lacks. A server that is newer within the major is
// fine (it only adds), and is reported so the document can be re-vendored.

import { readFileSync } from 'node:fs'
import path from 'node:path'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete']
// operations the app works without (it checks for them), so an older server may lack them
const OPTIONAL_OPERATIONS = new Set(['GET /qqq/v1/version'])
const bundled = JSON.parse(readFileSync(path.resolve('src/lib/api/openapi/qqq-v1.json'), 'utf-8'))

/** @param {string} version @returns {number[] | null} */
function semver(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? '').trim())
  return match ? match.slice(1, 4).map(Number) : null
}

/** @param {number[]} a @param {number[]} b @returns {number} */
function compare(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/** Operations of the bundled document as `METHOD /path`. */
function bundledOperations() {
  return Object.entries(bundled.paths).flatMap(([p, ops]) => Object.keys(ops).filter((m) => HTTP_METHODS.includes(m)).map((m) => `${m.toUpperCase()} ${p}`))
}

/**
 * Reads version and operations from a committed openapi.yaml (sorted, as PublishAPI writes it)
 * without a YAML parser: `info.version`, and the `/qqq/v1/...` keys and their method keys.
 * @param {string} yaml
 */
function readServerYaml(yaml) {
  const lines = yaml.split(/\r?\n/)
  let version = null
  const operations = []
  let inPaths = false
  let currentPath = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === 'info:') {
      for (let j = i + 1; j < lines.length && lines[j].startsWith(' '); j++) {
        const v = /^ {2}version: "?([^"]+)"?$/.exec(lines[j])
        if (v) version = v[1]
      }
    }
    if (/^\S/.test(line)) inPaths = line === 'paths:'
    if (!inPaths) continue
    const pathMatch = /^ {2}"?(\/[^"]+)"?:$/.exec(line)
    if (pathMatch) currentPath = pathMatch[1]
    const methodMatch = /^ {4}(get|post|put|patch|delete):$/.exec(line)
    if (methodMatch && currentPath) operations.push(`${methodMatch[1].toUpperCase()} ${currentPath}`)
  }
  return { version, operations }
}

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

let server
if (option('--server-spec')) {
  server = readServerYaml(readFileSync(option('--server-spec'), 'utf-8'))
} else if (option('--server-url')) {
  const base = option('--server-url').replace(/\/+$/, '')
  const response = await fetch(`${base}/qqq/v1/openapi.json`)
  if (!response.ok) throw new Error(`GET ${base}/qqq/v1/openapi.json: ${response.status}`)
  const document = await response.json()
  server = {
    version: document.info?.version,
    operations: Object.entries(document.paths ?? {}).flatMap(([p, ops]) => Object.keys(ops).filter((m) => HTTP_METHODS.includes(m)).map((m) => `${m.toUpperCase()} ${p}`)),
  }
} else {
  console.error('Usage: check-ui-api-spec.mjs --server-spec <openapi.yaml> | --server-url <base url>')
  process.exit(2)
}

// servers before semver (QQQ 4.1.0-RC.5 and earlier) publish "v1": the 1.0.0 surface
const serverVersion = semver(server.version) ?? (server.version === 'v1' ? [1, 0, 0] : null)
const bundledVersion = semver(bundled.info.version)
const problems = []
if (!serverVersion || !bundledVersion) problems.push(`unrecognised versions: bundled ${bundled.info.version}, server ${server.version}`)
else {
  if (serverVersion[0] !== bundledVersion[0]) problems.push(`major mismatch: bundled ${bundled.info.version}, server ${server.version}`)
  else if (compare(bundledVersion, serverVersion) > 0) {
    const missing = bundledOperations().filter((op) => !server.operations.includes(op) && !OPTIONAL_OPERATIONS.has(op))
    if (missing.length) problems.push(`bundled document ${bundled.info.version} is newer than the server's ${server.version} and has operations the server lacks: ${missing.join(', ')}`)
    else console.log(`Bundled UI API ${bundled.info.version} is newer than the server's ${server.version}; every bundled operation exists on the server.`)
  } else if (compare(bundledVersion, serverVersion) < 0) {
    console.log(`Server UI API ${server.version} is newer than the bundled ${bundled.info.version}: re-vendor src/lib/api/openapi/qqq-v1.json to use its additions.`)
  }
}

if (problems.length) {
  for (const problem of problems) console.error(`UI API spec check: ${problem}`)
  process.exit(1)
}
console.log(`UI API spec check passed: bundled ${bundled.info.version}, server ${server.version}.`)
