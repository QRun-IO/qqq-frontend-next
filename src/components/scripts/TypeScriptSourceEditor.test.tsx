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


/** @file Real CodeMirror integration tests with a deterministic advisory worker transport. */

import React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TypeScriptSourceEditor } from './TypeScriptSourceEditor'

const transport = vi.hoisted(() => ({ request: vi.fn(), dispose: vi.fn() }))
const originalRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')
const originalBounds = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')
vi.mock('@/lib/scripting/typescript-worker-client', () => ({
  TypeScriptWorkerClient: class { request = transport.request; dispose = transport.dispose },
}))

beforeEach(() => {
  vi.clearAllMocks()
  transport.request.mockImplementation(async (operation: string) => {
    if (operation === 'format') return { edits: [{ from: 7, to: 7, insert: ' ' }, { from: 8, to: 8, insert: ' ' }] }
    if (operation === 'definition') return { definitions: [{ file: 'src/helper.ts', from: 0, to: 3 }] }
    return { diagnostics: [] }
  })
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() })
})
afterEach(() => {
  if (originalRects) Object.defineProperty(Range.prototype, 'getClientRects', originalRects)
  else Reflect.deleteProperty(Range.prototype, 'getClientRects')
  if (originalBounds) Object.defineProperty(Range.prototype, 'getBoundingClientRect', originalBounds)
  else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect')
  vi.restoreAllMocks()
})

describe('CodeMirror isolated TypeScript source editor', () => {
  it('applies formatting as a normal source edit and dispatches cross-file definition navigation', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onNavigate = vi.fn()
    const files = [{ path: 'src/main.ts', content: 'const x=1;' }, { path: 'src/helper.ts', content: 'export const name = "helper";' }]
    const mounted = render(<TypeScriptSourceEditor files={files} active="src/main.ts" readOnly={false} declarations=""
      onChange={onChange} onNavigate={onNavigate} />)
    expect(screen.getByRole('textbox', { name: 'TypeScript source: src/main.ts' })).toHaveAttribute('contenteditable', 'true')
    await user.click(screen.getByRole('button', { name: 'Format source' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('const x = 1;'))
    await user.click(screen.getByRole('button', { name: 'Go to definition (F12)' }))
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith({ file: 'src/helper.ts', from: 0, to: 3 }))
    mounted.unmount()
    expect(transport.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps read-only content noneditable and refuses formatting', async () => {
    const user = userEvent.setup()
    render(<TypeScriptSourceEditor files={[{ path: 'src/main.ts', content: 'const x=1;' }]} active="src/main.ts" readOnly declarations=""
      onChange={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Format source' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'TypeScript source: src/main.ts' })).toHaveAttribute('contenteditable', 'false')
    await user.click(screen.getByRole('button', { name: 'Stop editor analysis' }))
    expect(transport.dispose).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('analysis stopped')
  })
})

