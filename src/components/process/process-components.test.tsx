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

// Tests for process components: blocks, summary lines, validation review, HTML and helpers

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QFieldMetaData, QFrontendStepMetaData, QProcessMetaData, QTableMetaData } from '@/types'

vi.mock('@/lib/api/processes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/processes')>()),
  processRecords: vi.fn().mockResolvedValue({ totalRecords: 2, records: [
    { tableName: 'person', values: { firstName: 'Clone of: Avery' } },
    { tableName: 'person', values: { firstName: 'Clone of: Blair' } },
  ] }),
}))
vi.mock('@/lib/api/widgets', () => ({ fetchWidgetData: vi.fn().mockResolvedValue({ type: 'html', html: '<p>Fetched</p>' }) }))

import { fetchWidgetData } from '@/lib/api/widgets'
import { ProcessStepScreen } from './ProcessStepScreen'
import { ProcessSummaryLines, summaryRecordsHref } from './ProcessSummaryLines'
import { sanitizeProcessHtml } from './HtmlComponent'
import { formatProcessValue, interpolateProcessValues } from './process-values'
import { inputRecordBoundsMessage, processReturnPath } from './ProcessRun'

const process: QProcessMetaData = {
  name: 'lab', label: 'Lab', tableName: '', isHidden: false, iconName: '', hasPermission: true, stepFlow: 'LINEAR', minInputRecords: 0,
  frontendSteps: [],
}
const person = { name: 'person', label: 'Person', primaryKeyField: 'id', fields: {}, sections: [] } as unknown as QTableMetaData

/**
 * Render one screen.
 * @param step - The screen.
 * @param values - Process values.
 * @param extra - More screen props.
 * @returns The submit callback.
 */
function renderStep(step: QFrontendStepMetaData, values: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const onSubmit = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ProcessStepScreen processName="lab" processMetaData={{ ...process, frontendSteps: [step, { name: 'end', label: 'End', components: [] }] }}
        processUUID="run-1" step={step} steps={[step, { name: 'end', label: 'End', components: [] }]} values={values} backStep={null} isWorking={false}
        onSubmit={onSubmit} onBack={vi.fn()} onCancel={vi.fn()} onReturn={vi.fn()} {...extra} />
    </QueryClientProvider>
  )
  return onSubmit
}

describe('WIDGET components (#661)', () => {
  beforeEach(() => vi.clearAllMocks())

  const scanField: QFieldMetaData = { name: 'scanCode', label: 'Scan Code', type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] }
  const step: QFrontendStepMetaData = {
    name: 'interact', label: 'Interact',
    components: [{ type: 'WIDGET', values: { isAdHocWidget: true, blocks: [
      { blockTypeName: 'TEXT', values: { text: 'Hello ${operator}' } },
      { blockTypeName: 'TEXT', values: { text: 'Secret' }, conditional: 'showSecret' },
      { blockType: 'INPUT_FIELD', values: { fieldMetaData: scanField, submitOnEnter: true } },
      { blockTypeName: 'BUTTON', values: { label: 'Approve', actionCode: 'approve' } },
    ] } }],
  }

  it('interpolates text, hides false conditionals and submits a button action code', async () => {
    const user = userEvent.setup()
    const onSubmit = renderStep(step, { operator: 'Casey' })
    expect(screen.getByText('Hello Casey')).toBeInTheDocument()
    expect(screen.queryByText('Secret')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ actionCode: 'approve' }, undefined))
  })

  it('submits an input block on Enter with its value', async () => {
    const user = userEvent.setup()
    const onSubmit = renderStep(step, { operator: 'Casey', showSecret: true })
    expect(screen.getByText('Secret')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Scan Code'), 'ABC{Enter}')
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ scanCode: 'ABC' }, undefined))
  })

  it('seeds a named widget from process values and fetches one without them', async () => {
    const named: QFrontendStepMetaData = { name: 'w', label: 'W', components: [
      { type: 'WIDGET', values: { widgetName: 'seeded' } },
      { type: 'WIDGET', values: { widgetName: 'fetched' } },
    ] }
    const instance = { widgets: {
      seeded: { name: 'seeded', label: 'Seeded Widget', type: 'composite', hasPermission: true },
      fetched: { name: 'fetched', label: 'Fetched Widget', type: 'html', hasPermission: true },
    } }
    renderStep(named, { seeded: { blocks: [{ blockTypeName: 'TEXT', values: { text: 'From values' } }] }, color: 'red' }, { instance })
    expect(screen.getByText('From values')).toBeInTheDocument()
    expect(await screen.findByText('Fetched')).toBeInTheDocument()
    expect(fetchWidgetData).toHaveBeenCalledTimes(1)
    expect(fetchWidgetData).toHaveBeenCalledWith('fetched', { color: 'red', processUUID: 'run-1' })
  })
})

describe('VALIDATION_REVIEW_SCREEN (#659)', () => {
  const review: QFrontendStepMetaData = {
    name: 'review', label: 'Review', components: [{ type: 'VALIDATION_REVIEW_SCREEN' }],
    recordListFields: [{ name: 'firstName', label: 'First Name', type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] }],
  }

  it('shows the input count, the validation choice and a record preview', async () => {
    const user = userEvent.setup()
    const onSubmit = renderStep(review, { recordCount: 2, supportsFullValidation: true, previewMessage: 'Clones preview', sourceTable: 'person' }, { sourceTableMetaData: person })
    expect(screen.getByText('Input: 2 Person records.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Skip Validation/ }))
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
    expect(await screen.findByText('Clones preview')).toBeInTheDocument()
    expect(screen.getByText('Preview 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next preview record' }))
    expect(screen.getByText('Clone of: Blair')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ doFullValidation: 'false' }, undefined))
  })

  it('shows the validation summary once validated', () => {
    renderStep(review, { recordCount: 1, supportsFullValidation: true, sourceTable: 'person', validationSummary: [{ status: 'ERROR', count: 1, message: 'declined', primaryKeys: [5] }] }, { sourceTableMetaData: person })
    expect(screen.getByText('Validation complete on 1 Person record.')).toBeInTheDocument()
    expect(screen.getByText('1 declined')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
  })
})

describe('BULK_EDIT_FORM', () => {
  const edit: QFrontendStepMetaData = {
    name: 'edit', label: 'Edit Values', components: [{ type: 'BULK_EDIT_FORM' }],
    formFields: [{ name: 'firstName', label: 'First Name', type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] }],
  }

  it('switches a field on from its label, the switch hit area on touch screens (QRun-IO/qqq#708)', async () => {
    const user = userEvent.setup()
    const onSubmit = renderStep(edit, {}, { tableMetaData: person })
    const toggle = screen.getByRole('switch', { name: 'Edit First Name' })
    const label = toggle.closest('label')!
    expect(label).not.toBeNull()
    expect(screen.getByLabelText('First Name')).toBeDisabled()
    await user.click(label)
    expect(toggle).toBeChecked()
    expect(screen.getByLabelText('First Name')).toBeEnabled()
    await user.type(screen.getByLabelText('First Name'), 'Quinn')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Quinn', bulkEditEnabledFields: 'firstName' }), undefined))
  })
})

describe('ProcessSummaryLines', () => {
  it('renders status, count, message, bullets and record links', () => {
    render(<ProcessSummaryLines table={person} isResultScreen lines={[
      { status: 'OK', count: 1234, message: 'were cloned', primaryKeys: [1, 2] },
      { status: 'INFO', count: null, message: 'Inserted Id values between 6 and 7' },
      { status: 'WARNING', count: 2, message: 'have warnings', bulletsOfText: ['first', 'second'] },
      { status: 'OK', tableName: 'person', recordId: 7, linkPreText: 'Created ', linkText: 'person 7', linkPostText: '.' },
    ]} />)
    expect(screen.getByText('1,234 were cloned')).toBeInTheDocument()
    expect(screen.getByText('Inserted Id values between 6 and 7')).toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'person 7' })).toHaveAttribute('href', '/app/person/7')
    expect(screen.getByRole('link', { name: 'See these Person records in a new tab' })).toHaveAttribute('target', '_blank')
  })

  it('gives the record link icon a 44 px touch target on coarse pointers only (QRun-IO/qqq#708)', () => {
    render(<ProcessSummaryLines table={person} isResultScreen lines={[{ status: 'OK', count: 2, message: 'were cloned', primaryKeys: [1, 2] }]} />)
    const link = screen.getByRole('link', { name: 'See these Person records in a new tab' })
    expect(link.className).toContain('pointer-coarse:min-h-11')
    expect(link.className).toContain('pointer-coarse:min-w-11')
  })

  it('links only non-null keys of a table with a primary key', () => {
    expect(summaryRecordsHref(person, [null, null])).toBeNull()
    expect(summaryRecordsHref(undefined, [1])).toBeNull()
    const href = summaryRecordsHref(person, [3, null])!
    const filter = JSON.parse(atob(decodeURIComponent(href.split('filter=')[1])))
    expect(filter.criteria).toEqual([{ fieldName: 'id', operator: 'IN', values: [3] }])
  })
})

describe('process helpers', () => {
  it('sanitizes HTML but keeps CSV and text template downloads', () => {
    const html = sanitizeProcessHtml('<a href="data:text/csv;base64,QQ==" download="t.csv">t</a><a href="data:text/html,<b>x</b>">h</a><img src="x" onerror="alert(1)"><script>alert(1)</script>')
    expect(html).toContain('href="data:text/csv;base64,QQ=="')
    expect(html).not.toContain('data:text/html')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<script')
  })

  it('formats values by type and display format and interpolates placeholders', () => {
    const f = (type: QFieldMetaData['type'], displayFormat?: string) => ({ name: 'x', label: 'X', type, displayFormat, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] })
    expect(formatProcessValue(f('INTEGER', '%,d'), 4242)).toBe('4,242')
    expect(formatProcessValue(f('DECIMAL', '$%,.2f'), '75003.5')).toBe('$75,003.50')
    expect(formatProcessValue(f('BOOLEAN'), false)).toBe('No')
    expect(formatProcessValue(f('STRING'), null)).toBe('')
    expect(formatProcessValue(f('STRING'), 'green', 'Green')).toBe('Green')
    expect(interpolateProcessValues('Hi ${a} ${missing}', { a: 'there' })).toBe('Hi there ${missing}')
  })

  it('checks countable input record bounds and finds the return route (#662)', () => {
    const bounded = { ...process, tableName: 'specimen', minInputRecords: 1, maxInputRecords: 2 }
    expect(inputRecordBoundsMessage(bounded, {})).toBe('This process requires at least 1 record to be selected, but none were selected.')
    expect(inputRecordBoundsMessage(bounded, { recordsParam: 'recordIds', recordIds: '1,2,3' })).toBe('This process allows at most 2 records to be selected, but 3 were selected.')
    expect(inputRecordBoundsMessage(bounded, { recordsParam: 'recordIds', recordIds: '1' })).toBeNull()
    expect(inputRecordBoundsMessage(bounded, { recordsParam: 'filterJSON', filterJSON: '{}' })).toBeNull()
    expect(processReturnPath(bounded, undefined)).toBe('/app/specimen')
    const instance = { appTree: [{ name: 'lab', label: 'Lab', type: 'APP', children: [{ name: 'lab', label: 'Lab', type: 'PROCESS' }] }] } as never
    expect(processReturnPath(process, instance)).toBe('/app/lab')
    expect(processReturnPath({ ...process, name: 'other' }, instance)).toBe('/app')
  })
})
