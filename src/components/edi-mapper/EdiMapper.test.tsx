/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ediGuide, ediMap, ediPreview, ediTarget } from '../../../tests/fixtures/edi'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { RecordActions } from '@/components/records/RecordActions'
import { getUiApiVersion } from '@/lib/api/ui-api-version'
import { validateEdiRules, previewEdi } from '@/lib/api/edi'
import { getRecord, insertRecord, updateRecord, deleteRecord, queryRecords } from '@/lib/api/tables'
import { MapperWorkspace } from './EdiMapperPage'
import { GuideTree } from './GuideTree'
import PreviewPane, { PreviewResult } from './PreviewPane'

vi.mock('@/lib/api/edi', () => ({
  getEdiGuide: vi.fn(),
  getEdiTarget: vi.fn(),
  validateEdiRules: vi.fn(),
  previewEdi: vi.fn(),
}))
vi.mock('@/lib/api/tables', () => ({
  getRecord: vi.fn(),
  insertRecord: vi.fn(),
  updateRecord: vi.fn(),
  deleteRecord: vi.fn(),
  queryRecords: vi.fn(),
}))
vi.mock('@/lib/api/ui-api-version', () => ({ getUiApiVersion: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const ruleTable = {
  ...qInstance.tables.company,
  insertPermission: true,
  editPermission: true,
  deletePermission: true,
}
function mount(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}
function workspace(status = 'DRAFT', target = ediTarget) {
  return mount(
    <MapperWorkspace
      mapId={7}
      map={{ ...ediMap, values: { ...ediMap.values, status } }}
      target={target}
      guide={ediGuide}
      ruleTable={ruleTable}
    />
  )
}
async function addRule() {
  const user = userEvent.setup()
  // All steps use keyboard activation, including the native guide disclosure.
  screen.getByText('BEG — Beginning').closest('summary')!.focus()
  await user.keyboard('{Enter}')
  // jsdom does not implement native details keyboard toggling.
  screen.getByText('BEG — Beginning').closest('details')!.open = true
  const element = screen.getByRole('button', { name: /BEG03 — Purchase order number/ })
  element.focus()
  await user.keyboard('{Enter}')
  screen.getByRole('button', { name: /Order number \(required\)/ }).focus()
  await user.keyboard('{Enter}')
  screen.getByRole('button', { name: 'Add rule' }).focus()
  await user.keyboard('{Enter}')
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(validateEdiRules).mockResolvedValue({ rules: [] })
  vi.mocked(getRecord).mockResolvedValue(ediMap)
  vi.mocked(queryRecords).mockResolvedValue({
    records: [
      { tableName: 'edi_map_sample', values: { id: 11, name: 'Synthetic purchase order' } },
    ],
  })
  vi.mocked(previewEdi).mockResolvedValue(ediPreview)
})

it('renders nested loops, usage badges, searchable elements and code popovers', async () => {
  mount(<GuideTree tree={ediGuide} selected="" onSelect={vi.fn()} />)
  expect(screen.getByText('Loop PO1 (repeat 999)')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search guide'), { target: { value: 'Purchase order' } })
  expect(screen.getByRole('button', { name: /BEG03 — Purchase order number/ })).toBeVisible()
  expect(screen.getAllByTitle('Required').length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: 'Codes for BEG03' }))
  expect(screen.getByText('RE')).toBeVisible()
})

it('creates a rule by keyboard, edits transform arguments and displays indexed errors without writing', async () => {
  workspace()
  await addRule()
  expect(screen.getByLabelText('EDI path')).toHaveValue('BEG03')
  expect(screen.getByLabelText('Target field')).toHaveValue('poNumber')
  await userEvent.selectOptions(screen.getByLabelText('Transform'), 'CONSTANT')
  await userEvent.type(screen.getByLabelText('value (required)'), 'TEST')
  vi.mocked(validateEdiRules).mockResolvedValue({
    rules: [{ index: 0, sequence: 10, errors: ['Target field is not readable'] }],
  })
  await userEvent.click(screen.getByRole('button', { name: 'Validate rules' }))
  expect(await screen.findByText('Target field is not readable')).toBeVisible()
  expect(validateEdiRules).toHaveBeenCalledWith(7, [
    expect.objectContaining({
      ediPath: 'BEG03',
      qqqPath: 'poNumber',
      transform: 'CONSTANT',
      transformArgs: '{"value":"TEST"}',
    }),
  ])
  expect(insertRecord).not.toHaveBeenCalled()
})

it('previews the complete unsaved rule override set and shows parse, findings, ack and diffs', async () => {
  const rules = [{ ediPath: 'BEG03', qqqPath: 'poNumber', sequence: 10 }]
  mount(<PreviewPane mapId={7} rules={rules} />)
  await screen.findByRole('option', { name: 'Synthetic purchase order' })
  await userEvent.selectOptions(screen.getByLabelText('Sample'), '11')
  await userEvent.click(screen.getByRole('button', { name: 'Run preview' }))
  expect(await screen.findByText('SNIP level 2')).toBeVisible()
  expect(previewEdi).toHaveBeenCalledWith({
    mapId: 7,
    sampleId: 11,
    guideRevision: 'ORIGINAL',
    ruleOverrides: rules,
  })
  expect(screen.getByText(/Interchanges: 1/)).toBeVisible()
  expect(screen.getByText('ST*997*0001~AK1*PO*1~')).toBeVisible()
  expect(screen.getByText('Against expected result')).toBeVisible()
  expect(queryRecords).toHaveBeenCalledWith(
    'edi_map_sample',
    expect.objectContaining({
      filter: expect.objectContaining({
        criteria: [{ fieldName: 'mapId', operator: 'EQUALS', values: [7] }],
      }),
    })
  )
})

it('suppresses all sensitive result sections when PHI is flagged, even if populated', () => {
  mount(<PreviewResult result={{ ...ediPreview, phiSuppressed: true }} />)
  expect(screen.getByText(/PHI suppressed/)).toBeVisible()
  expect(screen.queryByText('ST*997*0001~AK1*PO*1~')).not.toBeInTheDocument()
  expect(screen.queryByText('Mapped records')).not.toBeInTheDocument()
  expect(screen.queryByText('Against expected result')).not.toBeInTheDocument()
})

it('disables Save for ACTIVE maps, even after local edits', async () => {
  workspace('ACTIVE')
  await addRule()
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(screen.getByText(/Create Draft Revision:/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Map record' })).toHaveAttribute('href', '/app/edi_map/7')
})

it('rechecks draft status before writes', async () => {
  workspace()
  await addRule()
  vi.mocked(getRecord).mockResolvedValue({
    ...ediMap,
    values: { ...ediMap.values, status: 'ACTIVE' },
  })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('no longer a draft')
  expect(insertRecord).not.toHaveBeenCalled()
})

it('saves inserted rules through core CRUD and does not insert again', async () => {
  workspace()
  await addRule()
  vi.mocked(insertRecord).mockResolvedValue({ tableName: 'edi_map_rule', values: { id: 21 } })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Rules saved.')).toBeVisible()
  expect(insertRecord).toHaveBeenCalledWith(
    'edi_map_rule',
    expect.objectContaining({ mapId: 7, ediPath: 'BEG03' })
  )
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(updateRecord).not.toHaveBeenCalled()
  expect(deleteRecord).not.toHaveBeenCalled()
})

it.each([false, true])('record action respects extension presence (%s)', async (installed) => {
  vi.mocked(getUiApiVersion).mockResolvedValue({
    apiVersion: '1.1.0',
    features: [],
    extensions: installed ? [{ name: 'edi', version: '1.0.0', pathPrefix: '/qbit/edi' }] : [],
    preSemver: false,
  })
  mount(
    <RecordActions
      tableMetaData={{ ...qInstance.tables.company, name: 'edi_map', readPermission: true }}
      record={ediMap}
      actionEntries={[]}
      resolveMenu={() => []}
      onAction={vi.fn()}
    />
  )
  await waitFor(() => expect(getUiApiVersion).toHaveBeenCalled())
  if (installed)
    expect(await screen.findByRole('link', { name: 'Open Mapper' })).toHaveAttribute(
      'href',
      '/app/edi_map/7/mapper'
    )
  else expect(screen.queryByRole('link', { name: 'Open Mapper' })).not.toBeInTheDocument()
})

it('does not discover EDI or offer the action without map read permission', () => {
  mount(
    <RecordActions
      tableMetaData={{ ...qInstance.tables.company, name: 'edi_map', readPermission: false }}
      record={ediMap}
      actionEntries={[]}
      resolveMenu={() => []}
      onAction={vi.fn()}
    />
  )
  expect(getUiApiVersion).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: 'Open Mapper' })).not.toBeInTheDocument()
})

it('uses wildcard paths for repeating loops and supports dropping onto association fields', async () => {
  workspace()
  fireEvent.change(screen.getByLabelText('Search guide'), { target: { value: 'Quantity' } })
  const element = screen.getByRole('button', { name: /PO1\[\*\]\/PO102 — Quantity/ })
  const dataTransfer = {
    setData: vi.fn(),
    getData: () => 'PO1[*]/PO102',
    types: ['application/x-edi-path'],
    effectAllowed: '',
    dropEffect: '',
  }
  fireEvent.dragStart(element, { dataTransfer })
  expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-edi-path', 'PO1[*]/PO102')
  fireEvent.drop(screen.getByRole('button', { name: /Quantity lines.quantity/ }), { dataTransfer })
  expect(screen.getByLabelText('EDI path')).toHaveValue('PO1[*]/PO102')
  expect(screen.getByLabelText('Target field')).toHaveValue('lines.quantity')
})

it('updates and deletes existing rules only on Save', async () => {
  workspace('DRAFT', {
    ...ediTarget,
    rules: [
      { id: 1, sequence: 10, ediPath: 'BEG03', qqqPath: 'poNumber' },
      { id: 2, sequence: 20, ediPath: 'PO1[*]/PO102', qqqPath: 'lines.quantity' },
    ],
  })
  fireEvent.change(screen.getAllByLabelText('Default value')[0], { target: { value: 'missing' } })
  await userEvent.click(screen.getByRole('button', { name: 'Delete rule 20' }))
  expect(updateRecord).not.toHaveBeenCalled()
  expect(deleteRecord).not.toHaveBeenCalled()
  vi.mocked(updateRecord).mockResolvedValue({ tableName: 'edi_map_rule', values: { id: 1 } })
  vi.mocked(deleteRecord).mockResolvedValue({ deletedCount: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Rules saved.')).toBeVisible()
  expect(updateRecord).toHaveBeenCalledWith(
    'edi_map_rule',
    1,
    expect.objectContaining({ defaultValue: 'missing', mapId: 7 })
  )
  expect(deleteRecord).toHaveBeenCalledWith('edi_map_rule', 2)
})

it('retains confirmed inserts when a later write fails and retries only the unsaved rule', async () => {
  workspace()
  await addRule()
  await addRule()
  vi.mocked(insertRecord)
    .mockResolvedValueOnce({ tableName: 'edi_map_rule', values: { id: 21 } })
    .mockRejectedValueOnce(new Error('Rule write refused'))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Rule write refused')
  vi.mocked(insertRecord).mockResolvedValueOnce({ tableName: 'edi_map_rule', values: { id: 22 } })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Rules saved.')).toBeVisible()
  expect(insertRecord).toHaveBeenCalledTimes(3)
  expect(updateRecord).not.toHaveBeenCalled()
})

it('stops saving when the server cannot confirm an inserted rule identifier', async () => {
  workspace()
  await addRule()
  vi.mocked(insertRecord).mockResolvedValue({ tableName: 'edi_map_rule', values: {} })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Reload before saving again')
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})

it('rejects oversize uploads before sending and sends valid files as base64 only', async () => {
  mount(<PreviewPane mapId={7} rules={[]} />)
  const oversized = new File(['x'], 'large.edi')
  Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 })
  await userEvent.upload(screen.getByLabelText(/Upload sample/), oversized)
  expect(screen.getByRole('alert')).toHaveTextContent('5 MB limit')
  expect(previewEdi).not.toHaveBeenCalled()
  await userEvent.upload(screen.getByLabelText(/Upload sample/), new File(['EDI'], 'sample.edi'))
  await screen.findByText('Selected upload: sample.edi')
  await userEvent.click(screen.getByRole('button', { name: 'Run preview' }))
  await waitFor(() =>
    expect(previewEdi).toHaveBeenCalledWith({
      mapId: 7,
      guideRevision: 'ORIGINAL',
      sampleBase64: 'RURJ',
      sampleName: 'sample.edi',
      ruleOverrides: [],
    })
  )
})
