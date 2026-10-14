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

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import { server } from '@/mocks/node'
import { preferencesFixture } from '@/mocks/fixtures/preferences'
import type { PreferenceSection } from '@/types/preferences'
import type { QFieldMetaData } from '@/types/metadata'
import { PreferenceSectionForm } from './PreferenceSectionForm'
import { queryKeys } from '@/lib/query-client'

const layout = vi.hoisted(() => ({ width: 500 }))
vi.mock('@/lib/hooks/use-container-width', () => ({
  useContainerWidth: () => [undefined, layout.width],
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

beforeEach(() => {
  layout.width = 500
})
const notifications = preferencesFixture.sections[0]
const renderForm = (section = notifications) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <PreferenceSectionForm section={section} />
      </QueryClientProvider>
    ),
  }
}

it('renders all primitive editors, help, required markers, and inline enum options', async () => {
  const types: QFieldMetaData['type'][] = [
    'BOOLEAN',
    'INTEGER',
    'DECIMAL',
    'STRING',
    'TEXT',
    'DATE',
    'TIME',
    'DATE_TIME',
  ]
  const section: PreferenceSection = {
    ...notifications,
    lists: [],
    values: {},
    fields: types.map((type) => ({
      ...notifications.fields[0],
      name: type,
      label: type,
      type,
      isRequired: true,
      helpContents: [{ content: 'Example help', format: 'TEXT' }],
    })),
  }
  renderForm(section)
  expect(screen.getByRole('checkbox', { name: 'BOOLEAN' })).toHaveAttribute('aria-required', 'true')
  for (const [name, type] of [
    ['INTEGER', 'number'],
    ['DECIMAL', 'number'],
    ['STRING', 'text'],
    ['DATE', 'date'],
    ['TIME', 'time'],
    ['DATE_TIME', 'datetime-local'],
  ]) {
    expect(screen.getByLabelText(new RegExp(`^${name}\\*?$`))).toHaveAttribute('type', type)
  }
  expect(screen.getByLabelText(/^TEXT\*?$/).tagName).toBe('TEXTAREA')
  expect(screen.getAllByText('Example help')).toHaveLength(8)
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

it('uses a table at md container width and cards below it, retaining edits across resize', async () => {
  layout.width = 900
  const view = renderForm()
  expect(screen.getByRole('table', { name: 'Categories' })).toBeInTheDocument()
  const system = screen.getByRole('row', { name: /System/ })
  await userEvent.setup().click(within(system).getByRole('checkbox', { name: 'In-app' }))
  layout.width = 500
  view.rerender(
    <QueryClientProvider client={view.client}>
      <PreferenceSectionForm section={notifications} />
    </QueryClientProvider>
  )
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(
    within(screen.getByRole('group', { name: 'System' })).getByRole('checkbox', { name: 'In-app' })
  ).toHaveAttribute('aria-checked', 'false')
})

it('locks provider read-only cells and exposes their reason to assistive technology', async () => {
  const { container } = renderForm()
  const security = screen.getByRole('group', { name: 'Security' })
  const checkbox = within(security).getByRole('checkbox', { name: 'In-app' })
  expect(checkbox).toBeDisabled()
  expect(checkbox).toHaveAccessibleDescription("Security notices can't be muted")
  expect(await axe(container)).toHaveNoViolations()
})

it('sends only changed scalar and row fields, with typed numeric enum IDs, then refreshes queries', async () => {
  const bodies: unknown[] = []
  server.use(
    http.patch('/qqq/v1/preferences/notifications', async ({ request }) => {
      bodies.push(await request.json())
      const saved = structuredClone(notifications)
      saved.values.digestHour = 12
      saved.lists[0].rows[0].values.emailMode = 'DAILY_DIGEST'
      return HttpResponse.json(saved)
    })
  )
  const { client } = renderForm()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const user = userEvent.setup()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Daily digest hour' }), '12')
  const system = within(screen.getByRole('group', { name: 'System' }))
  expect(system.getByRole('option', { name: 'Daily digest' })).toHaveValue('DAILY_DIGEST')
  await user.selectOptions(system.getByRole('combobox', { name: 'Email delivery' }), 'DAILY_DIGEST')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() =>
    expect(bodies).toEqual([
      {
        values: { digestHour: 12 },
        lists: { categories: [{ key: 'SYSTEM', values: { emailMode: 'DAILY_DIGEST' } }] },
      },
    ])
  )
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled())
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.preferences() })
  expect(screen.getByLabelText('Daily digest hour')).toHaveValue('12')
})

it('keeps edits on a 400, shows all server messages, and discards back to saved values', async () => {
  server.use(
    http.patch('/qqq/v1/preferences/notifications', () =>
      HttpResponse.json(
        { errors: ['Time zone is invalid', 'Digest hour is outside the allowed range'] },
        { status: 400 }
      )
    )
  )
  renderForm()
  const user = userEvent.setup()
  await user.clear(screen.getByLabelText('Time zone'))
  await user.type(screen.getByLabelText('Time zone'), 'invalid')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  const summary = await screen.findByRole('alert')
  expect(summary).toHaveTextContent('Time zone is invalid')
  expect(summary).toHaveTextContent('Digest hour is outside the allowed range')
  expect(screen.getByLabelText('Time zone')).toHaveValue('invalid')
  await user.click(screen.getByRole('button', { name: 'Discard' }))
  expect(screen.getByLabelText('Time zone')).toHaveValue('America/Chicago')
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('preserves dirty edits during background refetches', async () => {
  const view = renderForm()
  fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Europe/London' } })
  const incoming = structuredClone(notifications)
  incoming.values.timeZone = 'UTC'
  await act(async () =>
    view.rerender(
      <QueryClientProvider client={view.client}>
        <PreferenceSectionForm section={incoming} />
      </QueryClientProvider>
    )
  )
  expect(screen.getByLabelText('Time zone')).toHaveValue('Europe/London')
})

it('submits primitive editor changes as typed values using only metadata names', async () => {
  const types: QFieldMetaData['type'][] = [
    'INTEGER',
    'DECIMAL',
    'STRING',
    'TEXT',
    'DATE',
    'TIME',
    'DATE_TIME',
  ]
  const section: PreferenceSection = {
    ...notifications,
    name: 'custom',
    lists: [],
    values: {},
    fields: types.map((type, i) => ({
      ...notifications.fields[0],
      name: `setting${i}`,
      label: type,
      type,
    })),
  }
  let body: unknown
  server.use(
    http.patch('/qqq/v1/preferences/custom', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(section)
    })
  )
  renderForm(section)
  for (const [label, value] of [
    ['INTEGER', '7'],
    ['DECIMAL', '1.25'],
    ['STRING', 'Example'],
    ['TEXT', 'Longer text'],
    ['DATE', '2026-10-15'],
    ['TIME', '09:30'],
    ['DATE_TIME', '2026-10-15T10:00'],
  ])
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() =>
    expect(body).toEqual({
      values: {
        setting0: 7,
        setting1: 1.25,
        setting2: 'Example',
        setting3: 'Longer text',
        setting4: '2026-10-15',
        setting5: '09:30:00',
        setting6: expect.stringMatching(/Z$/),
      },
    })
  )
})

it('displays the backend BasicErrorResponseV1 error string without losing edits', async () => {
  server.use(
    http.patch('/qqq/v1/preferences/notifications', () =>
      HttpResponse.json(
        {
          error: 'Invalid time zone. Digest hour must be between 0 and 23.',
        },
        { status: 400 }
      )
    )
  )
  renderForm()
  fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'invalid' } })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid time zone. Digest hour must be between 0 and 23.'
  )
  expect(screen.getByLabelText('Time zone')).toHaveValue('invalid')
})
