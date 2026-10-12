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

// Tests for the record developer view (header parity, sections, API access, provider panels, raw values and associated scripts)

import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { QInstance } from '@/types'
import { QContextProvider, useQContext } from '@/lib/context/q-context'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { server } from '@/mocks/node'
import RecordDeveloperViewPage from './page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'person', recordId: '1' }),
  usePathname: () => '/app/person/1/dev',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/api/tables', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api/tables')>(),
  getRecord: vi.fn(),
}))

vi.mock('@/lib/api/developer', () => ({
  SCRIPT_LOG_TABLE: 'scriptLog',
  scriptLogsFilter: (id: number) => ({ criteria: [{ fieldName: 'scriptRevisionId', operator: 'EQUALS', values: [id] }] }),
  loadScriptTestDetails: vi.fn(),
  queryScriptLogs: vi.fn(async () => []),
  getRecordDeveloperData: vi.fn(),
  getAssociatedScriptLogs: vi.fn(),
  queryScriptRevisionFiles: vi.fn(async () => []),
  queryScriptRevisions: vi.fn(async () => []),
  queryScriptTypeFileSchemas: vi.fn(async () => []),
  storeRecordAssociatedScript: vi.fn(),
  storeScriptRevision: vi.fn(),
  testScript: vi.fn(),
  getTableApis: vi.fn(async () => []),
  getApiVersions: vi.fn(),
  getApiTableSpec: vi.fn(),
  apiTableSpecUrl: () => '/api/v1/person/openapi.json',
  apiMiddlewareBaseURL: () => '',
}))

vi.mock('@/lib/api/developer-panels', () => ({
  getRecordDeveloperPanels: vi.fn(async () => []),
}))

import { getRecordDeveloperData } from '@/lib/api/developer'
import { getRecordDeveloperPanels, type DeveloperPanel } from '@/lib/api/developer-panels'
import { getRecord } from '@/lib/api/tables'

const record = { tableName: 'person', recordLabel: 'Ada Lovelace', values: { id: 1, firstName: 'Ada', email: null } }

/**
 * Shows the page header set through the Q context.
 * @returns The header text.
 */
function PageHeader() {
  const { pageHeader } = useQContext()
  return <p data-testid="page-header">{String(pageHeader)}</p>
}

/**
 * Serve instance metadata with the given script processes.
 * @param processNames - Script processes the session may run.
 * @returns Reports whether the metadata was requested.
 */
function serveInstance(processNames: string[]): () => boolean {
  let served = false
  const processes: QInstance['processes'] = { ...qInstance.processes }
  for (const name of processNames) {
    processes[name] = { name, label: name, tableName: '', isHidden: true, iconName: '', frontendSteps: [], hasPermission: true } as unknown as QInstance['processes'][string]
  }
  server.use(http.get('/qqq/v1/metaData', () => {
    served = true
    return HttpResponse.json({ ...qInstance, processes })
  }))
  return () => served
}

/**
 * Render the page with fresh query and Q contexts.
 * @returns The render result.
 */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <QContextProvider>
        <PageHeader />
        <RecordDeveloperViewPage />
      </QContextProvider>
    </QueryClientProvider>
  )
}

describe('RecordDeveloperViewPage', () => {
  beforeEach(() => {
    vi.mocked(getRecord).mockResolvedValue(record)
    vi.mocked(getRecordDeveloperData).mockResolvedValue({
      record: { ...record, values: { ...record.values, firstName: 101 } },
      associatedScripts: [{
        associatedScript: { fieldName: 'firstName', scriptTypeId: 101 },
        scriptType: { tableName: 'scriptType', values: { id: 101, fileMode: 1 } },
        script: { tableName: 'script', values: { id: 101, name: 'Alpha Greeting', currentScriptRevisionId: 102 } },
      }],
    })
  })

  it('shows the raw values and a card per associated script, headed by the field label', async () => {
    serveInstance(['storeScriptRevision', 'testScript'])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Record Raw Values as JSON' }, { timeout: 5000 })).toBeInTheDocument()
    const card = await waitFor(() => {
      const element = document.querySelector('[data-qqq-id="associated-script-firstName"]')
      if (!element) throw new Error('no card')
      return element as HTMLElement
    })
    expect(within(card).getByRole('heading', { name: 'First Name' })).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('[data-qqq-id="button-edit-script-firstName"]')).not.toBeNull())
    expect(within(card).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Code', 'Logs', 'Test', 'Docs'])
    expect(screen.getByTestId('page-header')).toHaveTextContent('Ada Lovelace Developer Mode')
    expect(getRecordDeveloperData).toHaveBeenCalledWith('person', '1')
  })

  it('shows the raw values of the developer-mode record, not a separate record read (Material getRecordDeveloperMode)', async () => {
    serveInstance([])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Record Raw Values as JSON' }, { timeout: 5000 })).toBeInTheDocument()
    const json = document.querySelector('[data-qqq-id="json-output"]') as HTMLElement
    expect(JSON.parse(json.textContent ?? '')).toEqual({ id: 1, firstName: 101, email: null })
    const row = document.querySelector('[data-qqq-id="record-dev-field-table"] [data-qqq-id="dev-field-firstName"]') as HTMLElement
    expect(row.querySelectorAll('td')[3]).toHaveTextContent('101')
    expect(getRecord).not.toHaveBeenCalled()
  })

  it('gates editing and testing on the script processes in the instance metadata', async () => {
    const served = serveInstance([])
    renderPage()

    await waitFor(() => expect(served()).toBe(true))
    // let the metadata response settle into the query cache before asserting its absence
    await new Promise((resolve) => setTimeout(resolve, 50))
    const card = await waitFor(() => {
      const element = document.querySelector('[data-qqq-id="associated-script-firstName"]')
      if (!element) throw new Error('no card')
      return element as HTMLElement
    })
    await waitFor(() => expect(within(card).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Code', 'Logs', 'Docs']))
    expect(document.querySelector('[data-qqq-id="button-edit-script-firstName"]')).toBeNull()
  })

  it('reports a failure to load the developer-mode record', async () => {
    serveInstance([])
    vi.mocked(getRecordDeveloperData).mockRejectedValue(new Error('Permission denied.'))
    renderPage()

    expect(await screen.findByText('Failed to load record: Permission denied.', {}, { timeout: 5000 })).toHaveAttribute('role', 'alert')
    expect(screen.queryByRole('heading', { name: 'Record Raw Values as JSON' })).not.toBeInTheDocument()
  })

  it('has the record screen header: back link, record title, actions and audit (no view-mode toggle)', async () => {
    serveInstance([])
    renderPage()

    const back = await screen.findByRole('link', { name: 'Back to Ada Lovelace' }, { timeout: 5000 })
    expect(back).toHaveAttribute('href', '/app/person/1')
    expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'View mode' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="record-view-desktop-actions"]')).not.toBeNull()
    expect(screen.getByText(/Developer view/)).toBeInTheDocument()
  })

  it('navigates sections from a sticky section nav', async () => {
    serveInstance([])
    renderPage()

    const nav = await screen.findByRole('navigation', { name: 'Developer view sections' }, { timeout: 5000 })
    await waitFor(() => expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(
      expect.arrayContaining(['Fields', 'API', 'Scripts', 'JSON', 'Table Metadata'])))
    expect(screen.getByRole('heading', { name: 'API Access' })).toBeInTheDocument()
  })

  it('lists the v1 operations the user may perform, with curl examples using placeholder credentials', async () => {
    serveInstance([])
    renderPage()

    const api = await waitFor(() => {
      const element = document.querySelector('[data-qqq-id="dev-api-access"]')
      if (!element) throw new Error('no api section')
      return element as HTMLElement
    })
    await waitFor(() => expect(within(api).getByText('Get this record')).toBeInTheDocument())
    for (const label of ['Query by primary key', 'Count matching records', 'Insert a copy', 'Update this record', 'Delete this record']) {
      expect(within(api).getByText(label)).toBeInTheDocument()
    }
    const snippet = api.querySelector('[data-qqq-id="dev-api-snippet-get"]') as HTMLElement
    expect(snippet.textContent).toContain('curl -X GET')
    expect(snippet.textContent).toContain('/qqq/v1/table/person/1')
    expect(snippet.textContent).toContain('sessionUUID=<your-session-uuid>')
  })

  it('renders no provider panels when none are available (qbits absent)', async () => {
    serveInstance([])
    renderPage()

    await screen.findByRole('heading', { name: 'API Access' }, { timeout: 5000 })
    await waitFor(() => expect(getRecordDeveloperPanels).toHaveBeenCalledWith('person', '1'))
    expect(document.querySelector('[data-qqq-id^="dev-section-panel-"]')).toBeNull()
  })

  it('renders each provider panel (ESB, quick search, SQL workbench, assistant) with a nav entry', async () => {
    const panels: DeveloperPanel[] = [
      { id: 'esb', title: 'ESB Events', order: 300, statusLabel: 'Publishing', statusTone: 'SUCCESS', blocks: [
        { type: 'KEY_VALUES', items: [{ label: 'type', value: 'qqq.table.person.updated', monospace: true }] },
        { type: 'CODE', label: 'Sample event', language: 'json', code: '{"subject":"1"}' },
      ] },
      { id: 'quickSearch', title: 'Quick Search', order: 400, statusLabel: 'Indexed', blocks: [
        { type: 'ACTIONS', actions: [{ label: 'Reindex this record', processName: 'quickSearchReindexRecords_person' }] },
      ] },
      { id: 'sqlWorkbench', title: 'SQL Workbench', order: 450, blocks: [
        { type: 'LINKS', links: [{ label: 'Open in SQL Workbench', href: '/app/sqlWorkbench?sql=SELECT+1' }, { label: 'Bad', href: 'javascript:alert(1)' }] },
      ] },
      { id: 'assistant', title: 'Assistant', order: 600, error: 'This panel could not be built.', blocks: [] },
    ]
    vi.mocked(getRecordDeveloperPanels).mockResolvedValue(panels)
    serveInstance([])
    renderPage()

    const nav = await screen.findByRole('navigation', { name: 'Developer view sections' }, { timeout: 5000 })
    await waitFor(() => expect(within(nav).getByText('ESB Events')).toBeInTheDocument())
    for (const title of ['Quick Search', 'SQL Workbench', 'Assistant']) expect(within(nav).getByText(title)).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: /ESB Events/ })).toBeInTheDocument()
    expect(screen.getByText('qqq.table.person.updated')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reindex this record/ }).getAttribute('href')).toContain('/app/quickSearchReindexRecords_person')
    expect(screen.getByRole('link', { name: 'Open in SQL Workbench' })).toHaveAttribute('href', '/app/sqlWorkbench?sql=SELECT+1')
    expect(screen.queryByRole('link', { name: 'Bad' })).not.toBeInTheDocument()
    expect(screen.getByText('This panel could not be built.')).toHaveAttribute('role', 'alert')
  })
})
