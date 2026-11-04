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
 * @file Typing while the cold language-service worker is still answering. Uses the REAL editor, the REAL
 * worker client (finite queue, stale rejection, deadlines) and the REAL CodeMirror linter; only the browser
 * Worker itself is controlled by the test.
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { TypeScriptSourceEditor } from './TypeScriptSourceEditor'
import { IDE_VERSION } from '@/lib/scripting/typescript-session'

interface Posted { id: number; operation: string; files: Array<{ path: string; content: string }> }

/** A Worker whose answers are released by the test, exactly as a cold worker releases them late. */
class FakeWorker {
  static instances: FakeWorker[] = []
  static auto = false
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  posted: Posted[] = []
  answered = new Set<number>()
  terminated = false
  constructor() { FakeWorker.instances.push(this) }
  postMessage(request: Posted) {
    this.posted.push(request)
    if (FakeWorker.auto) queueMicrotask(() => this.answer(request))
  }
  terminate() { this.terminated = true }
  answer(request: Posted) {
    if (this.terminated || this.answered.has(request.id)) return
    this.answered.add(request.id)
    const content = request.files[0].content
    const at = content.indexOf('"x"')
    const diagnostics = at < 0 ? [] : [{ from: at, to: at + 3, code: 2322, severity: 'error', message: "Type 'string' is not assignable to type 'number'." }]
    this.onmessage?.({ data: { protocol: 'qqq-typescript-ide/1', version: IDE_VERSION, id: request.id, result: { diagnostics } } } as MessageEvent)
  }
  releaseHeld() { for (const request of this.posted) this.answer(request) }
}

const originalRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')
const originalBounds = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')
beforeEach(() => {
  FakeWorker.instances = []
  FakeWorker.auto = false
  vi.stubGlobal('Worker', FakeWorker)
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() })
})
afterEach(() => {
  vi.unstubAllGlobals()
  if (originalRects) Object.defineProperty(Range.prototype, 'getClientRects', originalRects)
  else Reflect.deleteProperty(Range.prototype, 'getClientRects')
  if (originalBounds) Object.defineProperty(Range.prototype, 'getBoundingClientRect', originalBounds)
  else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect')
})

const FINAL = 'export const n: number = "x"'
const keystrokes = Array.from({ length: FINAL.length }, (_, i) => FINAL.slice(0, i + 1))

/** The parent workspace feeds each onChange back as a NEW files array, exactly like the real isolated editor. */
function Workspace({ initial }: { initial: string }) {
  const [files, setFiles] = React.useState([{ path: 'src/main.ts', content: initial }])
  return <TypeScriptSourceEditor files={files} active="src/main.ts" readOnly={false} declarations="" onNavigate={vi.fn()}
    onChange={(content) => setFiles([{ path: 'src/main.ts', content }])} />
}

/** Real edits on the real CodeMirror view, one keystroke at a time (the user's own typing, not a prop replacement). */
function mount(initial: string) {
  const view = render(<Workspace initial={initial} />)
  const cm = EditorView.findFromDOM(view.container.querySelector('.cm-content') as HTMLElement)!
  const typeAll = (text: string) => { for (const ch of text) act(() => { cm.dispatch({ changes: { from: cm.state.doc.length, insert: ch }, userEvent: 'input.type' }) }) }
  return { ...view, typeAll }
}

describe('typing while the cold worker is still answering', () => {
  it('analyses the final buffer once the held requests drain, and reports its error', async () => {
    const editor = mount('')
    editor.typeAll(FINAL)
    const worker = FakeWorker.instances[0]
    // the cold worker finally answers everything it was holding (all of it describes older buffers)
    FakeWorker.auto = true
    worker.releaseHeld()
    // the product must now analyse the CURRENT buffer by itself; no further keystroke is made
    await waitFor(() => expect(worker.posted.some((request) => request.files[0].content === FINAL)).toBe(true), { timeout: 4000 })
    await waitFor(() => expect(editor.container.querySelector('.cm-lintRange-error')).not.toBeNull(), { timeout: 4000 })
  })

  it('never exceeds the finite queue and does not leave a queue-full message once the current buffer is analysed', async () => {
    const editor = mount('')
    editor.typeAll(FINAL)
    const worker = FakeWorker.instances[0]
    expect(worker.posted.filter((request) => !worker.answered.has(request.id)).length).toBeLessThanOrEqual(4)
    FakeWorker.auto = true
    worker.releaseHeld()
    await waitFor(() => expect(worker.posted.some((request) => request.files[0].content === FINAL)).toBe(true), { timeout: 4000 })
    await waitFor(() => expect(editor.container.textContent ?? '').not.toMatch(/queue is full/i), { timeout: 4000 })
  })

  it('re-admits the current buffer after a queue-full refusal caused by something other than the editor typing', async () => {
    const props = { active: 'src/main.ts', readOnly: false, onChange: vi.fn(), onNavigate: vi.fn(), files: [{ path: 'src/main.ts', content: FINAL }] }
    const view = render(<TypeScriptSourceEditor {...props} declarations="" />)
    const worker = FakeWorker.instances[0]
    // six external declaration refreshes while the cold worker holds its answers: the 5th and 6th are refused by the finite queue
    for (let i = 0; i < 6; i++) view.rerender(<TypeScriptSourceEditor {...props} declarations={'declare const sdk' + i + ': number'} />)
    expect(worker.posted.filter((request) => !worker.answered.has(request.id)).length).toBeLessThanOrEqual(4)
    FakeWorker.auto = true
    const before = worker.posted.length
    worker.releaseHeld()
    await waitFor(() => expect(worker.posted.length).toBeGreaterThan(before), { timeout: 4000 })
    await waitFor(() => expect(view.container.querySelector('.cm-lintRange-error')).not.toBeNull(), { timeout: 4000 })
  })
})
