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

// Form adjusters, field rules and editable widget sections of the record form (QRun-IO/qqq#720, #722)

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { QFieldMetaData, QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import apiClient from '@/lib/api/client'
import { queryKeys } from '@/lib/query-client'
import { EntityForm } from './EntityForm'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))
vi.mock('@/lib/api/form-adjuster', () => ({ runFormAdjuster: vi.fn() }))
vi.mock('@/lib/api/widgets', () => ({ fetchWidgetData: vi.fn() }))
vi.mock('@/lib/api/possible-values', () => ({
  fetchTablePossibleValues: vi.fn(async (_table: string, field: string) => field === 'kind'
    ? [{ id: 'A', label: 'Alpha' }, { id: 'B', label: 'Beta' }]
    : [{ id: 7, label: 'Seven' }]),
  fetchProcessPossibleValues: vi.fn(async () => []),
  fetchPossibleValues: vi.fn(async () => []),
}))

import { runFormAdjuster } from '@/lib/api/form-adjuster'
import { fetchWidgetData } from '@/lib/api/widgets'

const adjuster = vi.mocked(runFormAdjuster)
const widgetData = vi.mocked(fetchWidgetData)

function field(name: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label: name[0].toUpperCase() + name.slice(1), type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra }
}

function lab(extra: Partial<QTableMetaData> = {}, fields: Record<string, QFieldMetaData> = {}): QTableMetaData {
  return {
    name: 'lab', label: 'Lab', isHidden: false, primaryKeyField: 'id',
    fields: {
      id: field('id', { type: 'INTEGER', isEditable: false }),
      title: field('title'),
      kind: field('kind', { possibleValueSourceName: 'kinds' }),
      code: field('code'),
      note: field('note'),
      ...fields,
    },
    sections: [{ name: 'main', label: 'Main', isHidden: false, fieldNames: ['id', 'title', 'kind', 'code', 'note'] }],
    capabilities: [], exposedJoins: [], readPermission: true, insertPermission: true, editPermission: true, deletePermission: true,
    usesVariants: false, variantTableLabel: '',
    ...extra,
  }
}

const stored: QRecord = { tableName: 'lab', values: { id: 3, title: 'Old', kind: 'A', code: 'C-1', note: 'n' }, displayValues: { kind: 'Alpha' } }

function renderForm(table: QTableMetaData, props: Partial<React.ComponentProps<typeof EntityForm>> = {}, client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })) {
  return render(<QueryClientProvider client={client}><EntityForm tableMetaData={table} {...props} /></QueryClientProvider>)
}

const MD = 'materialDashboard'

describe('table on-load form adjuster', () => {
  beforeEach(() => { vi.restoreAllMocks(); adjuster.mockReset(); widgetData.mockReset() })

  it('runs before the form renders and applies values, labels, field and section changes', async () => {
    adjuster.mockResolvedValue({
      updatedFieldValues: { title: 'From adjuster', kind: 'B' },
      updatedFieldDisplayValues: { kind: 'Beta' },
      fieldsToClear: ['code'],
      updatedFieldMetaData: { note: { ...field('note'), label: 'Remarks', isRequired: true } },
      updatedSectionMetaData: { main: { name: 'main', label: 'Adjusted main', isHidden: false, fieldNames: ['title', 'kind', 'code', 'note'] } },
    })
    const table = lab({ supplementalMetaData: { [MD]: { onLoadFormAdjuster: { name: 'OnLoad' } } } })
    renderForm(table, { record: stored })
    expect(screen.getByRole('status')).toHaveTextContent('Loading form...')
    expect(await screen.findByRole('heading', { name: 'Adjusted main' })).toBeVisible()
    expect(adjuster).toHaveBeenCalledWith('table:lab', 'onLoad', { allValues: expect.objectContaining({ id: 3, title: 'Old', kind: 'A' }) })
    expect(screen.getByLabelText(/^Title/)).toHaveValue('From adjuster')
    expect(screen.getByRole('combobox', { name: 'Kind' })).toHaveTextContent('Beta')
    expect(screen.getByLabelText(/^Code/)).toHaveValue('')
    expect(screen.getByLabelText(/^Remarks/)).toHaveAttribute('aria-required', 'true')
    expect(screen.queryByLabelText(/^Id/)).toBeNull()
  })

  it('locks the form with the adjuster\'s message: read-only fields, Save disabled with the reason, no way to close the alert', async () => {
    adjuster.mockResolvedValue({ isFormDisabled: true })
    const put = vi.spyOn(apiClient, 'patch')
    renderForm(lab({ supplementalMetaData: { [MD]: { onLoadFormAdjuster: {} } } }), { record: stored })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('You are not allowed to edit this record.')
    expect(within(alert).queryByRole('button')).toBeNull()
    expect(screen.getByLabelText(/^Title/)).toBeDisabled()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.focus(save.parentElement!)
    expect(screen.getByRole('tooltip')).toHaveTextContent('You are not allowed to edit this record.')
    fireEvent.submit(save.closest('form')!)
    expect(put).not.toHaveBeenCalled()
  })

  it('uses the create wording and the adjuster\'s own message', async () => {
    adjuster.mockResolvedValueOnce({ isFormDisabled: true })
    const { unmount } = renderForm(lab({ supplementalMetaData: { [MD]: { onLoadFormAdjuster: {} } } }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You are not allowed to create a new record.')
    unmount()
    adjuster.mockResolvedValueOnce({ isFormDisabled: true, formDisabledMessage: 'Closed for the season' })
    renderForm(lab({ supplementalMetaData: { [MD]: { onLoadFormAdjuster: {} } } }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Closed for the season')
  })

  it('shows the failure instead of a form when the adjuster fails', async () => {
    adjuster.mockRejectedValue(new Error('Adjuster exploded'))
    renderForm(lab({ supplementalMetaData: { [MD]: { onLoadFormAdjuster: {} } } }))
    expect(await screen.findByText(/The form could not be prepared: Adjuster exploded/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })
})

describe('field form adjusters', () => {
  beforeEach(() => { vi.restoreAllMocks(); adjuster.mockReset(); widgetData.mockReset() })

  const adjusted = (settings: Record<string, unknown>) => ({ supplementalMetaData: { [MD]: { formAdjusterIdentifier: 'lab:field', ...settings } } })

  it('runs a text field\'s on-change adjuster on blur and a possible value\'s on change, with every value', async () => {
    const user = userEvent.setup()
    let release: () => void = () => {}
    adjuster.mockImplementation(async (_id, _event, input) => {
      if (input.fieldName === 'kind') await new Promise<void>((resolve) => { release = resolve })
      return input.fieldName === 'title' ? { updatedFieldValues: { code: `T-${String(input.newValue)}` } } : { fieldsToClear: ['note'] }
    })
    renderForm(lab({}, {
      title: field('title', adjusted({ onChangeFormAdjuster: {} })),
      kind: field('kind', { possibleValueSourceName: 'kinds', ...adjusted({ onChangeFormAdjuster: {}, fieldsToDisableWhileRunningAdjusters: ['note'] }) }),
    }), { record: stored })

    const title = screen.getByLabelText(/^Title/)
    await user.clear(title)
    await user.type(title, 'New')
    expect(adjuster).not.toHaveBeenCalled()
    await user.tab()
    await waitFor(() => expect(screen.getByLabelText(/^Code/)).toHaveValue('T-New'))
    expect(adjuster).toHaveBeenCalledWith('lab:field', 'onChange', { fieldName: 'title', newValue: 'New', allValues: expect.objectContaining({ title: 'New', kind: 'A' }) })

    await user.click(screen.getByRole('combobox', { name: 'Kind' }))
    await user.click(await screen.findByRole('option', { name: 'Beta' }))
    // the note is read-only while the kind's adjuster runs, then cleared by it
    await waitFor(() => expect(screen.getByLabelText(/^Note/)).toBeDisabled())
    release()
    await waitFor(() => expect(screen.getByLabelText(/^Note/)).toBeEnabled())
    expect(screen.getByLabelText(/^Note/)).toHaveValue('')
    expect(adjuster).toHaveBeenLastCalledWith('lab:field', 'onChange', expect.objectContaining({ fieldName: 'kind', newValue: 'B' }))
  })

  it('runs field on-load adjusters when the form mounts and applies new field definitions', async () => {
    adjuster.mockResolvedValue({ updatedFieldMetaData: { note: { ...field('note'), isHidden: true } }, updatedFieldValues: { title: 'Loaded' } })
    renderForm(lab({}, { code: field('code', adjusted({ onLoadFormAdjuster: {} })) }), { record: stored })
    await waitFor(() => expect(screen.getByLabelText(/^Title/)).toHaveValue('Loaded'))
    expect(adjuster).toHaveBeenCalledWith('lab:field', 'onLoad', expect.objectContaining({ fieldName: 'code', newValue: 'C-1' }))
    expect(screen.queryByLabelText(/^Note/)).toBeNull()
  })
})

describe('field rules', () => {
  beforeEach(() => { vi.restoreAllMocks(); adjuster.mockReset(); widgetData.mockReset() })

  it('clears target fields when the source field changes, and the save sends the cleared values', async () => {
    const user = userEvent.setup()
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({ record: { tableName: 'lab', values: { id: 3 } } })
    const table = lab({ supplementalMetaData: { [MD]: { fieldRules: [
      { trigger: 'ON_CHANGE', sourceField: 'kind', action: 'CLEAR_TARGET_FIELD', targetField: 'code' },
      { trigger: 'ON_CHANGE', sourceField: 'kind', action: 'CLEAR_TARGET_FIELD', targetField: 'hiddenJson' },
    ] } } }, { hiddenJson: field('hiddenJson', { isHidden: true, type: 'TEXT' }) })
    renderForm(table, { record: { ...stored, values: { ...stored.values, hiddenJson: '{"a":1}' } } })
    await user.type(screen.getByLabelText(/^Note/), '!')
    expect(screen.getByLabelText(/^Code/)).toHaveValue('C-1')
    await user.click(screen.getByRole('combobox', { name: 'Kind' }))
    await user.click(await screen.findByRole('option', { name: 'Beta' }))
    expect(screen.getByLabelText(/^Code/)).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    const body = patch.mock.calls[0][1] as FormData
    expect(body.get('kind')).toBe('B')
    expect(body.get('code')).toBe('')
    expect(body.get('hiddenJson')).toBe('')
  })

  it('reloads a widget section with the source field\'s new value', async () => {
    const user = userEvent.setup()
    widgetData.mockImplementation(async (_name, params) => ({ type: 'html', html: `<p>Kind ${String(params?.kind ?? 'none')}</p>` }))
    const widgets = { kindWidget: { name: 'kindWidget', label: 'Kind Summary', type: 'html', hasPermission: true, defaultValues: { includeOnRecordEditScreen: true } } } as unknown as Record<string, QWidgetMetaData>
    const table = lab({
      supplementalMetaData: { [MD]: { fieldRules: [{ trigger: 'ON_CHANGE', sourceField: 'kind', action: 'RELOAD_WIDGET', targetWidget: 'kindWidget' }] } },
      sections: [
        { name: 'main', label: 'Main', isHidden: false, fieldNames: ['title', 'kind'] },
        { name: 'summary', label: 'Summary', isHidden: false, fieldNames: [], widgetName: 'kindWidget' },
      ],
    })
    renderForm(table, { record: stored, widgets })
    expect(await screen.findByText('Kind none')).toBeVisible()
    expect(widgetData).toHaveBeenLastCalledWith('kindWidget', { id: '3' })
    await user.click(screen.getByRole('combobox', { name: 'Kind' }))
    await user.click(await screen.findByRole('option', { name: 'Beta' }))
    expect(await screen.findByText('Kind B')).toBeVisible()
    expect(widgetData).toHaveBeenLastCalledWith('kindWidget', { id: '3', kind: 'B' })
  })
})

describe('child record lists that manage an association', () => {
  beforeEach(() => { vi.restoreAllMocks(); adjuster.mockReset(); widgetData.mockReset() })

  const child: QTableMetaData = {
    name: 'labLine', label: 'Lab Line', isHidden: false, primaryKeyField: 'id',
    fields: { id: field('id', { type: 'INTEGER', isEditable: false }), labId: field('labId', { type: 'INTEGER' }), sku: field('sku', { label: 'SKU', isRequired: true }), qty: field('qty', { label: 'Qty', type: 'INTEGER' }) },
    sections: [{ name: 'main', label: 'Main', isHidden: false, fieldNames: ['id', 'labId', 'sku', 'qty'] }],
    capabilities: [], exposedJoins: [], readPermission: true, insertPermission: true, editPermission: true, deletePermission: true,
    usesVariants: false, variantTableLabel: '',
  }
  const widgets = { lines: { name: 'lines', label: 'Lines', type: 'childRecordList', hasPermission: true, defaultValues: { manageAssociationName: 'labLines' } } } as unknown as Record<string, QWidgetMetaData>
  const parent = lab({ sections: [
    { name: 'main', label: 'Main', isHidden: false, fieldNames: ['title'] },
    { name: 'linesSection', label: 'Lines', isHidden: false, fieldNames: [], widgetName: 'lines' },
  ] })

  function client() {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    queryClient.setQueryData(queryKeys.tableMetadata('labLine'), child)
    return queryClient
  }

  it('adds, edits and deletes child rows in a dialog and saves them with the parent as the association', async () => {
    const user = userEvent.setup()
    widgetData.mockResolvedValue({
      type: 'childRecordList', canAddChildRecord: true, childTableMetaData: { name: 'labLine', label: 'Lab Line' },
      defaultValuesForNewChildRecords: { labId: 3 },
      queryOutput: { records: [
        { tableName: 'labLine', values: { id: 11, labId: 3, sku: 'A-1', qty: 1 }, displayValues: {} },
        { tableName: 'labLine', values: { id: 12, labId: 3, sku: 'B-2', qty: 2 }, displayValues: {} },
      ] },
    })
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({ record: { tableName: 'lab', values: { id: 3 } } })
    renderForm(parent, { record: stored, widgets }, client())
    const table = await screen.findByRole('table', { name: 'Lines' })
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Actions', 'Id', 'SKU', 'Qty'])
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    // edit row 1 in the dialog
    await user.click(screen.getByRole('button', { name: 'Edit Lab Line row 1' }))
    const editDialog = await screen.findByRole('dialog', { name: 'Editing Lab Line' })
    const qty = within(editDialog).getByLabelText(/^Qty/)
    expect(qty).toHaveValue(1)
    await user.clear(qty)
    await user.type(qty, '5')
    await user.click(within(editDialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(table).getByText('5')).toBeVisible()

    // add a new row: the parent key is preset and locked
    await user.click(screen.getByRole('button', { name: 'Add new' }))
    const addDialog = await screen.findByRole('dialog', { name: 'Creating New Lab Line' })
    expect(within(addDialog).getByLabelText(/^LabId/)).toBeDisabled()
    await user.click(within(addDialog).getByRole('button', { name: 'OK' }))
    expect(await within(addDialog).findByText('SKU is required')).toBeVisible()
    await user.type(within(addDialog).getByLabelText(/^SKU/), 'C-3')
    await user.click(within(addDialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // delete row 2 (B-2)
    await user.click(screen.getByRole('button', { name: 'Delete Lab Line row 2' }))
    expect(within(table).queryByText('B-2')).toBeNull()

    expect(patch).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    const [, body, config] = patch.mock.calls[0]
    expect(config?.headers).toMatchObject({ 'X-QQQ-Association-Format': 'record-v1' })
    expect(JSON.parse(String((body as FormData).get('associations')))).toEqual({ labLines: [
      { values: { id: 11, labId: 3, sku: 'A-1', qty: 5 } },
      { values: { labId: 3, sku: 'C-3' } },
    ] })
  })

  it('cancel in the child dialog keeps the rows and posts nothing', async () => {
    const user = userEvent.setup()
    widgetData.mockResolvedValue({ type: 'childRecordList', canAddChildRecord: true, childTableMetaData: { name: 'labLine', label: 'Lab Line' }, queryOutput: { records: [] } })
    renderForm(parent, { widgets }, client())
    expect(await screen.findByText('No rows')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Add new' }))
    const dialog = await screen.findByRole('dialog', { name: 'Creating New Lab Line' })
    await user.type(within(dialog).getByLabelText(/^SKU/), 'X')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    // the child form asks before discarding its typed value
    await user.click(await screen.findByRole('button', { name: /Leave|Discard/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Creating New Lab Line' })).toBeNull())
    expect(screen.getByText('No rows')).toBeVisible()
  })

  it('inserts a new parent with its new children as the association', async () => {
    const user = userEvent.setup()
    widgetData.mockResolvedValue({ type: 'childRecordList', canAddChildRecord: true, childTableMetaData: { name: 'labLine', label: 'Lab Line' }, queryOutput: { records: [] } })
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ record: { tableName: 'lab', values: { id: 9 } } })
    renderForm(parent, { widgets }, client())
    await user.type(screen.getByLabelText(/^Title/), 'Parent')
    await user.click(await screen.findByRole('button', { name: 'Add new' }))
    const dialog = await screen.findByRole('dialog', { name: 'Creating New Lab Line' })
    await user.type(within(dialog).getByLabelText(/^SKU/), 'N-1')
    await user.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String((post.mock.calls[0][1] as FormData).get('associations')))).toEqual({ labLines: [{ values: { sku: 'N-1' } }] })
  })
})

describe('widget validators', () => {
  beforeEach(() => { vi.restoreAllMocks(); adjuster.mockReset(); widgetData.mockReset() })

  it('hands a valid submission to onSubmitValues instead of saving', async () => {
    const user = userEvent.setup()
    const post = vi.spyOn(apiClient, 'post')
    const onSubmitValues = vi.fn()
    renderForm(lab(), { onSubmitValues, defaultValues: { id: 4 } })
    await user.type(screen.getByLabelText(/^Title/), 'Kept')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSubmitValues).toHaveBeenCalledTimes(1))
    expect(onSubmitValues.mock.calls[0][0]).toMatchObject({ id: 4, title: 'Kept' })
    expect(post).not.toHaveBeenCalled()
  })
})
