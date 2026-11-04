/*
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
 */

/** @file Copy the pinned trusted PDF worker; never copy uploaded files. */
import { createRequire } from 'node:module'
import { readFile, mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
const require = createRequire(import.meta.url)
const entry = require.resolve('pdfjs-dist/package.json')
const root = path.dirname(entry)
const pkg = JSON.parse(await readFile(entry, 'utf8'))
if (pkg.version !== '6.4.299') throw new Error('Pinned PDF.js 6.4.299 is required')
const output = new URL('../public/pdf-generated/', import.meta.url)
await mkdir(output, { recursive: true })
await copyFile(path.join(root, 'build/pdf.worker.min.mjs'), new URL('pdf-6.4.299.worker.js', output))
await copyFile(path.join(root, 'LICENSE'), new URL('LICENSE', output))
console.log('Prepared pinned PDF.js 6.4.299 worker and Apache-2.0 license')
