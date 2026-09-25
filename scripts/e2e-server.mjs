/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Serves the production standalone build (`pnpm build`) for the mocked e2e suite. No backend
// runs: the specs answer every API call with page.route mocks (tests/e2e/api-mocks.ts).
import { spawn } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'

const standalone = path.resolve('.next/standalone')
if (!existsSync(path.join(standalone, 'server.js'))) {
  console.error('No standalone build in .next/standalone; run `pnpm build` first.')
  process.exit(1)
}
cpSync(path.resolve('.next/static'), path.join(standalone, '.next/static'), { recursive: true })
cpSync(path.resolve('public'), path.join(standalone, 'public'), { recursive: true })
const server = spawn('node', ['server.js'], {
  cwd: standalone,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: process.env.QQQ_E2E_PORT ?? '3000' },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill('SIGTERM'))
server.on('exit', (code) => process.exit(code ?? 1))
