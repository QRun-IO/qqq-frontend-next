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

// Tests for one process screen: component composition, payload and actions

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QFieldMetaData, QFrontendStepMetaData, QProcessMetaData } from '@/types'

vi.mock('@/lib/api/processes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/processes')>()),
  processRecords: vi.fn().mockResolvedValue({ totalRecords: 1, records: [{ tableName: 't', values: { id: 7, name: 'Seven' } }] }),
}))
vi.mock('@/lib/api/possible-values', () => ({
  fetchProcessPossibleValues: vi.fn().mockResolvedValue([{ id: 'green', label: 'Green' }]),
  fetchTablePossibleValues: vi.fn().mockResolvedValue([]),
  fetchPossibleValues: vi.fn().mockResolvedValue([]),
}))

import { fetchProcessPossibleValues } from '@/lib/api/possible-values'
import { ProcessStepScreen, type ProcessStepScreenProps } from './ProcessStepScreen'

/**
 * Minimal field metadata.
 * @param name - Field name.
 * @param label - Label.
 * @param extra - Overrides.
 * @returns The field.
 */
function field(name: string, label: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra }
}

const mixed: QFrontendStepMetaData = {
  name: 'mixed', label: 'Mixed',
  components: [
    { type: 'HELP_TEXT', values: { text: 'First line\nSecond line' } },
    { type: 'VIEW_FORM' },
    { type: 'EDIT_FORM', values: { includeFieldNames: ['labName'], sectionLabel: 'Inputs' } },
    { type: 'HTML' },
    { type: 'RECORD_LIST' },
    { type: 'DOWNLOAD_FORM' },
  ],
  formFields: [field('labName', 'Lab Name', { isRequired: true }), field('labNote', 'Lab Note')],
  viewFields: [field('intro', 'Introduction')],
  recordListFields: [field('id', 'Id', { type: 'INTEGER' }), field('name', 'Name')],
}
const done: QFrontendStepMetaData = { name: 'done', label: 'Done', components: [{ type: 'VIEW_FORM' }] }
const later: QFrontendStepMetaData = { name: 'later', label: 'Later', components: [] }
const process: QProcessMetaData = {
  name: 'lab', label: 'Lab', tableName: '', isHidden: false, iconName: '', hasPermission: true, stepFlow: 'LINEAR', minInputRecords: 0,
  frontendSteps: [mixed, later, done],
}

/**
 * Render a screen with defaults.
 * @param props - Overrides.
 * @returns Callbacks passed to the screen.
 */
function renderScreen(props: Partial<ProcessStepScreenProps> = {}) {
  const callbacks = { onSubmit: vi.fn(), onBack: vi.fn(), onCancel: vi.fn(), onReturn: vi.fn() }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ProcessStepScreen
        processName="lab" processMetaData={process} processUUID="run-1" step={mixed} steps={process.frontendSteps}
        values={{ intro: 'Hello', 'mixed.html': '<b>Bold</b><script>alert(1)</script>', downloadFileName: 'f.txt', serverFilePath: '/tmp/f.txt', sourceTable: 'x', transform: { name: 'Big' } }}
        backStep={null} isWorking={false} {...callbacks} {...props}
      />
    </QueryClientProvider>
  )
  return callbacks
}

describe('ProcessStepScreen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders every declared component in order (#645)', async () => {
    renderScreen()
    const form = screen.getByRole('form', { name: 'Mixed' })
    const types = Array.from(form.querySelectorAll('[data-component-type]')).map((node) => node.getAttribute('data-component-type'))
    expect(types).toEqual(['HELP_TEXT', 'VIEW_FORM', 'EDIT_FORM', 'HTML', 'RECORD_LIST', 'DOWNLOAD_FORM'])
    expect(screen.getByText('First line')).toBeInTheDocument()
    expect(screen.getByText('Second line')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    const inputs = screen.getByRole('region', { name: 'Inputs' })
    expect(within(inputs).getByLabelText(/Lab Name/)).toBeInTheDocument()
    expect(within(inputs).queryByLabelText('Lab Note')).toBeNull()
    expect(screen.getByText('Bold')).toBeInTheDocument()
    expect(form.querySelector('script')).toBeNull()
    expect(await screen.findByRole('cell', { name: 'Seven' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'f.txt' })).toHaveAttribute('href', '/qqq/v1/download/f.txt?filePath=%2Ftmp%2Ff.txt')
    expect(screen.getAllByRole('button', { name: /^(Next|Submit)$/ })).toHaveLength(1)
  })

  it('sends the screen values with a filtered choice search and with a view label lookup', async () => {
    const user = userEvent.setup()
    const pick: QFrontendStepMetaData = {
      name: 'pick', label: 'Pick', components: [{ type: 'VIEW_FORM' }, { type: 'EDIT_FORM' }],
      viewFields: [field('color', 'Color', { possibleValueSourceName: 'colors' })],
      formFields: [field('category', 'Category'), field('color', 'Color', { possibleValueSourceName: 'colors' })],
    }
    renderScreen({ step: pick, values: { category: 'warm', color: 'green', records: [{ id: 1 }] } })
    expect(await screen.findByText('Green')).toBeInTheDocument()
    expect(fetchProcessPossibleValues).toHaveBeenCalledWith('lab', 'color', { ids: 'green', formValues: { category: 'warm', color: 'green' } })
    vi.mocked(fetchProcessPossibleValues).mockClear()
    await user.click(screen.getByRole('combobox', { name: /Color/ }))
    await waitFor(() => expect(fetchProcessPossibleValues).toHaveBeenCalledWith('lab', 'color', expect.objectContaining({
      formValues: expect.objectContaining({ category: 'warm', color: 'green' }),
    })))
  })

  it('validates required inputs and submits only the screen values', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Lab Name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/Lab Name/), 'Nova')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ labName: 'Nova' }, undefined))
  })

  it('offers Back only with a backend back step', async () => {
    const user = userEvent.setup()
    renderScreen()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    const { onBack } = renderScreen({ backStep: 'mixed' })
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('labels the button Submit before the last screen and offers only Return on it', () => {
    renderScreen({ step: later, values: {} })
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })

  it('offers only Return on the last screen or when noMoreSteps is set', async () => {
    const user = userEvent.setup()
    const { onReturn } = renderScreen({ step: done, values: {} })
    expect(screen.queryByRole('button', { name: /Next|Submit|Cancel/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Return' }))
    expect(onReturn).toHaveBeenCalled()
  })

  it('treats a noMoreSteps value as the end of the run', () => {
    renderScreen({ step: later, values: { noMoreSteps: true } })
    expect(screen.getByRole('button', { name: 'Return' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
  })
})
