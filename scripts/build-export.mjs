/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Set export options without platform-specific shell assignment syntax.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const build = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, QQQ_NEXT_OUTPUT: 'export', NEXT_PUBLIC_MOCK_API: 'false' },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => build.kill('SIGTERM'))
build.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
build.on('exit', async (code) => {
  if (code !== 0) process.exit(code ?? 1)
  await import('./check-export-segments.mjs')
})
