/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const dist = process.env.QQQ_NEXT_DIST_DIR || '.next'
const manifest = JSON.parse(readFileSync(path.join(dist, 'prerender-manifest.json'), 'utf8'))
let checked = 0
const missing = []

/** Return every generated segment beneath a route's source directory. */
function segments(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name)
    return entry.isDirectory() ? segments(filename) : entry.name.endsWith('.segment.rsc') ? [filename] : []
  })
}

for (const [route, metadata] of Object.entries(manifest.routes)) {
  // Next explicitly excludes this internal error component from static export.
  if (route === '/_global-error') continue
  if (!metadata.dataRoute?.endsWith('.rsc')) continue
  const directory = path.join(dist, 'server/app', metadata.dataRoute.slice(1, -4) + '.segments')
  assert.ok(existsSync(directory), 'Missing generated segments for ' + route)
  for (const source of segments(directory)) {
    const relative = path.relative(directory, source).split(path.sep).join('/')
    const filename = '__next.' + relative.slice(0, -'.segment.rsc'.length).replaceAll('/', '.') + '.txt'
    const destination = path.join('out', route.slice(1), filename)
    if (!existsSync(destination)) {
      missing.push(destination)
      continue
    }
    assert.deepEqual(readFileSync(destination), readFileSync(source), 'Export bytes differ: ' + destination)
    checked++
  }
}
assert.ok(checked > 0, 'No exported segments were checked')
assert.equal(missing.length, 0, 'Missing browser-addressable segment files:\n' + missing.join('\n'))
console.log('Verified ' + checked + ' browser-addressable segment files and their exact bytes')
