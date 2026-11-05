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

/** @file Creation stays separate from legacy workflows and avoids ambiguous retry. */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { createScriptProject } from '@/lib/api/scripting'
import { CreateIsolatedScript } from './CreateIsolatedScript'

vi.mock('@/lib/api/scripting', () => ({ createScriptProject: vi.fn() }))
const discovery = vi.hoisted(() => ({ installed: true }))
vi.mock('@/lib/api/ui-api-extensions', () => ({ useUiApiExtensionInstalled: () => discovery.installed }))
vi.mock('./IsolatedScriptEditor', () => ({ IsolatedScriptEditor: ({ scriptId }: { scriptId: number }) => <div>Isolated project {scriptId}</div> }))

/** Mount a fresh query cache. */
function mount() {
  return render(<QueryClientProvider client={new QueryClient()}><CreateIsolatedScript /></QueryClientProvider>)
}

describe('isolated project creation', () => {
  beforeEach(() => { vi.clearAllMocks(); discovery.installed = true })
  it('opens the isolated editor only after successful semantic creation', async () => {
    vi.mocked(createScriptProject).mockResolvedValue(17)
    mount()
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Receiving context' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create TypeScript project' }))
    await screen.findByText('Isolated project 17')
    expect(createScriptProject).toHaveBeenCalledWith('Receiving context')
  })
  it('blocks another creation after an uncertain transport result', async () => {
    vi.mocked(createScriptProject).mockRejectedValue(new AxiosError('timeout', 'ECONNABORTED'))
    mount()
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Receiving context' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create TypeScript project' }))
    await screen.findByRole('status')
    expect(screen.getByRole('button', { name: 'Create TypeScript project' })).toBeDisabled()
    expect(createScriptProject).toHaveBeenCalledTimes(1)
  })
  it('does not offer source intake without the scripting extension', () => {
    discovery.installed = false
    mount()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
