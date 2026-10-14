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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import { server } from '@/mocks/node'
import { preferencesFixture } from '@/mocks/fixtures/preferences'
import type { PreferenceSection } from '@/types/preferences'
import { queryKeys } from '@/lib/query-client'
import { toast } from 'sonner'
import { PreferenceSectionForm } from './PreferenceSectionForm'

const layout = vi.hoisted(() => ({ width: 500 }))
vi.mock('@/lib/hooks/use-container-width', () => ({
  useContainerWidth: () => [undefined, layout.width],
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
beforeEach(() => {
  layout.width = 500
})
const tokens = preferencesFixture.sections.find((section) => section.name === 'access-tokens')!
function renderForm(section: PreferenceSection = structuredClone(tokens)) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(queryKeys.preferencesIndex(), { sections: [section] })
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <PreferenceSectionForm section={section} />
      </QueryClientProvider>
    ),
  }
}

it.each([500, 1000])(
  'renders actions at their scope and filters row actions at width %s',
  async (width) => {
    layout.width = width
    const section = structuredClone(tokens)
    section.actions!.push({
      name: 'refresh',
      label: 'Refresh tokens',
      scope: 'LIST',
      listName: 'tokens',
      order: 1,
    })
    section.actions!.push({
      name: 'other',
      label: 'Other list action',
      scope: 'ROW',
      listName: 'elsewhere',
    })
    section.lists[0].rows = [
      { ...section.lists[0].rows[0], key: 'all', label: 'All', actionNames: null },
      { ...section.lists[0].rows[0], key: 'some', label: 'Some', actionNames: ['revoke'] },
      { ...section.lists[0].rows[0], key: 'none', label: 'None', actionNames: [] },
    ]
    const received = vi.fn()
    server.use(
      http.post('/qqq/v1/preferences/access-tokens/actions/refresh', async ({ request }) => {
        received(await request.json())
        return HttpResponse.json({ section, message: 'Refreshed' })
      })
    )
    renderForm(section)
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: 'Create token' }).closest('header')).not.toBeNull()
    const list = screen.getByRole('region', { name: 'Tokens' })
    await user.click(within(list).getByRole('button', { name: 'Refresh tokens' }))
    await waitFor(() => expect(received).toHaveBeenCalledWith({}))
    await user.click(screen.getByRole('button', { name: 'Actions for All' }))
    expect(screen.getByRole('menuitem', { name: 'Rotate token' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Revoke token' })).toHaveClass('text-destructive')
    expect(screen.queryByRole('menuitem', { name: 'Other list action' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Actions for Some' }))
    expect(screen.queryByRole('menuitem', { name: 'Rotate token' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Revoke token' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actions for None' })).not.toBeInTheDocument()
  }
)

it('keeps input validation in the dialog, shows secrets once, copies, gates dismissal and clears on Done', async () => {
  const received = vi.fn()
  let attempt = 0
  const saved = structuredClone(tokens)
  saved.lists[0].rows = []
  server.use(
    http.post('/qqq/v1/preferences/access-tokens/actions/create', async ({ request }) => {
      received(await request.json())
      if (attempt++ === 0)
        return HttpResponse.json(
          { errors: ['Description: choose a different name', 'Expires at: must be in the future'] },
          { status: 400 }
        )
      return HttpResponse.json({
        section: saved,
        message: 'Created successfully',
        secrets: [
          {
            label: 'Access token',
            value: 'test-only-secret',
            masked: 'test-…cret',
            usageText: 'curl example.test\n# test-only-secret',
          },
        ],
      })
    })
  )
  const { client } = renderForm()
  const user = userEvent.setup()
  const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
  const trigger = screen.getByRole('button', { name: 'Create token' })
  await user.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Create token' })
  expect(dialog.contains(document.activeElement)).toBe(true)
  await user.type(within(dialog).getByLabelText('Description', { exact: false }), 'Script')
  fireEvent.change(within(dialog).getByLabelText('Expires at', { exact: false }), {
    target: { value: '2027-01-01T12:00' },
  })
  await user.click(within(dialog).getByRole('button', { name: 'Create token' }))
  const error = await within(dialog).findByRole('alert')
  expect(error).toHaveTextContent('Description: choose a different name')
  expect(error).toHaveTextContent('Expires at: must be in the future')
  expect(error).toHaveFocus()
  expect(within(dialog).getByLabelText('Description', { exact: false })).toHaveValue('Script')
  expect(received).toHaveBeenCalledWith({
    values: { description: 'Script', expiresAt: expect.stringMatching(/Z$/) },
  })
  expect(await axe(dialog)).toHaveNoViolations()
  await user.click(within(dialog).getByRole('button', { name: 'Create token' }))
  const secret = await screen.findByRole('dialog', { name: 'Show once' })
  expect(secret.contains(document.activeElement)).toBe(true)
  expect(secret).toHaveTextContent("Copy it now. You won't be able to see it again.")
  expect(within(secret).getByRole('textbox', { name: 'Access token' })).toHaveAttribute('readonly')
  expect(secret).toHaveTextContent('test-…cret')
  expect(within(secret).getByRole('button', { name: 'Done' })).toBeDisabled()
  await user.keyboard('{Escape}')
  fireEvent.pointerDown(document.querySelector('[data-qqq-id="preference-action-overlay"]')!, {
    pointerType: 'mouse',
    button: 0,
  })
  expect(screen.getByRole('dialog', { name: 'Show once' })).toBeInTheDocument()
  await user.click(within(secret).getByRole('button', { name: 'Copy Access token' }))
  expect(clipboard).toHaveBeenCalledWith('test-only-secret')
  await user.click(within(secret).getByRole('button', { name: 'Copy Access token usage' }))
  expect(clipboard).toHaveBeenCalledWith('curl example.test\n# test-only-secret')
  expect(await axe(secret)).toHaveNoViolations()
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data)
    )
  ).not.toContain('test-only-secret')
  expect(client.getMutationCache().getAll()).toHaveLength(0)
  await user.click(within(secret).getByRole('checkbox', { name: "I've copied it" }))
  await user.click(within(secret).getByRole('button', { name: 'Done' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue('test-only-secret')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(screen.getByText('No items available.')).toBeInTheDocument()
  expect(client.getQueryData(queryKeys.preferenceSection(tokens.name))).toEqual(saved)
  expect(toast.success).toHaveBeenCalledWith('Created successfully')
  await user.click(trigger)
  expect(screen.queryByRole('dialog', { name: 'Show once' })).not.toBeInTheDocument()
})

it('confirms destructive row actions before POST and returns focus to the row menu', async () => {
  const received = vi.fn()
  server.use(
    http.post('/qqq/v1/preferences/access-tokens/actions/revoke', async ({ request }) => {
      received(await request.json())
      return HttpResponse.json({ section: tokens, message: 'Revoked', secrets: [] })
    })
  )
  renderForm()
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Actions for Development script' })
  await user.click(trigger)
  await user.click(screen.getByRole('menuitem', { name: 'Revoke token' }))
  const dialog = screen.getByRole('dialog', { name: 'Revoke token' })
  expect(dialog.contains(document.activeElement)).toBe(true)
  expect(dialog).toHaveTextContent('Revoke this token? It will stop working immediately.')
  expect(received).not.toHaveBeenCalled()
  const confirm = within(dialog).getByRole('button', { name: 'Revoke token' })
  expect(confirm).toHaveClass('bg-destructive')
  await user.click(confirm)
  await waitFor(() =>
    expect(received).toHaveBeenCalledWith({ rowKey: 'example-token', values: {} })
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(trigger).toHaveFocus()
})

it('selects the secret and usage text when clipboard access fails', async () => {
  renderForm()
  const user = userEvent.setup()
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
  await user.click(screen.getByRole('button', { name: 'Actions for Development script' }))
  await user.click(screen.getByRole('menuitem', { name: 'Rotate token' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rotate token' }))
  const secret = await screen.findByRole('dialog', { name: 'Show once' })
  await user.click(within(secret).getByRole('button', { name: 'Copy Access token' }))
  const input = within(secret).getByRole('textbox', { name: 'Access token' }) as HTMLInputElement
  expect(input).toHaveFocus()
  expect(input.selectionEnd! - input.selectionStart!).toBe(input.value.length)
  await user.click(within(secret).getByRole('button', { name: 'Copy Access token usage' }))
  expect(window.getSelection()?.toString()).toContain('curl')
})

it('disables every scope while dirty and locks editors while an action is running', async () => {
  const section = structuredClone(tokens)
  section.fields = [preferencesFixture.sections[1].fields[0]]
  section.values = { timeZone: 'UTC' }
  section.actions!.push({
    name: 'refresh',
    label: 'Refresh tokens',
    scope: 'LIST',
    listName: 'tokens',
  })
  let finish!: () => void
  server.use(
    http.post('/qqq/v1/preferences/access-tokens/actions/refresh', async () => {
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      return HttpResponse.json({ section })
    })
  )
  renderForm(section)
  const user = userEvent.setup()
  fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Europe/London' } })
  for (const name of ['Create token', 'Refresh tokens', 'Actions for Development script'])
    expect(screen.getByRole('button', { name })).toBeDisabled()
  expect(screen.getByText('Save or discard your changes first')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Discard' }))
  await user.click(screen.getByRole('button', { name: 'Refresh tokens' }))
  await waitFor(() => expect(finish).toBeDefined())
  expect(screen.getByLabelText('Time zone')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Create token' })).toBeDisabled()
  finish()
  await waitFor(() => expect(screen.getByLabelText('Time zone')).toBeEnabled())
})

it('supports keyboard row menus, cancellation, and focus return without invoking the action', async () => {
  const received = vi.fn()
  server.use(
    http.post('/qqq/v1/preferences/access-tokens/actions/revoke', () => {
      received()
      return HttpResponse.json({ section: tokens })
    })
  )
  renderForm()
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Actions for Development script' })
  trigger.focus()
  await user.keyboard('{Enter}')
  const revoke = await screen.findByRole('menuitem', { name: 'Revoke token' })
  revoke.focus()
  await user.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', { name: 'Revoke token' })
  expect(dialog.contains(document.activeElement)).toBe(true)
  await user.tab()
  expect(dialog.contains(document.activeElement)).toBe(true)
  await user.tab()
  expect(dialog.contains(document.activeElement)).toBe(true)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(received).not.toHaveBeenCalled()
})

it('uses inline enum metadata, typed defaults, and action order without hardcoded token inputs', async () => {
  const section = structuredClone(tokens)
  section.possibleValues = {
    modes: [
      { id: 'daily', label: 'Daily' },
      { id: 'weekly', label: 'Weekly' },
    ],
  }
  section.actions = [
    { name: 'later', label: 'Later', scope: 'SECTION', order: 20 },
    {
      name: 'configure',
      label: 'Configure',
      scope: 'SECTION',
      order: 1,
      inputFields: [
        {
          ...preferencesFixture.sections[1].fields[0],
          name: 'mode',
          label: 'Mode',
          possibleValueSourceName: 'modes',
          defaultValue: 'daily',
        },
        {
          ...preferencesFixture.sections[1].fields[0],
          name: 'count',
          label: 'Count',
          type: 'INTEGER',
          defaultValue: 3,
        },
      ],
    },
  ]
  const received = vi.fn()
  server.use(
    http.post('/qqq/v1/preferences/access-tokens/actions/configure', async ({ request }) => {
      received(await request.json())
      return HttpResponse.json({ section })
    })
  )
  renderForm(section)
  const header = screen.getByRole('button', { name: 'Configure' }).closest('header')!
  expect(
    within(header)
      .getAllByRole('button')
      .map((button) => button.textContent)
  ).toEqual(['Configure', 'Later'])
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Configure' }))
  const dialog = screen.getByRole('dialog', { name: 'Configure' })
  expect(within(dialog).getByRole('combobox', { name: 'Mode' })).toHaveValue('daily')
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Mode' }), 'weekly')
  await user.click(within(dialog).getByRole('button', { name: 'Configure' }))
  await waitFor(() =>
    expect(received).toHaveBeenCalledWith({ values: { mode: 'weekly', count: 3 } })
  )
})

it('shows each returned secret and restores focus to the returned row after acknowledgement', async () => {
  server.use(
    http.post('/qqq/v1/preferences/access-tokens/actions/rotate', () =>
      HttpResponse.json({
        section: tokens,
        focusRowKey: 'example-token',
        secrets: [
          { label: 'Primary token', value: 'primary-test-only', masked: 'primary-…only' },
          {
            label: 'Recovery token',
            value: 'recovery-test-only',
            masked: 'recovery-…only',
            usageText: 'Example recovery usage',
          },
        ],
      })
    )
  )
  const { container } = renderForm()
  const user = userEvent.setup()
  const persist = vi.spyOn(window.localStorage, 'setItem')
  await user.click(screen.getByRole('button', { name: 'Actions for Development script' }))
  await user.click(screen.getByRole('menuitem', { name: 'Rotate token' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rotate token' }))
  const dialog = await screen.findByRole('dialog', { name: 'Show once' })
  expect(within(dialog).getByRole('textbox', { name: 'Primary token' })).toHaveValue('primary-test-only')
  expect(within(dialog).getByRole('textbox', { name: 'Recovery token' })).toHaveValue('recovery-test-only')
  expect(
    within(dialog).getByRole('button', { name: 'Copy Recovery token usage' })
  ).toBeInTheDocument()
  expect(persist).not.toHaveBeenCalled()
  await user.click(within(dialog).getByRole('checkbox', { name: "I've copied it" }))
  await user.click(within(dialog).getByRole('button', { name: 'Done' }))
  expect(container.querySelector('[data-preference-row-key="example-token"]')).toHaveFocus()
  expect(screen.queryByDisplayValue('primary-test-only')).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue('recovery-test-only')).not.toBeInTheDocument()
  persist.mockRestore()
})
