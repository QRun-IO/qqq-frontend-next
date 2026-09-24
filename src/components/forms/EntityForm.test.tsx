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

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QRecord } from '@/types'
import apiClient from '@/lib/api/client'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { EntityForm } from './EntityForm'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))

function renderForm(fixedValues: Record<string, string | number | boolean>) {
  const table = structuredClone(qInstance.tables.company)
  table.fields = { name: table.fields.name, owner: { ...table.fields.id, name: 'owner', label: 'Owner', isEditable: true } }
  table.sections = [{ name: 'identity', label: 'Identity', isHidden: false, fieldNames: ['name', 'owner'] }]
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><EntityForm tableMetaData={table} fixedValues={fixedValues} /></QueryClientProvider>)
  fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Child' } })
  return { table }
}

describe('Explicit fixed relationship submission', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('validates fixed values and merges them last without mutating caller data', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'company', values: { id: 7 } }] })
    const fixed = { owner: 2 }
    renderForm(fixed)
    fireEvent.change(screen.getByLabelText(/Owner/), { target: { value: '99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect((post.mock.calls[0][1] as FormData).get('owner')).toBe('2')
    expect(fixed).toEqual({ owner: 2 })
  })

  it.each<Record<string, string | number | boolean>>([{ missing: 1 }, { owner: 'not-an-integer' }])('rejects undeclared or mistyped fixed values before HTTP: %j', async (fixed) => {
    const post = vi.spyOn(apiClient, 'post')
    renderForm(fixed)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(post).not.toHaveBeenCalled()
  })
})

describe('Base copy starts a new record identity', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('clears inherited manual keys on initial load and source reset, then submits a fresh key', async () => {
    const table = structuredClone(qInstance.tables.company)
    table.primaryKeyField = 'code'
    table.fields = { name: table.fields.name, code: { ...table.fields.name, name: 'code', label: 'Code', isRequired: true } }
    table.sections = [{ name: 'identity', label: 'Identity', isHidden: false, fieldNames: ['code', 'name'] }]
    const source: QRecord = { tableName: 'company', values: { code: 'old/key', name: 'Original' },
      associatedRecords: { 'arbitrary children': [{ tableName: 'person', values: { id: 3 } }] } }
    const nextSource: QRecord = { tableName: 'company', values: { code: 'other/key', name: 'Another' } }
    const sourceSnapshot = structuredClone(source)
    const nextSnapshot = structuredClone(nextSource)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'company', values: { code: 'new/key' } }] })
    const onSuccess = vi.fn()
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const view = (record: QRecord) => <QueryClientProvider client={client}>
      <EntityForm tableMetaData={table} record={record} isCopy onSuccess={onSuccess} />
    </QueryClientProvider>
    const { rerender } = render(view(source))
    expect(screen.getByLabelText(/Code/)).toHaveValue('')
    expect(screen.getByLabelText(/Name/)).toHaveValue('Original')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Code is required')).toBeVisible()
    expect(post).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/Code/), { target: { value: 'draft/key' } })
    rerender(view(nextSource))
    expect(screen.getByLabelText(/Code/)).toHaveValue('')
    expect(screen.getByLabelText(/Name/)).toHaveValue('Another')
    fireEvent.change(screen.getByLabelText(/Code/), { target: { value: 'new/key' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    const submitted = post.mock.calls[0][1] as FormData
    expect(submitted.get('code')).toBe('new/key')
    expect(submitted.get('name')).toBe('Another')
    expect(submitted.has('associations')).toBe(false)
    expect(source).toEqual(sourceSnapshot)
    expect(nextSource).toEqual(nextSnapshot)
  })

  it.each([undefined, '0'])('omits an untouched optional numeric key but preserves a supplied %s', async (newKey) => {
    const table = structuredClone(qInstance.tables.company)
    table.fields = { name: table.fields.name, id: { ...table.fields.id, isEditable: true, isRequired: false } }
    table.sections = [{ name: 'identity', label: 'Identity', isHidden: false, fieldNames: ['id', 'name'] }]
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'company', values: { id: 99 } }] })
    const onSuccess = vi.fn()
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><EntityForm tableMetaData={table}
      record={{ tableName: 'company', values: { id: 42, name: 'Original' } }} isCopy onSuccess={onSuccess} />
    </QueryClientProvider>)
    expect(screen.getByLabelText(/ID/)).toHaveValue(null)
    if (newKey !== undefined) fireEvent.change(screen.getByLabelText(/ID/), { target: { value: newKey } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    const submitted = post.mock.calls[0][1] as FormData
    expect(submitted.get('id')).toBe(newKey ?? null)
  })

  it.each([{ encoded: 'AQCA/w==', expected: [1, 0, 128, 255] }, { encoded: '', expected: [] }])('copies native BLOB $encoded bytes as a file with the declared source filename', async ({ encoded, expected }) => {
    const table = structuredClone(qInstance.tables.company)
    table.fields = { name: table.fields.name, attachment: { ...table.fields.name, name: 'attachment', label: 'Attachment',
      type: 'BLOB', isRequired: false, adornments: [{ type: 'FILE_DOWNLOAD', values: { fileNameField: 'fileName', defaultMimeType: 'application/octet-stream' } }] } }
    table.sections = [{ name: 'identity', label: 'Identity', isHidden: false, fieldNames: ['name', 'attachment'] }]
    const source: QRecord = { tableName: 'company', values: { id: 1, name: 'Original', attachment: encoded, fileName: 'original.bin' } }
    const snapshot = structuredClone(source)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'company', values: { id: 99 } }] })
    const onSuccess = vi.fn()
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><EntityForm tableMetaData={table} record={source} isCopy onSuccess={onSuccess} /></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    const file = (post.mock.calls[0][1] as FormData).get('attachment')
    expect(file).toBeInstanceOf(File)
    if (!(file instanceof File)) throw new Error('Expected binary multipart file')
    expect(file.name).toBe('original.bin')
    expect(file.type).toBe('application/octet-stream')
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('Expected binary bytes'))
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    })
    expect(Array.from(new Uint8Array(bytes))).toEqual(expected)
    expect(screen.getByText('original.bin')).toBeVisible()
    expect(source).toEqual(snapshot)
  })

  it('blocks malformed copied binary values before HTTP with an explicit source error', async () => {
    const table = structuredClone(qInstance.tables.company)
    table.fields = { name: table.fields.name, attachment: { ...table.fields.name, name: 'attachment', label: 'Attachment', type: 'BLOB' } }
    table.sections = [{ name: 'identity', label: 'Identity', isHidden: false, fieldNames: ['name', 'attachment'] }]
    const post = vi.spyOn(apiClient, 'post')
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><EntityForm tableMetaData={table}
      record={{ tableName: 'company', values: { id: 1, name: 'Original', attachment: 'not base64!' } }} isCopy />
    </QueryClientProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot copy Attachment: the source file data is invalid.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!)
    expect(post).not.toHaveBeenCalled()
  })

  it('preserves explicit nullable source values without replacing false, zero or omitted defaults', async () => {
    const table = structuredClone(qInstance.tables.company)
    const optional = { ...table.fields.name, isRequired: false }
    table.fields = {
      name: table.fields.name,
      unknownFlag: { ...optional, name: 'unknownFlag', label: 'Unknown flag', type: 'BOOLEAN' },
      flag: { ...optional, name: 'flag', label: 'Known false', type: 'BOOLEAN', defaultValue: true },
      note: { ...optional, name: 'note', label: 'Null note', defaultValue: 'Default note' },
      missing: { ...optional, name: 'missing', label: 'Omitted note', defaultValue: 'Omitted default' },
      amount: { ...optional, name: 'amount', label: 'Null amount', type: 'DECIMAL', defaultValue: 7 },
      quantity: { ...optional, name: 'quantity', label: 'Known zero', type: 'INTEGER', defaultValue: 8 },
    }
    table.sections = [{ name: 'identity', label: 'Identity', isHidden: false, fieldNames: Object.keys(table.fields) }]
    const source: QRecord = { tableName: 'company', values: { id: 1, name: 'Original', unknownFlag: null, flag: false, note: null, amount: null, quantity: 0 } }
    const snapshot = structuredClone(source)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'company', values: { id: 99 } }] })
    const onSuccess = vi.fn()
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><EntityForm tableMetaData={table} record={source} isCopy onSuccess={onSuccess} /></QueryClientProvider>)
    expect(screen.getByRole('checkbox', { name: 'Unknown flag' })).toHaveAttribute('aria-checked', 'mixed')
    expect(screen.getByRole('checkbox', { name: 'Known false' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByLabelText('Null note')).toHaveValue('')
    expect(screen.getByLabelText('Null amount')).toHaveValue(null)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    const submitted = post.mock.calls[0][1] as FormData
    expect(submitted.get('unknownFlag')).toBe('')
    expect(submitted.get('note')).toBe('')
    expect(submitted.get('amount')).toBe('')
    expect(submitted.get('flag')).toBe('false')
    expect(submitted.get('quantity')).toBe('0')
    expect(submitted.get('missing')).toBe('Omitted default')
    expect(source).toEqual(snapshot)
  })
})


describe('Copy never submits native password masks', () => {
  beforeEach(() => vi.restoreAllMocks())
  it('requires an explicit new password while ordinary strings and revealed passwords copy normally', async () => {
    const table = structuredClone(qInstance.tables.company)
    table.fields = { id: table.fields.id, name: table.fields.name,
      secret: { ...table.fields.name, name: 'secret', label: 'New secret', type: 'PASSWORD', isRequired: false },
      revealed: { ...table.fields.name, name: 'revealed', label: 'Revealed secret', type: 'PASSWORD', adornments: [{ type: 'REVEAL' }] },
    }
    table.sections = []
    const source = { tableName: 'company', values: { id: 1, name: '********', secret: '********', revealed: 'available' } }
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'company', values: { id: 2 } }] })
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><EntityForm tableMetaData={table} record={source} isCopy /></QueryClientProvider>)
    expect(screen.getByLabelText(/New secret/)).toHaveValue('')
    expect(screen.getByLabelText(/Revealed secret/)).toHaveValue('available')
    expect(screen.getByLabelText(/^Name/)).toHaveValue('********')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a new value for New secret')
    expect(post).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/New secret/), { target: { value: 'new-explicit-value' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect((post.mock.calls[0][1] as FormData).get('secret')).toBe('new-explicit-value')
    expect(source.values.secret).toBe('********')
  })
})
