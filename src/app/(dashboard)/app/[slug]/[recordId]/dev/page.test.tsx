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

// Tests for the record developer view (raw values and associated scripts)

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
  getRecordDeveloperData: vi.fn(),
  getAssociatedScriptLogs: vi.fn(),
  queryScriptRevisionFiles: vi.fn(async () => []),
  queryScriptRevisions: vi.fn(async () => []),
  queryScriptTypeFileSchemas: vi.fn(async () => []),
  storeRecordAssociatedScript: vi.fn(),
  storeScriptRevision: vi.fn(),
  testScript: vi.fn(),
}))

import { getRecordDeveloperData } from '@/lib/api/developer'
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

    expect(await screen.findByRole('heading', { name: 'Record Raw Values as JSON' })).toBeInTheDocument()
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

  it('reports a failure to load the associated scripts', async () => {
    serveInstance([])
    vi.mocked(getRecordDeveloperData).mockRejectedValue(new Error('Permission denied.'))
    renderPage()

    expect(await screen.findByText('Failed to load associated scripts: Permission denied.')).toHaveAttribute('role', 'alert')
  })
})
