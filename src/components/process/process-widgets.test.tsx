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

// Tests for process screens hosting widgets and blocks, report inputs and embedded runs (QRun-IO/qqq#725, #736)

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QFieldMetaData, QFrontendStepMetaData, QInstance, QProcessMetaData, QTableMetaData, QWidgetMetaData } from '@/types'

vi.mock('@/lib/api/processes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/processes')>()),
  processRecords: vi.fn().mockResolvedValue({ totalRecords: 1, records: [{ tableName: 'prcKennel', values: { id: 1, name: 'North Kennel' },
    associatedRecords: { dogs: [{ tableName: 'prcDog', values: { name: 'Rex', breed: 'Collie' } }, { tableName: 'prcDog', values: { name: 'Fido', breed: 'Pug' } }] } }] }),
}))
vi.mock('@/lib/api/widgets', () => ({ fetchWidgetData: vi.fn() }))
vi.mock('@/lib/api/metadata', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/metadata')>()),
  loadTableMetaData: vi.fn(),
}))
vi.mock('@/lib/api/possible-values', () => ({
  fetchProcessPossibleValues: vi.fn().mockResolvedValue([]),
  fetchTablePossibleValues: vi.fn().mockResolvedValue([]),
  fetchPossibleValues: vi.fn().mockResolvedValue([{ id: 2, label: 'Cat' }, { id: 1, label: 'Dog' }]),
}))

import { fetchWidgetData } from '@/lib/api/widgets'
import { loadTableMetaData } from '@/lib/api/metadata'
import { fetchPossibleValues } from '@/lib/api/possible-values'
import { ProcessStepScreen } from './ProcessStepScreen'

/**
 * Field metadata.
 * @param name - Name.
 * @param label - Label.
 * @param extra - Overrides.
 * @returns The field.
 */
function field(name: string, label: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra }
}

const process: QProcessMetaData = {
  name: 'lab', label: 'Lab', tableName: '', isHidden: false, iconName: 'science', icon: { name: 'science' }, hasPermission: true, stepFlow: 'LINEAR',
  minInputRecords: 0, frontendSteps: [],
}
const end: QFrontendStepMetaData = { name: 'end', label: 'End', components: [] }

/**
 * Render one screen.
 * @param step - The screen.
 * @param values - Process values.
 * @param extra - More screen props.
 * @returns The submit callback.
 */
function renderStep(step: QFrontendStepMetaData, values: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ProcessStepScreen processName="lab" processMetaData={{ ...process, frontendSteps: [step, end] }}
        processUUID="run-1" step={step} steps={[step, end]} values={values} backStep={null} isWorking={false}
        onSubmit={onSubmit} onBack={vi.fn()} onCancel={onCancel} onReturn={vi.fn()} {...extra} />
    </QueryClientProvider>
  )
  return { onSubmit, onCancel }
}

/**
 * Instance metadata with widgets.
 * @param widgets - Widget metadata.
 * @returns The instance.
 */
function instanceWith(...widgets: QWidgetMetaData[]): QInstance {
  return { widgets: Object.fromEntries(widgets.map((widget) => [widget.name, widget])) } as unknown as QInstance
}

describe('process screens: fields and chrome (#725)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adds inputFieldList fields to a screen with an edit form, searching their source, and submits them', async () => {
    const user = userEvent.setup()
    const step: QFrontendStepMetaData = { name: 'input', label: 'Input', components: [{ type: 'EDIT_FORM' }], formFields: [field('note', 'Note')] }
    const { onSubmit } = renderStep(step, { inputFieldList: [field('minimumId', 'Minimum Id', { type: 'INTEGER', isRequired: true }), field('speciesId', 'Species', { type: 'INTEGER', possibleValueSourceName: 'petSpecies' })] })
    const form = screen.getByRole('form', { name: 'Input' })
    expect(form).toHaveAttribute('autocomplete', 'off')
    await user.click(within(form).getByRole('combobox', { name: /Species/ }))
    await user.click(await screen.findByRole('option', { name: 'Cat' }))
    expect(fetchPossibleValues).toHaveBeenCalledWith('petSpecies', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Minimum Id is required')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Minimum Id/), '4')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ minimumId: 4, speciesId: 2 }, undefined))
  })

  it('leaves out inputFieldList fields on a screen without an edit form', async () => {
    const user = userEvent.setup()
    const step: QFrontendStepMetaData = { name: 'show', label: 'Show', components: [{ type: 'HELP_TEXT', values: { text: 'Hello' } }] }
    const { onSubmit } = renderStep(step, { inputFieldList: [field('minimumId', 'Minimum Id', { type: 'INTEGER', isRequired: true })] })
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({}, undefined))
  })

  it('offers no Cancel in an embedded run', () => {
    renderStep({ name: 's', label: 'S', components: [] }, {}, { isEmbedded: true })
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })

  it('shows the process icon on the process summary header', () => {
    renderStep({ name: 'result', label: 'Result', components: [{ type: 'PROCESS_SUMMARY_RESULTS' }] }, { processResults: [] })
    const header = screen.getByRole('heading', { name: 'Process Summary' })
    expect(header.querySelector('[data-qqq-id="process-summary-icon"] svg[data-qqq-icon="science"]')).not.toBeNull()
  })

  it('lists bulk edit sections in a sidebar that jumps to each section', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const person = { name: 'person', label: 'Person', primaryKeyField: 'id', fields: {}, sections: [
      { name: 'identity', label: 'Identity', fieldNames: ['firstName'], isHidden: false },
      { name: 'work', label: 'Work', fieldNames: ['title'], isHidden: false },
    ] } as unknown as QTableMetaData
    renderStep({ name: 'edit', label: 'Edit', components: [{ type: 'BULK_EDIT_FORM' }], formFields: [field('firstName', 'First Name'), field('title', 'Title')] }, {}, { tableMetaData: person })
    const sidebar = screen.getByRole('navigation', { name: 'Sections' })
    expect(within(sidebar).getAllByRole('link').map((link) => link.textContent)).toEqual(['Identity', 'Work'])
    await user.click(within(sidebar).getByRole('link', { name: 'Work' }))
    expect(scrollIntoView).toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Work' })).toHaveFocus()
  })

  it('previews the associated child records of a table-layout preview', async () => {
    vi.mocked(loadTableMetaData).mockResolvedValue({ name: 'prcDog', label: 'Dog', primaryKeyField: 'id',
      fields: { name: field('name', 'Name'), breed: field('breed', 'Breed') },
      sections: [{ name: 'identity', label: 'Identity', tier: 'T1', fieldNames: ['name', 'breed'], isHidden: false }] } as unknown as QTableMetaData)
    const kennel = { name: 'prcKennel', label: 'Kennel', primaryKeyField: 'id', fields: { name: field('name', 'Name') }, sections: [
      { name: 'identity', label: 'Identity', fieldNames: ['name'], isHidden: false },
      { name: 'dogs', label: 'Dogs', fieldNames: [], widgetName: 'prcKennelDogs', isHidden: false },
    ] } as unknown as QTableMetaData
    const review: QFrontendStepMetaData = { name: 'review', label: 'Review', components: [{ type: 'VALIDATION_REVIEW_SCREEN' }], recordListFields: [field('name', 'Name')] }
    renderStep(review, {
      recordCount: 1, formatPreviewRecordUsingTableLayout: 'prcKennel', previewMessage: 'Preview',
      previewRecordAssociatedTableNames: ['prcDog'], previewRecordAssociatedWidgetNames: ['prcKennelDogs'], previewRecordAssociationNames: ['dogs'],
    }, { previewTableMetaData: kennel })
    const grid = await screen.findByRole('table', { name: 'Dogs' })
    const rows = within(grid).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))
    expect(rows).toEqual([['Rex', 'Collie'], ['Fido', 'Pug']])
  })
})

describe('process screens: blocks (#725)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders every block type through the shared renderer, with typed inputs and ->code actions', async () => {
    const user = userEvent.setup()
    const step: QFrontendStepMetaData = { name: 'scan', label: 'Scan', components: [{ type: 'WIDGET', values: { isAdHocWidget: true, blocks: [
      { blockTypeName: 'BIG_NUMBER', values: { heading: 'Picked', number: '42' } },
      { blockTypeName: 'PROGRESS_BAR', values: { heading: 'Done', percent: 50 } },
      { blockTypeName: 'INPUT_FIELD', values: { fieldMetaData: field('quantity', 'Quantity', { type: 'INTEGER' }), submitOnEnter: true } },
      { blockTypeName: 'INPUT_FIELD', values: { fieldMetaData: field('code', 'Code'), submitOnEnter: true } },
    ] } }] }
    const { onSubmit } = renderStep(step, { quantity: 7 })
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Done' })).toHaveAttribute('aria-valuenow', '50')
    const quantity = screen.getByLabelText('Quantity')
    expect(quantity).toHaveAttribute('type', 'number')
    expect(quantity).toHaveValue(7)
    await user.type(screen.getByLabelText('Code'), '->approve{Enter}')
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ quantity: 7, actionCode: 'approve' }, undefined))
  })

  it('opens, closes and toggles a modal-mode composite from button control codes', async () => {
    const user = userEvent.setup()
    const step: QFrontendStepMetaData = { name: 'pick', label: 'Pick', components: [{ type: 'WIDGET', values: { isAdHocWidget: true, blocks: [
      { blockTypeName: 'BUTTON', values: { label: 'Show details', controlCode: 'showModal:details' } },
      { blockTypeName: 'COMPOSITE', blockId: 'details', modalMode: 'modal', blocks: [
        { blockTypeName: 'TEXT', values: { text: 'Details for ${operator}' } },
        { blockTypeName: 'BUTTON', values: { label: 'Hide details', controlCode: 'hideModal:details' } },
        { blockTypeName: 'BUTTON', values: { label: 'Accept', actionCode: 'accept' } },
      ] },
    ] } }] }
    const { onSubmit } = renderStep(step, { operator: 'Casey' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Show details' }))
    const dialog = await screen.findByRole('dialog', { name: 'Details for Casey' })
    await user.click(within(dialog).getByRole('button', { name: 'Hide details' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Show details' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ actionCode: 'accept' }, undefined))
  })
})

describe('process screens: value-producing widgets (#725, #736)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('edits an in-process child record list in memory and posts the rows as frontendRecords', async () => {
    const user = userEvent.setup()
    const widget: QWidgetMetaData = { name: 'prcDogs', label: 'Dogs', type: 'childRecordList', hasPermission: true }
    const dogTable = { name: 'prcDog', label: 'Dog', primaryKeyField: 'id', fields: { id: field('id', 'Id', { type: 'INTEGER', isEditable: false }), name: field('name', 'Name', { isRequired: true }), kennelId: field('kennelId', 'Kennel Id', { type: 'INTEGER' }) },
      sections: [{ name: 'identity', label: 'Identity', tier: 'T1', fieldNames: ['id', 'name', 'kennelId'] }] }
    const seeded = { type: 'childRecordList', isInProcess: true, canAddChildRecord: true, allowRecordEdit: true, allowRecordDelete: true,
      defaultValuesForNewChildRecords: { kennelId: 5 }, childFrontendTableMetaData: dogTable,
      queryOutput: { records: [{ values: { id: 1, name: 'Rex', kennelId: 5 } }, { values: { id: 2, name: 'Fido', kennelId: 5 } }] } }
    const { onSubmit } = renderStep({ name: 'dogs', label: 'Dogs', components: [{ type: 'WIDGET', values: { widgetName: 'prcDogs' } }] }, { prcDogs: seeded }, { instance: instanceWith(widget) })
    await user.click(screen.getByRole('button', { name: 'Delete Dog row 2' }))
    await user.click(screen.getByRole('button', { name: 'Edit Dog row 1' }))
    let dialog = await screen.findByRole('dialog', { name: 'Editing Dog' })
    await user.clear(within(dialog).getByLabelText(/Name/))
    await user.type(within(dialog).getByLabelText(/Name/), 'Rex II')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Add new Dog' }))
    dialog = await screen.findByRole('dialog', { name: 'Creating New Dog' })
    expect(within(dialog).getByLabelText(/Kennel Id/)).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Name/), 'Spot')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const posted = JSON.parse(String(onSubmit.mock.calls[0][0].frontendRecords)) as Array<{ values: Record<string, unknown> }>
    expect(posted.map((record) => [record.values.id, record.values.name, record.values.kennelId])).toEqual([[1, 'Rex II', 5], [undefined, 'Spot', 5]])
    expect(fetchWidgetData).not.toHaveBeenCalled()
  })

  it('writes an editable row builder to its output value, validating its rows with the screen', async () => {
    const user = userEvent.setup()
    const widget: QWidgetMetaData = { name: 'prcLines', label: 'Lines', type: 'rowBuilder', hasPermission: true,
      defaultValues: { isEditable: true, outputFieldName: 'linesJson', fields: [field('item', 'Item', { isRequired: true }), field('quantity', 'Quantity', { type: 'INTEGER' })] } }
    vi.mocked(fetchWidgetData).mockResolvedValue({ type: 'rowBuilder', records: [{ values: { item: 'Bolt', quantity: 2 } }], defaultValuesForNewRecords: { quantity: 1 } })
    const { onSubmit } = renderStep({ name: 'lines', label: 'Lines', components: [{ type: 'WIDGET', values: { widgetName: 'prcLines' } }] }, {}, { instance: instanceWith(widget) })

    expect(await screen.findByDisplayValue('Bolt')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add new' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Item is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    const items = screen.getAllByLabelText(/Item/)
    await user.type(items[1], 'Nut')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(JSON.parse(String(onSubmit.mock.calls[0][0].linesJson))).toEqual([
      { item: 'Bolt', quantity: 2, _qRowIndex: 0 }, { item: 'Nut', quantity: 1, _qRowIndex: 1 },
    ])
  })

  it('edits an editable dynamic form widget in the screen form: labels, search, required and submission (#736)', async () => {
    const user = userEvent.setup()
    const widget: QWidgetMetaData = { name: 'renderReportProcessValuesWidget', label: '', type: 'dynamicForm', hasPermission: true, isCard: false, defaultValues: { isEditable: true } }
    vi.mocked(fetchWidgetData).mockResolvedValue({ type: 'dynamicForm', mergedDynamicFormValuesIntoFieldName: 'inputValues',
      fieldList: [field('minimumId', 'Minimum Id', { type: 'INTEGER', isRequired: true }), field('species', 'Species', { type: 'INTEGER', isRequired: true, possibleValueSourceName: 'petSpecies' })],
      recordOfFieldValues: { values: {} } })
    const step: QFrontendStepMetaData = { name: 'input', label: 'Input', components: [{ type: 'EDIT_FORM' }, { type: 'WIDGET', values: { widgetName: 'renderReportProcessValuesWidget' } }], formFields: [field('reportFormat', 'Report Format')] }
    const { onSubmit } = renderStep(step, { savedReportId: 7 }, { instance: instanceWith(widget) })
    expect(await screen.findByLabelText(/Minimum Id/)).toBeInTheDocument()
    expect(fetchWidgetData).toHaveBeenCalledWith('renderReportProcessValuesWidget', { savedReportId: '7', processUUID: 'run-1' })
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Minimum Id is required')).toBeInTheDocument()
    expect(screen.getByText('Species is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/Minimum Id/), '3')
    await user.click(screen.getByRole('combobox', { name: /Species/ }))
    await user.click(await screen.findByRole('option', { name: 'Dog' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ minimumId: 3, species: 1 }, undefined))
  })

  it('keeps a dynamic form widget read-only on a process screen unless its metadata makes it editable', async () => {
    const widget: QWidgetMetaData = { name: 'accValues', label: 'Values', type: 'dynamicForm', hasPermission: true }
    vi.mocked(fetchWidgetData).mockResolvedValue({ type: 'dynamicForm', fieldList: [field('region', 'Region')], recordOfFieldValues: { values: { region: 'North' } } })
    renderStep({ name: 'view', label: 'View', components: [{ type: 'WIDGET', values: { widgetName: 'accValues' } }] }, {}, { instance: instanceWith(widget) })
    expect(await screen.findByText('North')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Region/ })).toBeNull()
  })
})
