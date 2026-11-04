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

import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { QFieldMetaData, QFrontendStepMetaData, QProcessMetaData } from '@/types'
import { processRecords } from '@/lib/api/processes'
import { ProcessStepScreen } from './ProcessStepScreen'

vi.mock('@/lib/api/processes', async (original) => ({ ...await original<typeof import('@/lib/api/processes')>(), processRecords: vi.fn() }))
const step: QFrontendStepMetaData = {
  name: 'order', label: 'Order files', components: [{ type: 'RECORD_LIST', values: { orderFieldName: 'orderedIds', identityFieldName: 'id' } }],
  recordListFields: [{ name: 'name', label: 'File', type: 'STRING', isRequired: false, isEditable: false, isHeavy: false, isHidden: false, adornments: [] } as QFieldMetaData],
}
const result: QFrontendStepMetaData = { name: 'done', label: 'Done', components: [] }
const process: QProcessMetaData = { name: 'order', label: 'Order', tableName: '', isHidden: false, iconName: '', hasPermission: true, stepFlow: 'LINEAR', minInputRecords: 1, frontendSteps: [step, result] }
/** Render the real process screen and collect submitted contributions.
 * @returns Submit spy.
 */
function mount() {
  const submit = vi.fn()
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ProcessStepScreen processName="order" processMetaData={process} processUUID="run" step={step} steps={process.frontendSteps} values={{}}
      backStep={null} isWorking={false} onSubmit={submit} onBack={vi.fn()} onCancel={vi.fn()} onReturn={vi.fn()} />
  </QueryClientProvider>)
  return submit
}
beforeEach(() => { vi.resetAllMocks() })
it('moves rows with keyboard controls and submits the complete identity order automatically', async () => {
  vi.mocked(processRecords).mockResolvedValue({ totalRecords: 2, records: [
    { tableName: 'items', values: { id: 11, name: 'Front photo' } }, { tableName: 'items', values: { id: 22, name: 'BOL scan' } },
  ] })
  const submit = mount()
  const user = userEvent.setup()
  const down = await screen.findByRole('button', { name: 'Move Front photo down' })
  expect(screen.getByRole('button', { name: 'Move Front photo up' })).toBeDisabled()
  down.focus()
  await user.keyboard('{Enter}')
  expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('BOL scan')
  expect(screen.getByRole('status')).toHaveTextContent('Moved to position 2 of 2')
  expect(screen.queryByRole('textbox')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  await waitFor(() => expect(submit).toHaveBeenCalledWith({ orderedIds: '22,11' }, undefined))
})
it('blocks submit when the complete identity set cannot be loaded', async () => {
  vi.mocked(processRecords).mockResolvedValue({ totalRecords: 2, records: [{ tableName: 'items', values: { id: 1, name: 'First' } }, { tableName: 'items', values: { id: 1, name: 'Duplicate' } }] })
  const submit = mount()
  await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
  expect(submit).not.toHaveBeenCalled()
})
it('loads all bounded pages before enabling ordering and never silently drops missing members', async () => {
  vi.mocked(processRecords).mockResolvedValueOnce({ totalRecords: 2, records: [{ tableName: 'items', values: { id: 1, name: 'First' } }] })
    .mockResolvedValueOnce({ totalRecords: 2, records: [] })
  const submit = mount()
  await screen.findByRole('alert')
  expect(processRecords).toHaveBeenCalledTimes(2)
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
  expect(submit).not.toHaveBeenCalled()
})
