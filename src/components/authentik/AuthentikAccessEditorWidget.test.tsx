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

/** @file Access editor behavior: stable selections, grant sources and API failures. */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import type { QWidgetMetaData } from '@/types'
import { fetchWidgetData } from '@/lib/api/widgets'
import { fetchPossibleValues } from '@/lib/api/possible-values'
import AuthentikAccessEditorWidget from './AuthentikAccessEditorWidget'

vi.mock('@/lib/api/widgets', () => ({ fetchWidgetData: vi.fn() }))
vi.mock('@/lib/api/possible-values', () => ({ fetchPossibleValues: vi.fn() }))
const widget = { name: 'access', type: 'AUTHENTIK_ACCESS_EDITOR' } as QWidgetMetaData

/**
 * Render with an isolated query cache.
 * @param fields - Editor fields.
 * @returns Process value callback.
 */
function setup(fields: Record<string, unknown>[]) {
  const changed = vi.fn()
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthentikAccessEditorWidget widgetMetaData={widget} data={{ fields }} onWidgetData={changed} />
  </QueryClientProvider>)
  return changed
}

describe('Access editor', () => {
  it('preserves unknown grants and displays inherited access without making it editable', async () => {
    const changed = setup([{ name: 'permissions', label: 'Direct permissions', selected: [{ id: 'legacy.read', label: 'legacy.read' }],
      choices: [{ id: 'posts.edit', label: 'Edit posts' }], inherited: { 'posts.read': ['Readers'] } }])
    expect(screen.getByLabelText('legacy.read')).toBeChecked()
    await userEvent.click(screen.getByLabelText('Edit posts'))
    expect(changed).toHaveBeenLastCalledWith({ permissions: 'legacy.read\nposts.edit' })
    expect(screen.queryByRole('checkbox', { name: /posts.read/ })).not.toBeInTheDocument()
    expect(screen.getByText('posts.read — Readers')).toBeInTheDocument()
  })

  it('searches the server and preserves selected IDs when results change', async () => {
    vi.mocked(fetchPossibleValues).mockImplementation(async (_source, request) => request?.searchTerm === 'alex'
      ? [{ id: 42, label: 'Alex' }] : [{ id: 3, label: 'Sam' }])
    const changed = setup([{ name: 'userIds', label: 'Users', source: 'identityUsers', selected: [] }])
    await userEvent.click(await screen.findByLabelText('Sam'))
    await userEvent.type(screen.getByLabelText('Search users'), 'alex')
    await userEvent.click(await screen.findByLabelText('Alex'))
    expect(screen.getByLabelText('Sam')).toBeChecked()
    expect(changed).toHaveBeenLastCalledWith({ userIds: '3\n42' })
    expect(fetchPossibleValues).toHaveBeenLastCalledWith('identityUsers', { searchTerm: 'alex', useCase: 'form' })
  })

  it('keeps existing assignments when the directory search fails', async () => {
    vi.mocked(fetchPossibleValues).mockRejectedValue(new Error('Offline'))
    const changed = setup([{ name: 'parentIds', label: 'Roles', source: 'roles', selected: [{ id: 'role-1', label: 'Reader' }] }])
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load choices'))
    expect(screen.getByLabelText('Reader')).toBeChecked()
    expect(changed).toHaveBeenCalledWith({ parentIds: 'role-1' })
  })

  it('rejects malformed payloads without submitting an empty permission list', () => {
    const changed = setup([{ name: 'permissions', label: 'Permissions', selected: 'broken' }])
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable')
    expect(changed).toHaveBeenCalledWith({ __accessEditorReady: false })
    expect(changed).not.toHaveBeenCalledWith({ permissions: '' })
  })
})


describe('Paged permission matrix', () => {
  it('accepts the live QQQ payload that omits empty application names and IDs', async () => {
    vi.mocked(fetchWidgetData).mockResolvedValue({ type: 'AUTHENTIK_ACCESS_EDITOR', fields: [{
      total: 1, page: 0, pageSize: 25, apps: [{ label: 'Other' }],
      rows: [{ name: 'documents', label: 'Documents', kind: 'TABLE', permissions: [{ id: 'documents.read', label: 'read' }] }],
    }] })
    const changed = setup([{ name: 'permissions', label: 'Direct permissions', catalogWidget: 'grantEditor', selected: [] }])
    await userEvent.click(await screen.findByRole('checkbox', { name: 'documents.read' }))
    expect(changed).toHaveBeenLastCalledWith({ permissions: 'documents.read' })
    await userEvent.selectOptions(screen.getByLabelText('Application'), '')
    await waitFor(() => expect(fetchWidgetData).toHaveBeenLastCalledWith('grantEditor', expect.objectContaining({ app: '' })))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps unknown and off-page grants across bulk page edits and failed searches', async () => {
    vi.mocked(fetchWidgetData).mockImplementation(async (_widget, params) => {
      if (params?.search === 'offline') throw new Error('Offline')
      const page = Number(params?.page ?? 0)
      return { type: 'AUTHENTIK_ACCESS_EDITOR', fields: [{ total: 1000, page, pageSize: 25, apps: [{ id: 'sales', label: 'Sales' }],
        rows: Array.from({ length: 25 }, (_, i) => ({ name: 'table' + (page * 25 + i), label: 'Table ' + (page * 25 + i), kind: 'TABLE', app: 'sales', permissions: [{ id: 'table' + (page * 25 + i) + '.read', label: 'read' }] })) }] }
    })
    const changed = setup([{ name: 'permissions', label: 'Direct permissions', catalogWidget: 'grantEditor', selected: [{ id: 'legacy.read', label: 'legacy.read' }], inherited: { 'table999.read': ['Readers'] } }])
    await screen.findByLabelText('table0.read')
    expect(screen.getAllByRole('checkbox')).toHaveLength(25)
    await userEvent.click(screen.getByRole('button', { name: 'Select 25 permissions on this page' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByLabelText('table25.read')
    await userEvent.click(screen.getByLabelText('table25.read'))
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await screen.findByLabelText('table0.read')
    await userEvent.click(screen.getByRole('button', { name: 'Clear 25 permissions on this page' }))
    expect(changed).toHaveBeenLastCalledWith({ permissions: 'legacy.read\ntable25.read' })
    await userEvent.type(screen.getByLabelText('Search permissions or resources'), 'offline')
    await screen.findByRole('alert')
    expect(changed).toHaveBeenLastCalledWith({ permissions: 'legacy.read\ntable25.read' })
    await userEvent.clear(screen.getByLabelText('Search permissions or resources'))
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'inherited')
    expect(screen.getByText('table999.read — Readers')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
