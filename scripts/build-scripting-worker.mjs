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


/** @file Build the offline editor worker from pinned trusted dependencies; never reads a script project. */

import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript-editor')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (ts.version !== '6.0.3') throw new Error('Pinned editor TypeScript 6.0.3 is required')
const libraryDirectory = path.dirname(require.resolve('typescript-editor'))
const libraries = Object.create(null)

/** Include only the standard ES2022 library closure, never DOM, Node or project packages. */
async function includeLibrary(name) {
  if (!/^lib\.[a-z0-9.]+\.d\.ts$/.test(name)) throw new Error('Invalid shipped library name')
  if (libraries['/lib/' + name] !== undefined) return
  const source = await readFile(path.join(libraryDirectory, name), 'utf8')
  libraries['/lib/' + name] = source
  for (const reference of source.matchAll(/<reference lib="([a-z0-9.]+)"\s*\/>/g)) await includeLibrary('lib.' + reference[1] + '.d.ts')
}
await includeLibrary('lib.es2022.d.ts')
const compiler = (await readFile(require.resolve('typescript-editor'), 'utf8')).replace(/\/\/# sourceMappingURL=.*$/gm, '')
const source = await readFile(path.join(root, 'src/lib/scripting/typescript-session.ts'), 'utf8')
const engine = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
if (/require\s*\(/.test(engine)) throw new Error('Editor engine must have no runtime module imports')
const worker = compiler + '\n;(() => {\nconst exports = {};\n' + engine + '\n' +
  'const session = new exports.TypeScriptSession(ts, ' + JSON.stringify(libraries) + ');\n' +
  `self.onmessage = (event) => {
    const id = event.data?.id;
    try {
      const result = session.run(event.data);
      if (new TextEncoder().encode(JSON.stringify(result)).length > 262144) throw new Error("Result limit");
      self.postMessage({ protocol: "qqq-typescript-ide/1", id, version: "6.0.3", result });
    } catch {
      self.postMessage({ protocol: "qqq-typescript-ide/1", id, version: "6.0.3", error: "Editor analysis could not be completed" });
    }
  };\n})();\n`
const destination = path.join(root, 'public/scripting-generated')
await mkdir(destination, { recursive: true })
await writeFile(path.join(destination, 'typescript-6.0.3.worker.js'), worker)
await writeFile(path.join(destination, 'LICENSE.txt'), await readFile(path.join(libraryDirectory, '../LICENSE.txt'), 'utf8'))
await writeFile(path.join(destination, 'ThirdPartyNoticeText.txt'), await readFile(path.join(libraryDirectory, '../ThirdPartyNoticeText.txt'), 'utf8'))
console.log('Generated offline TypeScript 6.0.3 worker (' + Buffer.byteLength(worker) + ' bytes, ' + Object.keys(libraries).length + ' standard libraries)')

