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


/** @file Actual pinned compiler tests over virtual files; user source is never executed. */

import { afterEach, describe, expect, it } from 'vitest'
import ts from 'typescript-editor'
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { TypeScriptSession, IDE_SDK, validateIdeRequest, type IdeRequest } from './typescript-session'

const require = createRequire(import.meta.url)
const directory = path.dirname(require.resolve('typescript-editor'))
const libraries = Object.fromEntries(readdirSync(directory).filter((name) => /^lib\.(es[a-z0-9.]*|decorators[a-z0-9.]*)\.d\.ts$/.test(name))
  .map((name) => ['/lib/' + name, readFileSync(path.join(directory, name), 'utf8')]))
let session: TypeScriptSession | null = null

/** Build a bounded request with deterministic identity. */
function request(content: string, operation: IdeRequest['operation'] = 'diagnostics', position = 0): IdeRequest {
  return { id: 1, operation, files: [{ path: 'src/main.ts', content }], file: 'src/main.ts', position, declarations: IDE_SDK }
}

/** Dispose compiler caches between fixtures. */
function engine() { session = new TypeScriptSession(ts, libraries); return session }

afterEach(() => { session?.dispose(); session = null })

describe('offline TypeScript language service', () => {
  it('reports real strict semantic errors and removes them after a source update', () => {
    const service = engine()
    expect(service.run(request('export const count: number = "wrong";')).diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 2322, severity: 'error' })]))
    expect(service.run(request('export const count: number = 42;')).diagnostics).toEqual([])
  })

  it('completes all lifecycle phases and context without inventing events', () => {
    const service = engine()
    const content = 'import type {Context} from "@qqq/sdk"; const event: Context["event"] = "";'
    const input = request(content, 'completion', content.lastIndexOf('""') + 1)
    input.declarations = ''
    const labels = service.run(input).completions?.map((item) => item.label)
    expect(labels).toEqual(expect.arrayContaining(['PRE_INSERT', 'PRE_UPDATE', 'PRE_DELETE', 'POST_INSERT', 'POST_UPDATE', 'POST_DELETE', 'AFTER_INSERT', 'AFTER_UPDATE', 'AFTER_DELETE', 'CONTEXT']))
    expect(service.run(request('import type {HookEvent} from "@qqq/sdk"; export const event: HookEvent = "AFTER_ARBITRARY";')).diagnostics)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 2322 })]))
  })

  it('narrows committed current records and rejects deleted record assumptions', () => {
    const service = engine()
    const valid = 'import type {Context} from "@qqq/sdk"; export function main(context: Context) { const event = context.payload.event; if(event?.dataState === "CURRENT") return {value:event.record.id}; return {action:"ALLOW"}; }'
    expect(service.run(request(valid)).diagnostics).toEqual([])
    const invalid = 'import type {CommittedEvent} from "@qqq/sdk"; export function main(event: CommittedEvent) { if(event.dataState === "DELETED_METADATA") return event.record.id; return null; }'
    expect(service.run(request(invalid)).diagnostics?.some((item) => item.severity === 'error' && item.message.includes('record'))).toBe(true)
  })

  it('resolves multiple files for definitions, completions and hover', () => {
    const service = engine()
    const content = 'import { order } from "./order.js";\norder.status;\norder.'
    const input = request(content, 'completion', content.length)
    input.files.push({ path: 'src/order.ts', content: 'export const order = {status: "READY", quantity: 4};' })
    expect(service.run(input).completions?.map((item) => item.label)).toContain('status')
    input.operation = 'hover'; input.position = content.indexOf('status') + 2
    expect(service.run(input).hover?.text).toContain('string')
    input.operation = 'definition'; input.position = content.indexOf('order.status') + 2
    expect(service.run(input).definitions).toEqual(expect.arrayContaining([expect.objectContaining({ file: 'src/order.ts' })]))
  })

  it('formats virtual source without emitting or executing code', () => {
    const content = 'export const x={a:1,b:2};'
    const edits = engine().run(request(content, 'format')).edits!
    expect(edits.length).toBeGreaterThan(0)
    const formatted = edits.slice().reverse().reduce((value, edit) => value.slice(0, edit.from) + edit.insert + value.slice(edit.to), content)
    expect(formatted).toContain('a: 1')
    expect(engine().run(request('globalThis.__qqqNeverExecute = true; throw new Error("never execute");')).diagnostics).toBeDefined()
    expect((globalThis as Record<string, unknown>).__qqqNeverExecute).toBeUndefined()
  })

  it('uses supplied scoped SDK types and never resolves ambient Node or browser modules', () => {
    const input = request('import type {Qqq} from "@qqq/sdk";\nexport async function main(qqq:Qqq) { return qqq.query("wrong",["secret"]); }')
    input.declarations = 'declare module "@qqq/sdk" { export interface Qqq { query(table:"purchase_order", fields:Array<"id">): Promise<unknown> } }'
    expect(engine().run(input).diagnostics?.some((item) => item.code === 2345)).toBe(true)
    const denied = engine().run(request('import fs from "node:fs";\nexport const unsafe = window.document;'))
    expect(denied.diagnostics?.some((item) => item.message.includes('node:fs'))).toBe(true)
    expect(denied.diagnostics?.some((item) => item.message.includes('window'))).toBe(true)
  })

  it('rejects path escapes, duplicate files, bad cursor offsets and oversized data before compiler access', () => {
    for (const name of ['../escape.ts', '/escape.ts', 'src\\bad.ts', 'package.json']) {
      const input = request('source'); input.files[0].path = name; input.file = name
      expect(() => validateIdeRequest(input)).toThrow()
    }
    const duplicate = request('source'); duplicate.files.push({ path: 'SRC/MAIN.TS', content: '' })
    expect(() => validateIdeRequest(duplicate)).toThrow()
    expect(() => validateIdeRequest(request('a'.repeat(262145)))).toThrow()
    expect(() => validateIdeRequest(request('short', 'hover', 100))).toThrow()
    expect(() => validateIdeRequest({ ...request('source'), declarations: 'x'.repeat(131073) })).toThrow()
  })
})

