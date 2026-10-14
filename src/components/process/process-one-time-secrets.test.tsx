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

/** @file One-time process secrets: synchronous handoff, dismissal and retained placeholders. */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QProcessMetaData } from '@/types'
import apiClient from '@/lib/api/client'
import { useProcess } from '@/lib/hooks/use-process'
import { ProcessRun } from './ProcessRun'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/api/metadata', () => ({ loadMetaData: vi.fn().mockResolvedValue({ apps: {}, appTree: [] }) }))
vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: () => ({ data: undefined }) }))
vi.mock('@/lib/api/client', () => ({ default: { post: vi.fn(), get: vi.fn() }, apiUrl: (path: string) => path }))

const process: QProcessMetaData = {
  name: 'createToken', label: 'Create token', tableName: '', minInputRecords: 0, isHidden: false, iconName: '', hasPermission: true,
  stepFlow: 'LINEAR',
  frontendSteps: [
    { name: 'input', label: 'Input', components: [] },
    { name: 'result', label: 'Result', components: [] },
  ],
}
const secret = { label: 'API token', value: 'test-only-one-time-value', masked: 'token-****abcd', usageText: 'test-only-usage' }

/** Render a real process lifecycle with an observable query client.
 * @returns The rendered view and cache.
 */
function renderRun() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(<QueryClientProvider client={client}><ProcessRun processName={process.name} processMetaData={process} /></QueryClientProvider>)
  return { ...view, client }
}

beforeEach(() => { vi.clearAllMocks() })

describe('process one-time secrets', () => {
  it.each(['init', 'step'] as const)('shows %s secrets once and keeps caches clean', async (source) => {
    const user = userEvent.setup()
    if (source === 'step') vi.mocked(apiClient.post).mockResolvedValueOnce({ processUUID: 'run', values: {}, nextStep: 'input' })
    vi.mocked(apiClient.post).mockResolvedValueOnce({ type: 'COMPLETE', processUUID: 'run', values: { oneTimeSecretsMasked: [secret.masked] }, oneTimeSecrets: [secret] })
    const { client } = renderRun()
    if (source === 'step') await user.click(await screen.findByRole('button', { name: /Next|Submit/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Show once' })
    expect(within(dialog).getByRole('textbox', { name: secret.label })).toHaveValue(secret.value)
    expect(within(dialog).getByText(secret.usageText)).toBeInTheDocument()
    const cache = () => JSON.stringify([
      client.getQueryCache().getAll().map((query) => query.state),
      client.getMutationCache().getAll().map((mutation) => mutation.state),
    ])
    expect(cache()).not.toContain(secret.value)
    expect(cache()).not.toContain(secret.usageText)
    await user.click(within(dialog).getByRole('checkbox', { name: "I've copied it" }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByDisplayValue(secret.value)).not.toBeInTheDocument()
    expect(screen.getByText("Shown once. It can't be displayed again.")).toBeInTheDocument()
    expect(screen.getByText(secret.masked)).toBeInTheDocument()
    expect(cache()).not.toContain(secret.value)
    expect(screen.getByRole('heading', { name: 'Create token Complete' })).toHaveFocus()
  })

  it.each([undefined, []])('does not open for absent or empty secrets (%s)', async (oneTimeSecrets) => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ processUUID: 'run', values: { oneTimeSecretsMasked: ['****old', '****other'] }, oneTimeSecrets })
    renderRun()
    await screen.findByRole('heading', { name: 'Create token Complete' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('****old')).toBeInTheDocument()
    expect(screen.getByText('****other')).toBeInTheDocument()
  })

  it('shows the dialog and masked notice on a metadata-defined Result screen', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ processUUID: 'run', nextStep: 'result', values: { oneTimeSecretsMasked: [secret.masked] }, oneTimeSecrets: [secret] })
    renderRun()
    expect(await screen.findByRole('dialog', { name: 'Show once' })).toBeInTheDocument()
    expect(screen.getByText("Shown once. It can't be displayed again.")).toBeInTheDocument()
  })

  it('stores only sanitized process state and clears the separate dialog state', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ processUUID: 'run', values: { oneTimeSecretsMasked: [secret.masked] }, oneTimeSecrets: [secret] })
    const { result } = renderHook(() => useProcess(process.name, process, {}))
    await act(async () => result.current.start())
    expect(result.current.oneTimeSecrets).toEqual([secret])
    expect(JSON.stringify(result.current.state)).not.toContain(secret.value)
    expect(result.current.state).not.toHaveProperty('oneTimeSecrets')
    act(() => result.current.clearOneTimeSecrets())
    expect(result.current.oneTimeSecrets).toEqual([])
    expect(JSON.stringify(result.current)).not.toContain(secret.value)
  })

  it('renders ordinary results without a dialog or masked notice', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ processUUID: 'run', values: {} })
    renderRun()
    await screen.findByRole('heading', { name: 'Create token Complete' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText("Shown once. It can't be displayed again.")).not.toBeInTheDocument()
  })
})
