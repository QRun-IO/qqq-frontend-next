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

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QFieldMetaData, QRecord } from '@/types'
import apiClient from '@/lib/api/client'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { EntityForm } from './EntityForm'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))

const base = qInstance.tables.company.fields.name

function field(name: string, label: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { ...base, name, label, isEditable: true, isRequired: false, ...extra }
}

function renderForm(fields: QFieldMetaData[], props: { record?: QRecord } = {}) {
  const table = structuredClone(qInstance.tables.company)
  table.fields = Object.fromEntries(fields.map((item) => [item.name, item]))
  table.sections = [{ name: 'main', label: 'Main', isHidden: false, fieldNames: fields.map((item) => item.name) }]
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><EntityForm tableMetaData={table} {...props} /></QueryClientProvider>)
}

describe('Quiet record form validation', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows a required error on blur or save, not while typing, then clears it as soon as the field is fixed', async () => {
    const user = userEvent.setup()
    renderForm([field('code', 'Code', { isRequired: true })])
    const input = screen.getByLabelText(/Code/)
    await user.type(input, 'ab')
    await user.clear(input)
    expect(screen.queryByText('Code is required')).toBeNull()
    await user.tab()
    expect(await screen.findByText('Code is required')).toBeVisible()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Code is required')
    await user.type(input, 'x')
    await waitFor(() => expect(screen.queryByText('Code is required')).toBeNull())
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('moves focus to the first invalid field on save and keeps every error live afterward', async () => {
    const user = userEvent.setup()
    renderForm([field('first', 'First', { isRequired: true }), field('second', 'Second', { isRequired: true })])
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('First is required')).toBeVisible()
    expect(screen.getByText('Second is required')).toBeVisible()
    await waitFor(() => expect(screen.getByLabelText(/First/)).toHaveFocus())
    await user.type(screen.getByLabelText(/Second/), 'y')
    await waitFor(() => expect(screen.queryByText('Second is required')).toBeNull())
    expect(screen.getByText('First is required')).toBeVisible()
  })

  it('caps typing and counts only near the limit when too-long values are refused (ERROR)', async () => {
    const user = userEvent.setup()
    renderForm([field('code', 'Code', { maxLength: 10, behaviors: ['ERROR'] })])
    const input = screen.getByLabelText(/Code/)
    expect(input).toHaveAttribute('maxlength', '10')
    await user.type(input, 'abcdefg')
    expect(screen.queryByText(/ \/ 10/)).toBeNull()
    await user.type(input, 'h')
    expect(screen.getByText('8 / 10')).toBeVisible()
    await user.type(input, 'ijklmn')
    expect(input).toHaveValue('abcdefghij')
    expect(screen.getByText('10 / 10')).toBeVisible()
  })

  it('lets a trimmed value run past the limit, noting that extra characters will be trimmed, without an error', async () => {
    const user = userEvent.setup()
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ record: { tableName: 'company', values: { id: 1 } } })
    renderForm([field('code', 'Code', { maxLength: 5, behaviors: ['TRUNCATE'] })])
    const input = screen.getByLabelText(/Code/)
    expect(input).not.toHaveAttribute('maxlength')
    await user.type(input, 'abcdefg')
    expect(screen.getByText('7 / 5')).toBeVisible()
    expect(screen.getByText('Extra characters will be trimmed when you save.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('states the current length when an existing value is over a refused limit', async () => {
    const user = userEvent.setup()
    const stored = { tableName: 'company', values: { id: 1, code: 'a-value-that-is-too-long' } }
    renderForm([field('id', 'Id', { type: 'INTEGER', isEditable: false }), field('code', 'Code', { maxLength: 10, behaviors: ['ERROR'] })], { record: stored })
    await user.type(screen.getByLabelText(/Code/), '!')
    await user.tab()
    expect(await screen.findByText(/Must be 10 characters or fewer \(currently \d+\)/)).toBeVisible()
  })

  it('keeps non-numeric characters out of a whole-number field and words a broken range as the backend does', async () => {
    const user = userEvent.setup()
    renderForm([field('qty', 'Quantity', { type: 'INTEGER', minValue: 1, maxValue: 5 })])
    const input = screen.getByLabelText(/Quantity/)
    await user.type(input, 'a1e.2')
    expect(input).toHaveValue(12)
    await user.tab()
    expect(await screen.findByText('The value for Quantity is too large (maximum allowed value is 5)')).toBeVisible()
  })

  it('shows a read-only field as its value, not a disabled input', () => {
    renderForm([field('id', 'Id', { type: 'INTEGER', isEditable: false }), field('code', 'Code')], { record: { tableName: 'company', values: { id: 7, code: 'x' } } })
    expect(screen.getByText('7')).toBeVisible()
    expect(screen.queryByLabelText(/^Id/)).toBeNull()
  })

  it('places the server\'s message beside the field it names, keeping the typed value and showing no general alert', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'post').mockResolvedValue({ record: { tableName: 'company', values: {}, errors: ['The value for Code is too long (max allowed length=5)'] } })
    renderForm([field('code', 'Code'), field('other', 'Other')])
    await user.type(screen.getByLabelText(/Code/), 'abcdefgh')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Must be 5 characters or fewer')).toBeVisible()
    expect(screen.getByLabelText(/Code/)).toHaveValue('abcdefgh')
    await waitFor(() => expect(screen.getByLabelText(/Code/)).toHaveFocus())
    expect(screen.queryByText(/Error:/)).toBeNull()
  })

  it('keeps a message that names no field as the form\'s general error', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'post').mockResolvedValue({ record: { tableName: 'company', values: {}, errors: ['Something else went wrong'] } })
    renderForm([field('code', 'Code')])
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Something else went wrong')).toBeVisible()
  })
})
