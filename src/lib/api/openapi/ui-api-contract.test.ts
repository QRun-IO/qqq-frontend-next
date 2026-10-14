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

/**
 * @file UI API contract — every HTTP call in `src/` must be an operation of the vendored UI API
 * document (`qqq-v1.json` plus `extensions/*.json`), or a listed, shrinking exception
 * (`ui-api-calls.ts`). The app talks to the backend only through `/qqq/v1`, so a CLI, TUI or
 * native client built from the same document can do everything the web UI does.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { SUPPORTED_UI_API, parseSemver } from '../ui-api-version'
import { DYNAMIC_CALL_SITES, OFF_SPEC_CALLS, OFF_SPEC_CEILING, PATH_HELPERS } from './ui-api-calls'

const SRC = path.resolve(__dirname, '../../..')
const OPENAPI_DIR = __dirname

interface OpenApiDocument {
  info: { version: string }
  paths: Record<string, Record<string, unknown>>
}

/** One HTTP call found in the source. */
interface FoundCall {
  key: string
  site: string
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete']

/**
 * Normalises a path: drops the query string, the `/qqq/v1` prefix and doubled parameters, and
 * writes every parameter as `{}`.
 *
 * @param raw - Path or template.
 * @returns The normalised template.
 */
export function normalisePath(raw: string): string {
  return raw
    .replace(/\?.*$/s, '')
    .replace(/\$\{[^}]*\}/g, '{}')
    .replace(/\{[^}]*\}/g, '{}')
    .replace(/(\{\})+/g, '{}')
    .replace(/^\/qqq\/v1(?=\/)/, '')
}

/**
 * Reads the vendored documents.
 *
 * @returns The core document and the extension documents.
 */
function loadDocuments(): OpenApiDocument[] {
  const documents = [JSON.parse(readFileSync(path.join(OPENAPI_DIR, 'qqq-v1.json'), 'utf-8')) as OpenApiDocument]
  const extensionsDir = path.join(OPENAPI_DIR, 'extensions')
  try {
    for (const name of readdirSync(extensionsDir).filter((f) => f.endsWith('.json'))) {
      documents.push(JSON.parse(readFileSync(path.join(extensionsDir, name), 'utf-8')) as OpenApiDocument)
    }
  } catch {
    // no extension documents vendored yet
  }
  return documents
}

/**
 * The operations of the vendored documents as `METHOD /path` keys.
 *
 * @returns The keys.
 */
function specOperations(): Set<string> {
  const keys = new Set<string>()
  for (const document of loadDocuments()) {
    for (const [specPath, operations] of Object.entries(document.paths)) {
      for (const method of Object.keys(operations).filter((m) => HTTP_METHODS.includes(m))) {
        keys.add(`${method.toUpperCase()} ${normalisePath(specPath)}`)
      }
    }
  }
  return keys
}

/**
 * Lists the source files the app ships (no tests, mocks, stories or declarations).
 *
 * @param dir - Directory to walk.
 * @returns Absolute file paths.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return name === 'mocks' ? [] : sourceFiles(full)
    return /\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.tsx?$|\.d\.ts$/.test(name) ? [full] : []
  })
}

/**
 * Resolves `${CONSTANT}` references to string constants declared in the same file.
 *
 * @param template - The path template.
 * @param source - The file's source.
 * @returns The template with known constants substituted.
 */
function resolveConstants(template: string, source: string): string {
  const withHelpers = template.replace(/\$\{(\w+)\([^)]*\)\}/g, (whole, helper: string) => PATH_HELPERS[helper] ?? whole)
  return withHelpers.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (whole, name: string) => {
    const declaration = new RegExp(`const ${name}\\s*=\\s*(['"\`])([^'"\`]*)\\1`).exec(source)
    // only path prefixes: a constant used as a path parameter (a table or process name) stays a parameter
    return declaration && declaration[2].startsWith('/') ? declaration[2] : whole
  })
}

/**
 * Finds every backend call in the source: `apiClient.<method>(...)`, `apiUrl(...)` (links, GET)
 * and `openStream(...)` (assistant streams).
 *
 * @returns The calls, and the dynamic call sites seen.
 */
function findCalls(): { calls: FoundCall[]; dynamicSites: Set<string>; unknownDynamic: string[] } {
  const calls: FoundCall[] = []
  const dynamicSites = new Set<string>()
  const unknownDynamic: string[] = []
  const pattern = /\b(?:apiClient\.(get|post|put|patch|delete)\s*(?:<[^()]*>)?|(apiUrl)|(openStream))\(\s*(?:(['"`])((?:\\.|(?!\4)[\s\S])*?)\4|([A-Za-z_$][\w$.]*(?:\([^)]*\))?))/g

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf-8')
    const relative = path.relative(SRC, file).split(path.sep).join('/')
    for (const match of source.matchAll(pattern)) {
      if (/function\s+$/.test(source.slice(Math.max(0, match.index - 30), match.index))) continue
      const line = source.slice(0, match.index).split('\n').length
      const site = `${relative}:${line}`
      const literal = match[5]
      if (literal === undefined) {
        const key = `${relative}#${match[6].trim()}`
        if (key in DYNAMIC_CALL_SITES) {
          dynamicSites.add(key)
          for (const listed of DYNAMIC_CALL_SITES[key]) calls.push({ key: listed, site })
        } else {
          unknownDynamic.push(`${site} ${key}`)
        }
        continue
      }
      let method = match[1]?.toUpperCase() ?? 'GET'
      if (match[3]) {
        const init = /method:\s*'([A-Z]+)'/.exec(source.slice(match.index, match.index + 300))
        method = init ? init[1] : 'GET'
      }
      if (match[2] && literal === '/table/') continue
      calls.push({ key: `${method} ${normalisePath(resolveConstants(literal, source))}`, site })
    }
  }
  return { calls, dynamicSites, unknownDynamic }
}

describe('UI API contract', () => {
  const operations = specOperations()
  const { calls, dynamicSites, unknownDynamic } = findCalls()
  const offSpec = new Set(OFF_SPEC_CALLS.map((c) => `${c.method} ${c.path}`))

  it('finds the calls the app makes', () => {
    expect(calls.length).toBeGreaterThan(50)
  })

  it('makes every call through an operation of the UI API document (or a listed exception)', () => {
    const unknown = calls.filter((c) => !operations.has(c.key) && !offSpec.has(c.key)).map((c) => `${c.site} ${c.key}`)
    expect(unknown, 'calls missing from the UI API document: add the operation to QQQ (or an extension) and re-vendor the document').toEqual([])
  })

  it('has no unlisted computed call paths', () => {
    expect(unknownDynamic, 'write the path as a literal, or list the call site in DYNAMIC_CALL_SITES').toEqual([])
  })

  it('lists only exceptions that are still used (the list only shrinks)', () => {
    const used = new Set(calls.map((c) => c.key))
    expect(OFF_SPEC_CALLS.filter((c) => !used.has(`${c.method} ${c.path}`) || operations.has(`${c.method} ${c.path}`)).map((c) => `${c.method} ${c.path}`)).toEqual([])
    expect(Object.keys(DYNAMIC_CALL_SITES).filter((key) => !dynamicSites.has(key))).toEqual([])
  })

  it('never grows the off-spec list (ship the extension and vendor its document instead)', () => {
    expect(OFF_SPEC_CALLS.length, 'OFF_SPEC_CALLS may only shrink: add the operation to the backend as a UI API extension and vendor its document').toBeLessThanOrEqual(OFF_SPEC_CEILING)
  })

  it('vendors a document inside the supported UI API range', () => {
    const version = parseSemver(loadDocuments()[0].info.version)
    expect(version).not.toBeNull()
    expect(version?.[0]).toBeLessThan(SUPPORTED_UI_API.belowMajor)
  })

  it('normalises paths', () => {
    expect(normalisePath(resolveConstants('${apiVersionPrefix(api)}/metaData/table/${tableName}', ''))).toBe('/{}/{}/metaData/table/{}')
    expect(normalisePath('/qqq/v1/{applicationApiPath}/{applicationApiVersion}/metaData/table/{tableName}')).toBe('/{}/{}/metaData/table/{}')
    expect(normalisePath('/qqq/v1/table/{tableName}/query')).toBe('/table/{}/query')
    expect(normalisePath('/reports/${encodeURIComponent(name)}?${params}')).toBe('/reports/{}')
    expect(normalisePath('/table/${t}/${pk}/${f}/${file}${query}')).toBe('/table/{}/{}/{}/{}')
  })
})
