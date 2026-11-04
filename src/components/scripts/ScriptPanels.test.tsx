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

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import { testScript } from '@/lib/api/developer'
import { ScriptTest } from './ScriptPanels'

vi.mock('@/lib/api/developer', () => ({ testScript: vi.fn() }))

beforeEach(() => {
  vi.mocked(testScript).mockReset()
  vi.mocked(testScript).mockImplementation((_request, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
  }))
})

function mount() {
  return render(<QueryClientProvider client={new QueryClient()}>
    <ScriptTest idKey="test" scriptId={1} files={{ 'main.ts': 'return 1' }} inputFields={[]} outputFields={[]} />
  </QueryClientProvider>)
}

it('aborts observation when the test panel unmounts', async () => {
  const { unmount } = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
  await waitFor(() => expect(testScript).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(testScript).mock.calls[0][1]?.signal
  expect(signal?.aborted).toBe(false)
  await act(async () => unmount())
  expect(signal?.aborted).toBe(true)
})

it('stops waiting with an honest accessible message and permits another test', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
  const stop = await screen.findByRole('button', { name: 'Stop waiting' })
  fireEvent.click(stop)
  expect(await screen.findByRole('alert')).toHaveTextContent('server test may still be running')
  expect(screen.getByRole('button', { name: 'Submit' })).not.toBeDisabled()
  vi.mocked(testScript).mockResolvedValueOnce({ outputObject: {}, logLines: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
  await waitFor(() => expect(testScript).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})
