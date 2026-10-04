/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Standalone staging must preserve the actual build and reject a stale proxy destination. */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, readlinkSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { assertStandaloneTarget, stageStandalone } from '../../scripts/acceptance-standalone.mjs'

const directories: string[] = []
const backend = 'http://127.0.0.1:18775'
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'qqq-standalone-stage-'))
  directories.push(root)
  const source = path.join(root, 'source')
  const staged = path.join(root, 'staged')
  const files: Record<string, string> = {
    '.next/standalone/server.js': 'immutable generated server',
    '.next/standalone/.next/routes-manifest.json': JSON.stringify({ rewrites: { beforeFiles: [], afterFiles: ['qqq', 'data', 'widget', 'metaData', 'download', 'processes', 'possibleValues', 'reports', 'manageSession', 'apis.json', 'api'].map((prefix) => ({ source: `/${prefix}/:path*`, destination: `${backend}/${prefix}/:path*` })), fallback: [] } }),
    '.next/static/chunk.js': 'browser chunk',
    '.next/standalone/node_modules/.pnpm/example/index.js': 'independent dependency',
    'public/icon.svg': '<svg/>',
    'standalone/qqq-server.mjs': 'container entrypoint',
    'standalone/security-headers.mjs': 'policy implementation',
    'standalone/backend-prefixes.json': '[]',
  }
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(source, name); mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); writeFileSync(file, content, { mode: 0o600 })
  }
  symlinkSync('.pnpm/example', path.join(source, '.next/standalone/node_modules/example'))
  return { source, staged }
}

afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })

it('keeps the variant build, static assets and entrypoint after the main build directory is replaced', () => {
  const { source, staged } = fixture()
  stageStandalone(staged, backend, source)
  rmSync(path.join(source, '.next'), { recursive: true })
  expect(() => assertStandaloneTarget(staged, backend)).not.toThrow()
  expect(readFileSync(path.join(staged, 'server.js'), 'utf8')).toBe('immutable generated server')
  expect(readFileSync(path.join(staged, '.next/static/chunk.js'), 'utf8')).toBe('browser chunk')
  expect(readFileSync(path.join(staged, 'public/icon.svg'), 'utf8')).toBe('<svg/>')
  expect(readFileSync(path.join(staged, 'qqq-server.mjs'), 'utf8')).toBe('container entrypoint')
  expect(readlinkSync(path.join(staged, 'node_modules/example'))).toBe('.pnpm/example')
  expect(readFileSync(path.join(staged, 'node_modules/example/index.js'), 'utf8')).toBe('independent dependency')
  expect(statSync(path.join(staged, 'server.js')).mode & 0o777).toBe(0o600)
  expect(statSync(path.join(staged, '.next/static')).mode & 0o777).toBe(0o700)
})

it('rejects an old shared-backend rewrite even with a new valid variant marker', () => {
  const { source, staged } = fixture()
  const file = path.join(source, '.next/standalone/.next/routes-manifest.json')
  writeFileSync(file, readFileSync(file, 'utf8').replace(/:18775\//g, ':18765/'))
  expect(() => stageStandalone(staged, backend, source)).toThrow('wrong backend rewrite')
  expect(readFileSync(path.join(staged, 'acceptance-backend.txt'), 'utf8')).toBe(`${backend}\n`)
})

it('rejects a staged build bound to a different backend port', () => {
  const { source, staged } = fixture()
  stageStandalone(staged, backend, source)
  expect(() => assertStandaloneTarget(staged, 'http://127.0.0.1:18875')).toThrow('No standalone security build')
})
