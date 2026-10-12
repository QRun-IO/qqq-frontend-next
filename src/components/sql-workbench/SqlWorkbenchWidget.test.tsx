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

// Tests for the SQL Workbench widget: notebooks, running, write confirmation, explain

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { QWidgetMetaData, SqlExecuteRequest } from '@/types'
import { server } from '@/mocks/node'
import { sqlReadOnlyCapabilities } from '@/mocks/fixtures/sql-workbench'
import { WidgetRenderer } from '@/components/widgets/WidgetRenderer'
import SqlWorkbenchWidget from './SqlWorkbenchWidget'

vi.mock('./SqlEditor', () => ({
  SqlEditor: ({
    value,
    onChange,
    label,
    onRun,
  }: {
    value: string
    onChange: (v: string) => void
    label: string
    onRun?: () => void
  }) => (
    <textarea
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.ctrlKey) onRun?.()
      }}
    />
  ),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeAll(() => {
  // Recharts' ResponsiveContainer observes its size; jsdom has no ResizeObserver.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

const BASE = '/qqq/v1/sql-workbench'
const widgetMetaData = {
  name: 'sqlWorkbenchWidget',
  label: 'SQL Workbench',
  type: 'SQL_WORKBENCH',
} as QWidgetMetaData

/**
 * Renders an element inside a fresh query client.
 *
 * @param ui - The element.
 * @returns The render result.
 */
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('SqlWorkbenchWidget', () => {
  it('lists notebooks and opens one into the URL', async () => {
    const user = userEvent.setup()
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    await user.click(await screen.findByRole('button', { name: /Monthly signups/ }))
    expect(await screen.findByDisplayValue('Monthly signups')).toBeInTheDocument()
    expect(window.location.search).toBe('?notebook=1')
    expect(screen.getByText('month')).toBeInTheDocument()
    expect(screen.getByText(':since')).toBeInTheDocument()

    expect(screen.getByRole('tab', { name: 'My notebooks' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await user.click(screen.getByRole('tab', { name: 'Shared library' }))
    expect(screen.getByRole('tab', { name: 'Shared library' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(await screen.findByRole('button', { name: /Orphan media/ })).toBeInTheDocument()
  })

  it('adds a history entry as one cell, and not again on save or notebook switch', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/?notebook=1')
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    await screen.findByDisplayValue('Monthly signups')
    const before = screen.getAllByLabelText(/^SQL for cell/).length

    await user.click(screen.getByRole('button', { name: /SELECT \* FROM person/ }))
    await waitFor(() => expect(screen.getAllByLabelText(/^SQL for cell/)).toHaveLength(before + 1))

    // Save bumps the version, which remounts the draft: the request must not re-apply.
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^SQL for cell/)).toHaveLength(before + 1)

    // Switching notebooks must not inject the old request into the other notebook.
    await user.click(screen.getByRole('button', { name: 'New notebook' }))
    expect(await screen.findByDisplayValue('Untitled notebook')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^SQL for cell/)).toHaveLength(1)
    expect(screen.getByLabelText('SQL for cell 1')).toHaveValue('')
  })

  it('opens SQL from the URL (a record developer view link) as a cell, without running it, once', async () => {
    window.history.replaceState(null, '', '/?sql=SELECT%20id%20FROM%20person%20WHERE%20id%20%3D%207')
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    await waitFor(() => expect(screen.getAllByLabelText(/^SQL for cell/).map((cell) => (cell as HTMLTextAreaElement).value)).toContain('SELECT id FROM person WHERE id = 7'))
    expect(window.location.search).toBe('')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error when the notebook list fails to load', async () => {
    server.use(
      http.get(`${BASE}/notebooks`, () =>
        HttpResponse.json({ error: 'Database unavailable.' }, { status: 500 })
      )
    )
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    expect(await screen.findByText(/Could not load notebooks/)).toBeInTheDocument()
    expect(screen.queryByText('No notebooks yet.')).not.toBeInTheDocument()
  })

  it('locks the default backend and cell controls on a notebook the user cannot edit', async () => {
    const { sqlNotebook } = await import('@/mocks/fixtures/sql-workbench')
    server.use(
      http.get(`${BASE}/notebooks/:id`, () => HttpResponse.json({ ...sqlNotebook, canEdit: false }))
    )
    window.history.replaceState(null, '', '/?notebook=1')
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    await screen.findByDisplayValue('Monthly signups')
    expect(screen.getByLabelText('Default backend')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^Delete cell/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Move cell/ })).not.toBeInTheDocument()
  })

  it('runs read-only SQL and shows typed results', async () => {
    const user = userEvent.setup()
    let sent: SqlExecuteRequest | null = null
    server.use(
      http.post(`${BASE}/execute`, async ({ request }) => {
        sent = (await request.json()) as SqlExecuteRequest
        const { sqlSelectResult } = await import('@/mocks/fixtures/sql-workbench')
        return HttpResponse.json(sqlSelectResult)
      }),
      http.get(`${BASE}/capabilities`, async () => {
        const { sqlCapabilities } = await import('@/mocks/fixtures/sql-workbench')
        return HttpResponse.json({
          ...sqlCapabilities,
          limits: { ...sqlCapabilities.limits, pageSize: 2 },
        })
      })
    )
    window.history.replaceState(null, '', '/?notebook=1')
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    await user.click(await screen.findByRole('button', { name: 'Run' }))

    const table = await screen.findByRole('table', { name: 'Query result' })
    expect(within(table).getByText('Darin')).toBeInTheDocument()
    expect(within(table).getAllByText('NULL').length).toBeGreaterThan(0)
    expect(within(table).getByText('<binary 4 bytes>')).toBeInTheDocument()
    expect(sent!.mode).toBe('READ_ONLY')
    expect(sent!.params).toEqual({ since: '2026-01-01' })
    expect(sent!.cellKey).toBe('c1')
    expect(sent!.executionUuid).toMatch(/[0-9a-f-]{36}/)
    expect(screen.getByText(/Succeeded · .* · 3 rows/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(await screen.findByRole('menuitem', { name: 'CSV' })).toHaveAttribute(
      'href',
      '/qqq/v1/sql-workbench/executions/exec-1/export?format=csv'
    )
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await within(table).findByText('Tim')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Chart' }))
    expect(screen.getByLabelText('Chart type')).toBeInTheDocument()
  })

  it('shows SQL errors as results', async () => {
    const user = userEvent.setup()
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    const editor = await screen.findByLabelText('SQL for cell 1')
    await user.type(editor, 'select broken')
    await user.click(screen.getByRole('button', { name: 'Run' }))
    expect(await screen.findByText(/column "broken" does not exist/)).toBeInTheDocument()
  })

  it('previews a write and commits only after confirmation', async () => {
    const user = userEvent.setup()
    const bodies: SqlExecuteRequest[] = []
    server.use(
      http.post(`${BASE}/execute`, async ({ request }) => {
        const body = (await request.json()) as SqlExecuteRequest
        bodies.push(body)
        const { sqlWritePreview, sqlWriteCommit } = await import('@/mocks/fixtures/sql-workbench')
        return HttpResponse.json(body.confirmToken ? sqlWriteCommit : sqlWritePreview)
      })
    )
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    await user.type(
      await screen.findByLabelText('SQL for cell 1'),
      'UPDATE person SET active = false'
    )
    await user.click(screen.getByLabelText('Write mode'))
    await user.click(screen.getByRole('button', { name: 'Preview write' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/1,204 rows affected/)).toBeInTheDocument()
    const commit = within(dialog).getByRole('button', { name: 'Commit write' })
    expect(commit).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Type postgres to confirm/), 'postgres')
    expect(commit).toBeDisabled()
    await user.click(within(dialog).getByLabelText(/I understand/))
    await user.click(commit)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies).toHaveLength(2)
    expect(bodies[0].confirmToken).toBeUndefined()
    expect(bodies[1]).toMatchObject({
      mode: 'WRITE',
      confirmToken: 'token-1',
      acknowledgeRowGuard: true,
    })
    expect(await screen.findByText(/1,204 rows affected/)).toBeInTheDocument()
  })

  it('explains a statement as a plan tree', async () => {
    const user = userEvent.setup()
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    await user.type(await screen.findByLabelText('SQL for cell 1'), 'SELECT 1')
    await user.click(screen.getByRole('button', { name: 'Explain' }))
    const plan = await screen.findByRole('list', { name: 'Query plan' })
    expect(within(plan).getByText('Seq Scan')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Raw text' }))
    expect(screen.getByText('[{"Plan": {}}]')).toBeInTheDocument()
  })

  it('saves a new notebook', async () => {
    const user = userEvent.setup()
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    const title = await screen.findByLabelText('Notebook title')
    await user.clear(title)
    await user.type(title, 'Fresh')
    await user.click(screen.getByRole('button', { name: 'Add notes cell' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(window.location.search).toBe('?notebook=9'))
  })

  it('hides write controls for read-only users', async () => {
    server.use(http.get(`${BASE}/capabilities`, () => HttpResponse.json(sqlReadOnlyCapabilities)))
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    expect(await screen.findByText('Read-only')).toBeInTheDocument()
    expect(screen.queryByLabelText('Write mode')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Explain analyze' })).not.toBeInTheDocument()
  })

  it('says when the workbench is unavailable', async () => {
    server.use(
      http.get(`${BASE}/capabilities`, () =>
        HttpResponse.json({ error: 'Permission denied.' }, { status: 403 })
      )
    )
    renderWithClient(<SqlWorkbenchWidget widgetMetaData={widgetMetaData} />)
    expect(await screen.findByText(/not available to you/)).toBeInTheDocument()
  })

  it('is rendered by WidgetRenderer for SQL_WORKBENCH and has no axe violations', async () => {
    const { container } = renderWithClient(
      <WidgetRenderer widgetMetaData={widgetMetaData} data={{}} />
    )
    await screen.findByRole('button', { name: 'New notebook' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
