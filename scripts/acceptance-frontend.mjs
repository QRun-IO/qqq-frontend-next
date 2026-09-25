/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Serves the production standalone build exactly as the published image does.
import { spawn } from 'node:child_process'
import { cpSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { BUILD_MARKER } from './acceptance-paths.mjs'

const backend = `http://127.0.0.1:${process.env.QQQ_ACCEPTANCE_BACKEND_PORT ?? '18765'}`
const standalone = path.resolve('.next/standalone')
if (!existsSync(path.join(standalone, 'server.js')) || !existsSync(BUILD_MARKER)
  || readFileSync(BUILD_MARKER, 'utf8').trim() !== backend) {
  console.error(`No production build for ${backend}; run node scripts/acceptance.mjs.`)
  process.exit(1)
}
cpSync(path.resolve('.next/static'), path.join(standalone, '.next/static'), { recursive: true })
cpSync(path.resolve('public'), path.join(standalone, 'public'), { recursive: true })
const server = spawn('node', ['server.js'], {
  cwd: standalone,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: process.env.QQQ_ACCEPTANCE_FRONTEND_PORT ?? '13765' },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill('SIGTERM'))
server.on('exit', (code) => process.exit(code ?? 1))
