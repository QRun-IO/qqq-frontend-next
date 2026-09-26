/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Full real-backend acceptance: production build, Playwright suite, then the matrix gate.
// Usage: QQQ_SAMPLE_JAR=<jar> node scripts/acceptance.mjs [--skip-build] [playwright args...]
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ACCEPTANCE_MODE, BUILD_MARKER, EXPORT_CLASSPATH, resolveSampleJar } from './acceptance-paths.mjs'

const args = process.argv.slice(2)
const skipBuild = args.includes('--skip-build')
const passthrough = args.filter((arg) => arg !== '--skip-build')
const backend = `http://127.0.0.1:${process.env.QQQ_ACCEPTANCE_BACKEND_PORT ?? '18765'}`
resolveSampleJar()

function run(command, commandArgs, env = {}) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', env: { ...process.env, ...env } })
  return result.status ?? 1
}

// An acceptance build starts from a clean .next: a Turbopack build reusing its cache after a
// merge was seen to emit stale CSS (the touch-target rules of globals.css were missing), which
// would test something other than the source.
if (!skipBuild) rmSync('.next', { recursive: true, force: true })
if (!skipBuild && ACCEPTANCE_MODE === 'javalin') {
  const status = run('pnpm', ['build:export'], { NEXT_TELEMETRY_DISABLED: '1' })
  if (status !== 0) process.exit(status)
}
if (ACCEPTANCE_MODE === 'javalin') {
  if (!existsSync('out/index.html')) throw new Error('No static export in out/; run without --skip-build.')
  rmSync(EXPORT_CLASSPATH, { recursive: true, force: true })
  mkdirSync(EXPORT_CLASSPATH, { recursive: true })
  cpSync('out', path.join(EXPORT_CLASSPATH, 'next-dashboard'), { recursive: true, filter: (source) => !source.endsWith('mockServiceWorker.js') })
}
if (!skipBuild && ACCEPTANCE_MODE === 'standalone') {
  const status = run('pnpm', ['build'], { QQQ_BACKEND_URL: backend, NEXT_PUBLIC_MOCK_API: 'false', NEXT_TELEMETRY_DISABLED: '1' })
  if (status !== 0) process.exit(status)
  writeFileSync(BUILD_MARKER, backend + '\n')
}
const tests = run('pnpm', ['exec', 'playwright', 'test', '-c', 'tests/acceptance/playwright.config.ts', ...passthrough])
const filtered = passthrough.some((arg) => !arg.startsWith('--project'))
const gate = run('node', ['scripts/acceptance-gate.mjs', ...(filtered ? ['--partial'] : [])])
process.exit(tests || gate)
