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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import * as api from '@/lib/api/data-analysis'
import { insertRecord } from '@/lib/api/tables'
import { downloadAnalysisFile } from '@/lib/utils/analysis-download'
import { savedCases } from '../../../tests/fixtures/data-analysis-saved'
import { AnalysisActions } from './AnalysisActions'
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/api/data-analysis')
vi.mock('@/lib/api/tables')
vi.mock('@/lib/utils/analysis-download')
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
const clients: QueryClient[] = []
function mount(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(insertRecord).mockResolvedValue({
    tableName: 'data_analysis_saved',
    values: { id: 42 },
  })
})
afterEach(() => {
  cleanup()
  clients.forEach((c) => c.clear())
  clients.length = 0
})
describe('analysis actions', () => {
  for (const { definition } of savedCases)
    it(`saves the executed ${definition.kind} request through core CRUD`, async () => {
      mount(<AnalysisActions definition={definition} tableName="person" chartKind="BAR" />)
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' My analysis ' } })
      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: 'Monthly review' },
      })
      fireEvent.click(screen.getByLabelText('Shared'))
      expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations()
      fireEvent.click(screen.getByRole('button', { name: 'Save analysis' }))
      await waitFor(() =>
        expect(insertRecord).toHaveBeenCalledWith('data_analysis_saved', {
          name: 'My analysis',
          description: 'Monthly review',
          shared: true,
          kind: definition.kind,
          table_name: 'person',
          definition_json: JSON.stringify(definition.request),
          filter_json: JSON.stringify(
            (definition.kind === 'COMPARE'
              ? definition.request.filterA
              : definition.request.filter) ?? {}
          ),
          chart_kind: 'BAR',
        })
      )
      await waitFor(() => expect(toast.success).toHaveBeenCalled())
      const options = vi.mocked(toast.success).mock.calls[0][1]
      expect(options?.action).toMatchObject({ label: 'Open' })
      if (options?.action && typeof options.action === 'object' && 'onClick' in options.action)
        options.action.onClick({} as React.MouseEvent<HTMLButtonElement>)
      expect(push).toHaveBeenCalledWith('/app/data_analysis_saved/42')
    })
  it('keeps failed inserts open and rejects blank names', async () => {
    vi.mocked(insertRecord).mockRejectedValue(new Error('Save denied'))
    mount(<AnalysisActions definition={savedCases[0].definition} tableName="person" />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Save analysis' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save analysis' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Save denied')
  })
  it.each(['csv', 'xlsx'] as const)(
    'downloads unsaved %s through the file helper',
    async (format) => {
      const blob = new Blob(['result'])
      vi.mocked(api.exportAnalysis).mockResolvedValue(blob)
      mount(<AnalysisActions definition={savedCases[2].definition} tableName="person" />)
      fireEvent.click(screen.getByRole('button', { name: format.toUpperCase() }))
      await waitFor(() =>
        expect(downloadAnalysisFile).toHaveBeenCalledWith(blob, `analysis.${format}`)
      )
      expect(api.exportAnalysis).toHaveBeenCalledWith({
        ...savedCases[2].definition,
        tableName: 'person',
        format,
      })
    }
  )
  it('downloads saved results by id instead of replaying the owner request', async () => {
    vi.mocked(api.exportSavedAnalysis).mockResolvedValue(new Blob(['result']))
    mount(<AnalysisActions definition={savedCases[2].definition} tableName="person" savedId="42" />)
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    await waitFor(() => expect(api.exportSavedAnalysis).toHaveBeenCalledWith('42', 'csv'))
    expect(api.exportAnalysis).not.toHaveBeenCalled()
  })
  it('hides SQL unless capable, opens a draft when available, and shows the unavailable note', async () => {
    const props = { definition: savedCases[2].definition, tableName: 'person' }
    const mounted = mount(<AnalysisActions {...props} />)
    expect(screen.queryByRole('button', { name: 'Open in SQL Workbench' })).not.toBeInTheDocument()
    mounted.unmount()
    mount(<AnalysisActions {...props} sqlAvailable />)
    vi.mocked(api.analysisSql)
      .mockResolvedValueOnce({ available: true, sql: 'SELECT COUNT(*) FROM person' })
      .mockResolvedValueOnce({ available: false, note: 'Memory backend has no SQL.' })
      .mockRejectedValueOnce(new Error('SQL denied'))
    fireEvent.click(screen.getByRole('button', { name: 'Open in SQL Workbench' }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/app/sqlWorkbench?sql=SELECT+COUNT%28*%29+FROM+person')
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open in SQL Workbench' })).toBeEnabled()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open in SQL Workbench' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Memory backend has no SQL.')
    fireEvent.click(screen.getByRole('button', { name: 'Open in SQL Workbench' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('SQL denied')
  })
})
