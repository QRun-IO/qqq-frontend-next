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

// Tests for the SQL Workbench building blocks: editor, markdown, plan tree, result grid, chart

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { sqlExplain, sqlSchema, sqlSelectResult } from '@/mocks/fixtures/sql-workbench'
import { MarkdownView } from './MarkdownView'
import { PlanTree } from './PlanTree'
import { QuickChart } from './QuickChart'
import { ResultGrid } from './ResultGrid'
import { SqlEditor } from './SqlEditor'

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

describe('SqlEditor', () => {
  it('shows the value, reports edits, follows prop changes and runs on Mod-Enter', async () => {
    const onChange = vi.fn()
    const onRun = vi.fn()
    const { rerender } = render(
      <SqlEditor
        value="SELECT 1"
        onChange={onChange}
        onRun={onRun}
        dialect="postgresql"
        schema={sqlSchema}
        label="SQL"
        qqqId="editor-test"
      />
    )
    const content = screen.getByLabelText('SQL')
    expect(content).toHaveAttribute('data-qqq-id', 'editor-test')
    expect(content.textContent).toContain('SELECT 1')

    rerender(
      <SqlEditor
        value="SELECT 2"
        onChange={onChange}
        onRun={onRun}
        dialect="mysql"
        label="SQL"
        qqqId="editor-test"
        readOnly
      />
    )
    await waitFor(() => expect(screen.getByLabelText('SQL').textContent).toContain('SELECT 2'))
    expect(onChange).toHaveBeenCalledWith('SELECT 2')

    const user = userEvent.setup()
    rerender(
      <SqlEditor
        value="SELECT 2"
        onChange={onChange}
        onRun={onRun}
        label="SQL"
        qqqId="editor-test"
      />
    )
    screen.getByLabelText('SQL').focus()
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onRun).toHaveBeenCalled()
  })
})

describe('MarkdownView', () => {
  it('renders blocks and inline markup as elements, never as HTML', () => {
    const { container } = render(
      <MarkdownView
        source={
          '# Title\n\nSome **bold**, *em*, `code` and [a link](https://example.com) <b>raw</b>\n\n- one\n- two\n\n1. first\n\n```\nSELECT 1\n```\n###### small'
        }
      />
    )
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('em').tagName).toBe('EM')
    expect(screen.getByText('code').tagName).toBe('CODE')
    expect(screen.getByRole('link', { name: 'a link' })).toHaveAttribute(
      'href',
      'https://example.com'
    )
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText(/<b>raw<\/b>/)).toBeInTheDocument()
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('ol li')).toHaveLength(1)
    expect(container.querySelector('pre')?.textContent).toBe('SELECT 1')
    expect(screen.getByRole('heading', { name: 'small' })).toBeInTheDocument()
  })

  it('does not link javascript: URLs', () => {
    const { container } = render(<MarkdownView source="[x](javascript:alert(1))" />)
    expect(container.querySelector('a')).toBeNull()
  })

  it('links relative app paths in the same tab, but not protocol-relative URLs', () => {
    const { container } = render(<MarkdownView source="[open](/app/orders/7) and [bad](//evil.example)" />)
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/app/orders/7')
    expect(links[0]).not.toHaveAttribute('target')
  })
})

describe('PlanTree', () => {
  it('renders nodes with costs and toggles the raw plan', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlanTree explain={sqlExplain} />)
    const tree = screen.getByRole('list', { name: 'Query plan' })
    expect(within(tree).getByText('Sort')).toBeInTheDocument()
    expect(within(tree).getByText('on person')).toBeInTheDocument()
    expect(within(tree).getByText('cost 10..12.5')).toBeInTheDocument()
    expect(within(tree).getByText('Sort Key')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
    await user.click(screen.getByRole('button', { name: 'Raw text' }))
    expect(screen.queryByRole('list', { name: 'Query plan' })).not.toBeInTheDocument()
  })

  it('shows analyze times and errors', () => {
    const plan = { ...sqlExplain.plan!, actualTimeMs: 1.5, actualRows: 10, loops: 1 }
    const { rerender } = render(<PlanTree explain={{ ...sqlExplain, analyze: true, plan }} />)
    expect(screen.getByText(/actual 1.5 ms/)).toBeInTheDocument()
    rerender(<PlanTree explain={{ executionUuid: 'x', status: 'FAILED', error: 'syntax error' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('syntax error')
    rerender(<PlanTree explain={{ executionUuid: 'x', status: 'FAILED' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be produced')
  })
})

describe('ResultGrid', () => {
  it('sorts through the server cache and copies the page', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { container } = renderWithClient(
      <ResultGrid
        executionUuid="exec-1"
        columns={sqlSelectResult.columns!}
        firstPage={sqlSelectResult.rows!}
        rowCount={2}
        pageSize={10}
        truncated
        truncatedReason="BYTES"
      />
    )
    expect(screen.getByText(/capped by the size limit/)).toBeInTheDocument()
    expect(screen.getByText('{"k":1}')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: /Copy page/ }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('id\tfirst_name'))

    await user.click(screen.getByRole('button', { name: /^id/ }))
    expect(await screen.findByText('Tim')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /^id/ })).toHaveAttribute(
      'aria-sort',
      'ascending'
    )
    await user.click(screen.getByRole('button', { name: /^id/ }))
    expect(screen.getByRole('columnheader', { name: /^id/ })).toHaveAttribute(
      'aria-sort',
      'descending'
    )
    await user.click(screen.getByRole('button', { name: /^id/ }))
    expect(screen.getByRole('columnheader', { name: /^id/ })).toHaveAttribute('aria-sort', 'none')
  })

  it('handles statements without rows, static snapshots and copy failures', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('no')) },
      configurable: true,
    })
    const { rerender } = renderWithClient(
      <ResultGrid executionUuid="x" columns={[]} firstPage={[]} rowCount={0} pageSize={10} />
    )
    expect(screen.getByText(/returned no rows/)).toBeInTheDocument()
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ResultGrid
          executionUuid="x"
          columns={sqlSelectResult.columns!}
          firstPage={sqlSelectResult.rows!}
          rowCount={2}
          pageSize={2}
          staticRows
        />
      </QueryClientProvider>
    )
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Copy page/ }))
  })
})

describe('QuickChart', () => {
  it('offers chart types and value columns, or explains why it cannot chart', async () => {
    const user = userEvent.setup()
    const columns = [
      { name: 'm', label: 'month', typeName: 'text', jdbcType: 12, kind: 'string' as const },
      { name: 'n', label: 'signups', typeName: 'int4', jdbcType: 4, kind: 'number' as const },
    ]
    const { rerender } = render(
      <QuickChart
        columns={columns}
        rows={[
          ['jan', 3],
          ['feb', 5],
        ]}
      />
    )
    expect(screen.getByRole('img', { name: /bar chart of signups by month/ })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Chart type'), 'line')
    expect(screen.getByRole('img', { name: /line chart/ })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Chart type'), 'pie')
    await user.click(screen.getByLabelText('signups'))
    expect(screen.getByRole('img', { name: /pie chart of signups/ })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Category'), '1')
    rerender(<QuickChart columns={[columns[0]]} rows={[['jan']]} />)
    expect(screen.getByText(/need at least one numeric column/)).toBeInTheDocument()
  })
})
