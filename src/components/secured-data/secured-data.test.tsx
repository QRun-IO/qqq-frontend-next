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
import { afterEach, describe, expect, it, vi } from 'vitest'
import apiClient from '@/lib/api/client'
import { getRevealOptions } from '@/lib/api/secured-data'
import { MaskedValue } from './MaskedValue'
import RevealDialog from './RevealDialog'
import { BreakGlassNotice } from './BreakGlassBanner'
import { SecuredDataProvider } from './SecuredDataProvider'
import { RestrictedValue } from './RestrictedValue'
import type { QFieldMetaData, QTableMetaData } from '@/types'

vi.mock('next/navigation', () => ({ usePathname: () => '/app/person/1' }))
const target = { tableName: 'person', primaryKey: 1, fieldName: 'email' }
const policy = {
  reasons: ['Customer support'],
  allowFreeText: true,
  requireFreeText: true,
  durationMinutes: 5,
  remainingToday: 3,
}
const field: QFieldMetaData = {
  name: 'email',
  label: 'Email',
  type: 'STRING',
  accessTier: 'REVEALABLE',
  isEditable: false,
  isHidden: false,
  isHeavy: false,
  isRequired: false,
  adornments: [],
}
const table = { name: 'person', primaryKeyField: 'id' } as QTableMetaData
const record = { tableName: 'person', values: { id: 1, email: 'j***@x.com' } }
function wrap(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>)
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('secured data UI', () => {
  it.each(['MASKED', 'REVEALABLE'] as const)(
    'renders the %s chip and unparsed server text accessibly',
    (tier) => {
      render(<MaskedValue value="***1234" tier={tier} />)
      expect(screen.getByLabelText('Masked value: ***1234')).toBeVisible()
      expect(screen.getByText(tier === 'MASKED' ? 'Masked' : 'Restricted')).toBeVisible()
    }
  )
  it('normalizes the published qbit option names', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      reasonOptions: ['Support'],
      allowFreeTextReason: true,
      requireFreeText: false,
      revealMinutes: 2,
      remainingDailyAllowance: 0,
    })
    expect(await getRevealOptions('person', 'email')).toEqual({
      reasons: ['Support'],
      allowFreeText: true,
      requireFreeText: false,
      durationMinutes: 2,
      remainingToday: 0,
    })
  })
  it('loads options, validates required reasons, submits and reports inline refusal', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(policy)
    const post = vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Daily cap reached'))
    wrap(<RevealDialog target={target} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(
      await screen.findByText('Visible for 5 minutes. 3 reveals remaining today.')
    ).toBeVisible()
    const submit = screen.getByRole('button', { name: 'Reveal value' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Customer support' } })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Additional reason (required)'), {
      target: { value: 'Confirm caller identity' },
    })
    fireEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent('Daily cap reached')
    expect(post).toHaveBeenCalledWith('/qbit/secured-data/reveal', {
      ...target,
      reason: 'Customer support',
      reasonText: 'Confirm caller identity',
    })
  })
  it('permits a free text only reason and returns the successful grant', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ ...policy, reasons: [] })
    const result = {
      value: 'jane@x.com',
      displayValue: 'jane@x.com',
      revealId: 1,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    }
    vi.spyOn(apiClient, 'post').mockResolvedValue(result)
    const success = vi.fn()
    wrap(<RevealDialog target={target} onClose={vi.fn()} onSuccess={success} />)
    fireEvent.change(await screen.findByLabelText('Additional reason (required)'), {
      target: { value: 'Emergency investigation' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reveal value' }))
    await waitFor(() => expect(success).toHaveBeenCalledWith(result))
  })
  it('shows the emergency reason, counts down, links End to the record, then expires', () => {
    vi.useFakeTimers()
    render(
      <BreakGlassNotice
        session={{
          id: 7,
          reason: 'Emergency care',
          ceiling: 'PHI',
          expiresAt: new Date(Date.now() + 2000).toISOString(),
        }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Break-glass access active — Emergency care'
    )
    expect(screen.getByRole('timer')).toHaveTextContent('00:02')
    expect(screen.getByRole('link', { name: 'End' })).toHaveAttribute(
      'href',
      '/app/secured_data_break_glass/7'
    )
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByRole('timer')).toHaveTextContent('00:01')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('makes no extension requests and offers no reveal when the extension is absent', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ apiVersion: '1.2.0', features: [], extensions: [] })
    wrap(
      <SecuredDataProvider enabled>
        <RestrictedValue field={field} record={record} table={table} reveal />
      </SecuredDataProvider>
    )
    await waitFor(() => expect(get).toHaveBeenCalledWith('/version'))
    expect(get.mock.calls).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Reveal' })).toBeNull()
    expect(screen.getByText('Restricted')).toBeVisible()
  })
  it('shows a successful reveal with countdown and removes the value at expiry', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (path) =>
      path === '/version'
        ? { apiVersion: '1.2.0', features: [], extensions: [{ name: 'secured-data' }] }
        : path === '/qbit/secured-data/status'
          ? { breakGlass: null }
          : { ...policy, requireFreeText: false }
    )
    vi.spyOn(apiClient, 'post').mockImplementation(async () => ({
      value: 'jane@example.test',
      displayValue: null,
      revealId: 2,
      expiresAt: new Date(Date.now() + 2000).toISOString(),
    }))
    wrap(
      <SecuredDataProvider enabled>
        <RestrictedValue field={field} record={record} table={table} reveal />
      </SecuredDataProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Reveal' }))
    fireEvent.change(await screen.findByLabelText('Reason'), {
      target: { value: 'Customer support' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reveal value' }))
    expect(await screen.findByText('jane@example.test')).toBeVisible()
    expect(screen.getByRole('timer')).toHaveTextContent(/00:0[12]/)
    await waitFor(() => expect(screen.queryByText('jane@example.test')).toBeNull(), {
      timeout: 4000,
    })
    expect(screen.getByText('j***@x.com')).toBeVisible()
  })
  it('hides disallowed free text and disables a depleted allowance', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      ...policy,
      allowFreeText: false,
      requireFreeText: false,
      remainingToday: 0,
    })
    wrap(<RevealDialog target={target} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('daily reveal allowance')
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Customer support' } })
    expect(screen.getByRole('button', { name: 'Reveal value' })).toBeDisabled()
  })
})
