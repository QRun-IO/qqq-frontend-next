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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import apiClient from '@/lib/api/client'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { EntityForm } from './EntityForm'
vi.mock('@/components/collaboration/LazyRecordCollaboration', () => ({
  LazyCollaborationEdit: () => null,
}))
it('keeps edited values and loaded expectedVersion across a realtime record refetch', async () => {
  const table = { ...qInstance.tables.company, recordVersionField: 'modifyDate' }
  const record = { tableName: 'company', values: { id: 1, name: 'Original', modifyDate: 'v1' } }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const save = vi
    .spyOn(apiClient, 'patch')
    .mockResolvedValue({ record: { ...record, values: { ...record.values, name: 'My value' } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const view = render(<EntityForm tableMetaData={table} record={record} onSuccess={vi.fn()} />, {
    wrapper,
  })
  fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'My value' } })
  view.rerender(
    <EntityForm
      tableMetaData={table}
      record={{ ...record, values: { ...record.values, name: 'Someone else', modifyDate: 'v2' } }}
      onSuccess={vi.fn()}
    />
  )
  expect(screen.getByLabelText(/Name/)).toHaveValue('My value')
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(save).toHaveBeenCalled())
  expect(save.mock.calls[0][2]?.params).toEqual({ expectedVersion: 'v1' })
  expect((save.mock.calls[0][1] as FormData).get('name')).toBe('My value')
  expect((save.mock.calls[0][1] as FormData).has('modifyDate')).toBe(false)
  save.mockRestore()
})
