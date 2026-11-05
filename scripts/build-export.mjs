/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Pass build settings through the child environment on Windows and POSIX alike.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], {
  stdio: 'inherit',
  env: { ...process.env, QQQ_NEXT_OUTPUT: 'export', NEXT_PUBLIC_MOCK_API: 'false' },
})
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
