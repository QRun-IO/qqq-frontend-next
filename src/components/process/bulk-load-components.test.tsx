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

// Tests for the bulk load mapping screens: saved profiles, mapping form fidelity and value mapping (#726)

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QFieldMetaData, QFrontendStepMetaData, QInstance, QProcessMetaData } from '@/types'
import { QContext, type QContextType } from '@/lib/context/q-context'

vi.mock('@/lib/api/processes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/processes')>()),
  querySavedBulkLoadProfiles: vi.fn(),
  storeSavedBulkLoadProfile: vi.fn(),
  deleteSavedBulkLoadProfile: vi.fn(),
}))
vi.mock('@/lib/api/possible-values', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/possible-values')>()),
  fetchProcessPossibleValues: vi.fn().mockResolvedValue([{ id: 'id', label: 'Id' }, { id: 'email', label: 'Email' }]),
  fetchTablePossibleValues: vi.fn().mockResolvedValue([{ id: 1, label: 'Dog' }, { id: 2, label: 'Cat' }]),
}))

import { deleteSavedBulkLoadProfile, querySavedBulkLoadProfiles, storeSavedBulkLoadProfile } from '@/lib/api/processes'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { ProcessStepScreen } from './ProcessStepScreen'
import type { BulkLoadProfile, BulkLoadTableStructure } from './bulk-load-models'

/**
 * Minimal field metadata.
 * @param name - Field name.
 * @param label - Label.
 * @param extra - More metadata.
 * @returns The field.
 */
function field(name: string, label: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra }
}

const person: BulkLoadTableStructure = {
  isMain: true, isMany: false, tableName: 'person', label: 'Person', associationPath: null,
  fields: [field('firstName', 'First Name', { isRequired: true }), field('email', 'Email', { isRequired: true }), field('isEmployed', 'Is Employed', { type: 'BOOLEAN' }),
    field('birthDate', 'Birth Date', { type: 'DATE' }), field('speciesId', 'Species', { type: 'INTEGER', possibleValueSourceName: 'petSpecies' })],
  associations: null, isBulkEdit: false, possibleKeyFields: ['id'],
}
const suggested: BulkLoadProfile = {
  version: 'v1', hasHeaderRow: true, layout: 'FLAT', isBulkEdit: false, keyFields: null,
  fieldList: [{ fieldName: 'firstName', columnIndex: 0, headerName: 'First Name' }, { fieldName: 'email', columnIndex: 1, headerName: 'Email' }],
}
const fileValues = {
  headerValues: ['First Name', 'Email', 'Email'], headerLetters: ['A', 'B', 'C'],
  bodyValuesPreview: [['Quinn', 'Riley'], ['quinn@example.invalid', 'riley@example.invalid'], ['x@example.invalid', 'y@example.invalid']],
  fileBaseName: 'people.csv',
}
const mappingStep: QFrontendStepMetaData = {
  name: 'fileMapping', label: 'File Mapping', components: [{ type: 'BULK_LOAD_FILE_MAPPING_FORM' }],
  formFields: [
    field('hasHeaderRow', 'Has Header Row', { type: 'BOOLEAN', helpContents: [{ content: 'Uncheck when the first row is data.', roles: ['PROCESS_SCREEN'] }] }),
    field('layout', 'Layout'),
    field('tableKeyFields', 'Table Key Fields', { possibleValueSourceName: 'tableKeyFields', helpContents: [{ content: 'Keys find the records.', roles: ['ALL_SCREENS'] }] }),
  ],
}
const process: QProcessMetaData = {
  name: 'person.bulkInsert', label: 'Person Bulk Insert', tableName: 'person', isHidden: true, iconName: '', hasPermission: true, stepFlow: 'LINEAR', minInputRecords: 0,
  frontendSteps: [],
}
const instance = { processes: { storeSavedBulkLoadProfile: {}, querySavedBulkLoadProfile: {}, deleteSavedBulkLoadProfile: {} } } as unknown as QInstance
const mine = { id: 1, label: 'Lab People CSV', tableName: 'person', userId: 'sample:alice', isBulkEdit: false, mappingJson: JSON.stringify(suggested) }
const bobs = { id: 2, label: 'Bob Shared CSV', tableName: 'person', userId: 'sample:bob', isBulkEdit: false, mappingJson: JSON.stringify({ ...suggested, fieldList: [...suggested.fieldList, { fieldName: 'isEmployed', defaultValue: true }] }) }

/**
 * Render one bulk load screen.
 * @param step - The screen.
 * @param values - Process values.
 * @returns The submit callback.
 */
function renderScreen(step: QFrontendStepMetaData, values: Record<string, unknown>) {
  const onSubmit = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = { userId: 'sample:alice' } as QContextType
  render(
    <QueryClientProvider client={client}>
      <QContext.Provider value={context}>
        <ProcessStepScreen processName={process.name} processMetaData={{ ...process, frontendSteps: [step] }} processUUID="run-1" step={step}
          steps={[{ name: 'upload', label: 'Upload', components: [] }, step, { name: 'review', label: 'Review', components: [] }]} values={values} backStep="upload" isWorking={false}
          instance={instance} onSubmit={onSubmit} onBack={vi.fn()} onCancel={vi.fn()} onReturn={vi.fn()} />
      </QContext.Provider>
    </QueryClientProvider>
  )
  return onSubmit
}

const baseValues = { ...fileValues, tableStructure: person, suggestedBulkLoadProfile: suggested }

describe('saved bulk load profiles (#726)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(querySavedBulkLoadProfiles).mockResolvedValue([mine, bobs])
  })

  it('supports keyboard selection and restores focus after profile editors close', async () => {
    const user = userEvent.setup()
    renderScreen(mappingStep, baseValues)
    const trigger = screen.getByRole('button', { name: 'Saved Bulk Load Profiles' })
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    const menu = screen.getByRole('menu', { name: 'Saved bulk load profiles' })
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Save As...' })).toHaveFocus())
    await user.keyboard('{Enter}')
    expect(screen.getByRole('group', { name: 'Save New Bulk Load Profile' })).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())

    const saveNew = screen.getByRole('button', { name: 'Save Bulk Load Profile As…' })
    // WebKit clicks can activate a button without focusing it first.
    fireEvent.click(saveNew)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(saveNew).toHaveFocus())
  })

  it('lists your profiles and those shared with you, and only the owner may save, rename or delete', async () => {
    const user = userEvent.setup()
    renderScreen(mappingStep, baseValues)
    const profiles = screen.getByRole('region', { name: 'Saved Bulk Load Profiles' })
    expect(profiles).toHaveTextContent('You are not using a saved bulk load profile.')
    await user.click(within(profiles).getByRole('button', { name: 'Saved Bulk Load Profiles' }))
    const menu = screen.getByRole('menu', { name: 'Saved bulk load profiles' })
    const yours = within(menu).getByRole('group', { name: 'Your Saved Bulk Load Profiles' })
    const shared = within(menu).getByRole('group', { name: 'Bulk Load Profiles Shared with you' })
    expect(await within(yours).findByRole('menuitem', { name: 'Lab People CSV' })).toBeInTheDocument()
    expect(within(shared).getByRole('menuitem', { name: 'Bob Shared CSV' })).toBeInTheDocument()
    await user.click(within(shared).getByRole('menuitem', { name: 'Bob Shared CSV' }))
    expect(screen.getByRole('heading', { name: 'File Mapping / Bob Shared CSV' })).toBeInTheDocument()
    expect(profiles).toHaveTextContent('You are using the bulk load profile: Bob Shared CSV')
    expect(screen.getByLabelText('Default value for Is Employed')).toHaveValue('true')
    await user.click(screen.getByRole('button', { name: 'Saved Bulk Load Profiles' }))
    for (const item of ['Save...', 'Rename...', 'Delete...']) {
      expect(screen.getByRole('menuitem', { name: item })).toBeDisabled()
      expect(screen.getByRole('menuitem', { name: item })).toHaveAttribute('title', 'You may not save changes to this bulk load profile, because you are not its owner.')
    }
    expect(screen.getByRole('menuitem', { name: 'Save As...' })).toBeEnabled()
  })

  it('counts unsaved changes with their list, resets them, and saves an update after the confirm', async () => {
    const user = userEvent.setup()
    vi.mocked(storeSavedBulkLoadProfile).mockResolvedValue(mine)
    renderScreen(mappingStep, { ...baseValues, savedBulkLoadProfileRecord: { values: mine } })
    expect(screen.queryByText(/Unsaved Change/)).toBeNull()
    await user.selectOptions(screen.getByLabelText('Column for First Name'), '')
    expect(screen.getByText('1 Unsaved Change')).toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="saved-bulk-load-profile-changes"]')).toHaveTextContent('Unsaved ChangesChanged First Name file column from (First Name) to --')
    await user.click(screen.getByRole('button', { name: 'Reset All Changes' }))
    expect(screen.getByLabelText('Column for First Name')).toHaveValue('0')
    expect(screen.queryByText(/Unsaved Change/)).toBeNull()

    await user.selectOptions(screen.getByLabelText('Column for Email'), '')
    await user.click(screen.getByRole('button', { name: 'Save…' }))
    const dialog = screen.getByRole('dialog', { name: 'Update Existing Bulk Load Profile' })
    expect(dialog).toHaveTextContent("Are you sure you want to update the bulk load profile 'Lab People CSV'?")
    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(storeSavedBulkLoadProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 1, label: 'Lab People CSV', tableName: 'person', isBulkEdit: false })))
    expect(await screen.findByText('Profile Saved.')).toBeInTheDocument()
  })

  it('names a new profile with Enter, renames, and deletes only with the button', async () => {
    const user = userEvent.setup()
    vi.mocked(storeSavedBulkLoadProfile).mockResolvedValueOnce({ ...mine, id: 7, label: 'Typed Name' }).mockResolvedValueOnce({ ...mine, id: 7, label: 'Renamed' })
    vi.mocked(deleteSavedBulkLoadProfile).mockResolvedValue()
    const onSubmit = renderScreen(mappingStep, baseValues)
    await user.click(screen.getByRole('button', { name: 'Save Bulk Load Profile As…' }))
    const editor = screen.getByRole('group', { name: 'Save New Bulk Load Profile' })
    expect(screen.getByRole('region', { name: 'Saved Bulk Load Profiles' })).toContainElement(editor)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(editor).getByLabelText('Profile Name')).toHaveFocus()
    expect(within(editor).getByRole('button', { name: 'Save Profile' })).toBeDisabled()
    await user.type(screen.getByPlaceholderText('Bulk Load Profile Name'), 'Typed Name{Enter}')
    await waitFor(() => expect(storeSavedBulkLoadProfile).toHaveBeenCalledWith(expect.objectContaining({ id: undefined, label: 'Typed Name' })))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'File Mapping / Typed Name' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved Bulk Load Profiles' })).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Saved Bulk Load Profiles' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename...' }))
    const name = screen.getByPlaceholderText('Bulk Load Profile Name')
    expect(name).toHaveValue('Typed Name')
    await user.clear(name)
    await user.type(name, 'Renamed{Enter}')
    await waitFor(() => expect(storeSavedBulkLoadProfile).toHaveBeenLastCalledWith(expect.objectContaining({ id: 7, label: 'Renamed' })))

    await user.click(screen.getByRole('button', { name: 'Saved Bulk Load Profiles' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete...' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete Bulk Load Profile' })
    expect(dialog).toHaveTextContent("Are you sure you want to delete the bulk load profile 'Renamed'?")
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(deleteSavedBulkLoadProfile).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Saved Bulk Load Profiles' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete...' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Delete Bulk Load Profile' })).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteSavedBulkLoadProfile).toHaveBeenCalledWith(7))
    expect(await screen.findByText('Profile Deleted.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'File Mapping' })).toBeInTheDocument()
  })

  it('resets to an empty or the suggested mapping', async () => {
    const user = userEvent.setup()
    renderScreen(mappingStep, baseValues)
    expect(screen.getByLabelText('Column for Email')).toHaveValue('1')
    await user.click(screen.getByRole('button', { name: 'Empty Mapping' }))
    expect(screen.getByLabelText('Column for Email')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Suggested Mapping' }))
    expect(screen.getByLabelText('Column for Email')).toHaveValue('1')
  })
})

describe('bulk load file mapping fidelity (#726)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(querySavedBulkLoadProfiles).mockResolvedValue([])
  })

  it('warns about a repeated header, names mapped fields per column and clears a repeated-header mapping when headers are turned on', async () => {
    const user = userEvent.setup()
    renderScreen(mappingStep, baseValues)
    expect(screen.getByText('Uncheck when the first row is data.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Does the file have a header row? *' })).toHaveAccessibleDescription('Uncheck when the first row is data.')
    expect(screen.getAllByRole('tooltip', { hidden: true }).map((tip) => tip.textContent)).toEqual([
      'This column is mapped to the field:First Name',
      'This column is mapped to the field:Email',
      'This column header is a duplicate. Only the first occurrence of it will be used.',
    ])
    expect(within(screen.getByLabelText('Column for Email')).getAllByRole('option').map((option) => option.textContent)).toEqual(['Select a column', 'First Name', 'Email'])
    await user.click(screen.getByRole('checkbox', { name: 'Does the file have a header row? *' }))
    await user.selectOptions(screen.getByLabelText('Column for Email'), 'Column C')
    await user.click(screen.getByRole('checkbox', { name: 'Does the file have a header row? *' }))
    expect(screen.getByLabelText('Column for Email')).toHaveValue('')
    expect(screen.getByText('This field was assigned to a column with a duplicated header')).toBeInTheDocument()
  })

  it('offers typed default values: dates, yes/no and searchable possible values', async () => {
    const user = userEvent.setup()
    renderScreen(mappingStep, baseValues)
    await user.click(screen.getByRole('button', { name: 'Add Fields' }))
    const search = screen.getByRole('combobox', { name: 'Search fields' })
    await user.type(search, 'birth')
    expect(within(screen.getByRole('listbox', { name: 'Fields to add' })).getAllByRole('option').map((option) => option.textContent)).toEqual(['Birth Date'])
    await user.click(screen.getByRole('option', { name: 'Birth Date' }))
    expect(screen.getByRole('option', { name: 'Birth Date' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('option', { name: 'Birth Date' })).toHaveAttribute('title', 'This field has already been added to your mapping.')
    await user.clear(search)
    await user.type(search, 'spec{Enter}')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox', { name: 'Fields to add' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add Fields' })).toHaveFocus()

    const birth = screen.getByRole('region', { name: 'Additional Fields' })
    await user.click(within(birth).getAllByRole('radio', { name: 'Default value' })[0])
    expect(screen.getByLabelText('Default value for Birth Date')).toHaveAttribute('type', 'date')
    await user.click(within(birth).getAllByRole('radio', { name: 'Default value' })[1])
    await user.click(screen.getByRole('combobox', { name: 'Default value for Species' }))
    await user.click(await screen.findByRole('option', { name: 'Cat' }))
    expect(screen.getByRole('combobox', { name: 'Default value for Species' })).toHaveTextContent('Cat')
    expect(fetchTablePossibleValues).toHaveBeenCalledWith('person', 'speciesId', expect.anything())
  })

  it('shows Key Fields and Fields To Update for bulk edit and names unmapped key fields', async () => {
    const user = userEvent.setup()
    const edit = { ...person, isBulkEdit: true }
    const onSubmit = renderScreen(mappingStep, { ...baseValues, tableStructure: edit, suggestedBulkLoadProfile: { ...suggested, isBulkEdit: true, fieldList: [{ fieldName: 'email', columnIndex: 1, headerName: 'Email' }] } })
    expect(screen.getByRole('region', { name: 'Key Fields' })).toHaveTextContent('Select table key fields to continue.')
    expect(screen.getByRole('region', { name: 'Fields To Update' })).toBeInTheDocument()
    expect(screen.getByText('Keys find the records.')).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByLabelText('Table Key Fields *')).getAllByRole('option')).toHaveLength(3))
    await user.selectOptions(screen.getByLabelText('Table Key Fields *'), 'id')
    expect(screen.getByText('The following key fields are not mapped: id')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Table Key Fields *'), 'email')
    expect(screen.queryByText(/key fields are not mapped/)).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Key Fields' })).getByLabelText('Column for Email')).toHaveValue('1')
    expect(within(screen.getByRole('region', { name: 'Key Fields' })).queryByText('Clear if empty')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ keyFields: 'email', isBulkEdit: 'true' }), undefined))
  })

  it('says a table has no required fields', () => {
    renderScreen(mappingStep, { ...baseValues, tableStructure: { ...person, fields: person.fields.map((f) => ({ ...f, isRequired: false })) }, suggestedBulkLoadProfile: undefined })
    expect(screen.getByRole('region', { name: 'Required Fields' })).toHaveTextContent('There are no required fields in this table.')
  })

  it('scrolls to the first field error when the mapping cannot be submitted', async () => {
    const user = userEvent.setup()
    const scrolled: Element[] = []
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this) }
    const onSubmit = renderScreen(mappingStep, baseValues)
    await user.selectOptions(screen.getByLabelText('Column for First Name'), '')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('You must select a column.')).toBeInTheDocument()
    await waitFor(() => expect(scrolled.map((element) => element.textContent)).toContain('You must select a column.'))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('bulk load value mapping (#726)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps file values through searchable possible values, showing the labels of values mapped before', async () => {
    const user = userEvent.setup()
    const step: QFrontendStepMetaData = { name: 'valueMapping', label: 'Value Mapping', components: [{ type: 'BULK_LOAD_VALUE_MAPPING_FORM' }] }
    const onSubmit = renderScreen(step, {
      ...baseValues, bulkLoadProfile: { ...suggested, fieldList: [...suggested.fieldList, { fieldName: 'speciesId', columnIndex: 2, headerName: 'Species', doValueMapping: true }] },
      valueMappingField: field('speciesId', 'Species', { type: 'INTEGER', possibleValueSourceName: 'petSpecies', isRequired: true }),
      valueMappingFullFieldName: 'speciesId', valueMappingFieldTableName: 'person', fileValues: ['Doggo', 'Kitty'],
      valueMapping: { Doggo: 1 }, mappedValueLabels: { 1: 'Dog' }, valueMappingFieldIndex: 0, fieldNamesToDoValueMapping: ['speciesId'],
    })
    expect(screen.getByRole('region', { name: 'Saved Bulk Load Profiles' })).toHaveTextContent('You are not using a saved bulk load profile.')
    expect(screen.getByRole('combobox', { name: 'Species value for Doggo' })).toHaveTextContent('Dog')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('A value is required for this mapping')).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Species value for Kitty' }))
    await user.type(screen.getByRole('textbox', { name: 'Search Species value for Kitty options' }), 'Ca')
    await waitFor(() => expect(fetchTablePossibleValues).toHaveBeenCalledWith('person', 'speciesId', expect.objectContaining({ searchTerm: 'Ca' })))
    await user.click(await screen.findByRole('option', { name: 'Cat' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ mappedValuesJSON: JSON.stringify({ Doggo: 1, Kitty: 2 }) }), undefined))
  })
})
