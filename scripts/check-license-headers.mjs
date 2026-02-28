#!/usr/bin/env node
/**
 * check-license-headers.mjs
 *
 * Validates that every TypeScript/TSX source file in src/ begins with the
 * Apache 2.0 license header required by this project.
 *
 * Usage:
 *   node scripts/check-license-headers.mjs          # check only (exits 1 on failure)
 *   node scripts/check-license-headers.mjs --fix    # auto-prepend missing headers
 *
 * Integrated via:
 *   pnpm lint:license       → check mode
 *   pnpm lint:license:fix   → fix mode
 *   pnpm lint               → check mode (enforced in CI)
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')
const FIX = process.argv.includes('--fix')

/** Full Apache 2.0 header prepended to files missing it (fix mode). */
const HEADER = `/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */`

/**
 * Canonical identifier used when scanning for the header.
 * Matching a substring instead of the full block makes the check robust to
 * minor formatting differences (trailing spaces, year updates, etc.).
 */
const HEADER_MARKER = 'Licensed under the Apache License, Version 2.0'

/** Directories inside src/ that are generated or third-party — skip entirely. */
const SKIP_DIRS = new Set(['node_modules', '.next', 'coverage', '__generated__', 'out'])

/**
 * Recursively yields every .ts / .tsx file under `dir`, skipping directories
 * listed in SKIP_DIRS.
 *
 * @param {string} dir - Absolute path of the directory to walk.
 * @yields {string} Absolute path of each matching file.
 */
function* walkTs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      yield* walkTs(full)
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      yield full
    }
  }
}

const missing = []

for (const file of walkTs(SRC)) {
  const content = readFileSync(file, 'utf8')
  if (!content.includes(HEADER_MARKER)) {
    missing.push(file)
    if (FIX) {
      writeFileSync(file, HEADER + '\n\n' + content, 'utf8')
      console.log(`  fixed  ${relative(ROOT, file)}`)
    }
  }
}

if (missing.length === 0) {
  console.log('✓ All source files carry the Apache 2.0 license header.')
  process.exit(0)
}

if (FIX) {
  console.log(`\n✓ Added license header to ${missing.length} file(s).`)
  process.exit(0)
}

// Check-only mode: report and fail.
console.error(`\n❌ ${missing.length} file(s) are missing the Apache 2.0 license header:\n`)
for (const f of missing) {
  console.error(`  ${relative(ROOT, f)}`)
}
console.error('\nRun  pnpm lint:license:fix  to add the headers automatically.\n')
process.exit(1)
