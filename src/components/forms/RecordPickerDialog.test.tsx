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

// Tests for RecordPickerDialog

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { axe } from 'jest-axe'

import type { QPossibleValue, QPossibleValuePicker, QTableMetaData } from '@/types'
import { RecordPickerDialog } from './RecordPickerDialog'

vi.mock('@/lib/api/possible-values', () => ({
  fetchPossibleValuesPage: vi.fn(),
  fetchTablePossibleValues: vi.fn(),
}))
vi.mock('@/lib/hooks/use-metadata', () => ({
  useTableMetaData: vi.fn(),
  useProcessMetaData: vi.fn(),
}))
vi.mock('@/components/process/ProcessRun', () => ({
  ProcessRun: ({ onComplete }: { onComplete?: (values: Record<string, unknown>) => void }) => (
    <button type="button" onClick={() => onComplete?.({ mediaId: 99 })}>Finish upload</button>
  ),
}))

import { fetchPossibleValuesPage, fetchTablePossibleValues } from '@/lib/api/possible-values'
import { useProcessMetaData, useTableMetaData } from '@/lib/hooks/use-metadata'

const mockPage = vi.mocked(fetchPossibleValuesPage)
const mockChoices = vi.mocked(fetchTablePossibleValues)

const field = (name: string, label: string, type: string, extra: object = {}) =>
  ({ name, label, type, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra })

const MEDIA = {
  name: 'media',
  label: 'Media',
  primaryKeyField: 'id',
  fields: {
    id: field('id', 'ID', 'LONG'),
    mediaTypeId: field('mediaTypeId', 'Media Type', 'LONG', { possibleValueSourceName: 'mediaType' }),
    width: field('width', 'Width', 'INTEGER'),
    altText: field('altText', 'Alt Text', 'STRING'),
  },
} as unknown as QTableMetaData

const PICKER: QPossibleValuePicker = {
  thumbnailField: 'thumbnailUrl',
  previewField: 'galleryUrl',
  subtitleFields: ['mediaTypeId'],
  detailFields: ['width', 'altText'],
  filterFields: ['mediaTypeId', 'width'],
  sorts: [{ label: 'Newest', fieldName: 'id', isAscending: false }, { label: 'Name', fieldName: 'name', isAscending: true }],
  pageSize: 2,
  uploadProcessName: 'uploadImage',
  uploadResultIdField: 'mediaId',
}

const media = (id: number, label: string): QPossibleValue => ({
  id,
  label,
  values: { thumbnailUrl: `/t/${id}.jpg`, galleryUrl: `/g/${id}.jpg`, mediaTypeId: 1, width: 1200, altText: `${label} alt` },
  displayValues: { mediaTypeId: 'Photo', width: '1,200' },
})

/** The result options (not the native options of the sort and filter selects). */
const resultOptions = () => within(screen.getByRole('listbox', { name: /results/ })).getAllByRole('option')

const onConfirm = vi.fn()
const onClose = vi.fn()

/**
 * Render the dialog for the blog post's image field.
 * @param props - Overrides.
 * @returns The render result.
 */
function renderDialog(props: Partial<React.ComponentProps<typeof RecordPickerDialog>> = {}) {
  return render(
    <RecordPickerDialog
      label="Featured Image"
      fieldName="featuredMediaId"
      context={{ type: 'table', tableName: 'blog_post' }}
      picker={PICKER}
      pickerTableName="media"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(useTableMetaData).mockReturnValue({ data: MEDIA } as ReturnType<typeof useTableMetaData>)
  vi.mocked(useProcessMetaData).mockReturnValue({ data: { name: 'uploadImage', label: 'Upload image', hasPermission: true } } as ReturnType<typeof useProcessMetaData>)
  mockChoices.mockResolvedValue([{ id: 1, label: 'Photo' }, { id: 2, label: 'Logo' }])
  mockPage.mockImplementation(async (_context, _field, _source, request) => {
    if (request.ids) return { options: request.ids.split(',').map((id) => media(Number(id), `Media ${id}`)), hasMore: false }
    if (request.picker.afterId === 8) return { options: [media(7, 'Seven')], hasMore: false }
    return { options: [media(9, 'Nine'), media(8, 'Eight')], hasMore: true }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RecordPickerDialog', () => {
  it('shows a thumbnail grid of the first page and a preview of the focused option', async () => {
    const { baseElement } = renderDialog()
    expect(await screen.findByRole('option', { name: /^Nine/ })).toBeInTheDocument()
    const options = resultOptions()
    expect(options).toHaveLength(2)
    expect(options[0].querySelector('img')).toHaveAttribute('src', '/t/9.jpg')
    expect(within(options[0]).getByText('Photo')).toBeInTheDocument()
    const preview = screen.getByLabelText('Preview', { selector: 'aside' })
    expect(within(preview).getByRole('img')).toHaveAttribute('src', '/g/9.jpg')
    expect(within(preview).getByText('Nine alt')).toBeInTheDocument()
    expect(within(preview).getByRole('link', { name: /open/i })).toHaveAttribute('href', '/app/media/9')
    expect(mockPage.mock.calls[0][3].picker).toEqual({ filter: { criteria: [], booleanOperator: 'AND', orderBys: [{ fieldName: 'id', isAscending: false }] } })
    expect(await axe(baseElement)).toHaveNoViolations()
  })

  it('loads the next page by keyset, without counting', async () => {
    renderDialog()
    await screen.findByRole('option', { name: /^Nine/ })
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByRole('option', { name: /^Seven/ })).toBeInTheDocument()
    expect(mockPage.mock.calls.at(-1)![3].picker.afterId).toBe(8)
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('debounces the search box into a server-side search', async () => {
    renderDialog()
    await screen.findByRole('option', { name: /^Nine/ })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'har' } })
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'harbor' } })
    await act(async () => { vi.advanceTimersByTime(350) })
    await waitFor(() => expect(mockPage.mock.calls.at(-1)![3].searchTerm).toBe('harbor'))
    expect(mockPage.mock.calls.filter((call) => call[3].searchTerm === 'har')).toHaveLength(0)
  })

  it('filters by the picker table fields and remembers the filters per field', async () => {
    const { unmount } = renderDialog()
    await screen.findByRole('option', { name: /^Nine/ })
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Logo' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Media Type'), '2')
    await waitFor(() => expect(mockPage.mock.calls.at(-1)![3].picker.filter?.criteria).toEqual([{ fieldName: 'mediaTypeId', operator: 'EQUALS', values: ['2'] }]))
    await userEvent.selectOptions(screen.getByLabelText('Sort'), '1')
    await waitFor(() => expect(mockPage.mock.calls.at(-1)![3].picker.filter?.orderBys).toEqual([{ fieldName: 'name', isAscending: true }]))
    unmount()

    renderDialog()
    await waitFor(() => expect(mockPage.mock.calls.at(-1)![3].picker.filter?.criteria).toEqual([{ fieldName: 'mediaTypeId', operator: 'EQUALS', values: ['2'] }]))
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument()
  })

  it('selects with a click and confirms with Select; a double click confirms at once', async () => {
    renderDialog()
    await userEvent.click(await screen.findByRole('option', { name: /^Eight/ }))
    expect(resultOptions()[1]).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ id: 8 })])

    onConfirm.mockClear()
    await userEvent.dblClick(screen.getByRole('option', { name: /^Nine/ }))
    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ id: 9 })])
  })

  it('moves with the arrow keys and confirms with Enter', async () => {
    renderDialog()
    await screen.findByRole('option', { name: /^Nine/ })
    const options = resultOptions()
    options[0].focus()
    fireEvent.keyDown(options[0], { key: 'ArrowRight' })
    expect(options[1]).toHaveFocus()
    fireEvent.keyDown(options[1], { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ id: 8 })])
  })

  it('shows the current selection as chosen', async () => {
    renderDialog({ selectedIds: [8] })
    await waitFor(() => expect(resultOptions()[1]).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByText('Media 8', { selector: '[data-qqq-id="record-picker-selection"]' })).toBeInTheDocument()
  })

  it('toggles several options in multiple selection', async () => {
    renderDialog({ multiple: true })
    await userEvent.click(await screen.findByRole('option', { name: /^Nine/ }))
    await userEvent.click(screen.getByRole('option', { name: /^Eight/ }))
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: /^Nine/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ id: 8 })])
  })

  it('uploads a new record and selects it', async () => {
    renderDialog()
    await screen.findByRole('option', { name: /^Nine/ })
    await userEvent.click(screen.getByRole('button', { name: /upload image/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Finish upload' }))
    expect(await screen.findByText('Media 99', { selector: '[data-qqq-id="record-picker-selection"]' })).toBeInTheDocument()
    expect(resultOptions()[0]).toHaveAttribute('data-value', '99')
    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ id: 99 })])
  })

  it('offers no upload without permission, and closes with Escape', async () => {
    vi.mocked(useProcessMetaData).mockReturnValue({ data: { name: 'uploadImage', label: 'Upload image', hasPermission: false } } as ReturnType<typeof useProcessMetaData>)
    renderDialog()
    await screen.findByRole('option', { name: /^Nine/ })
    expect(screen.queryByRole('button', { name: /upload image/i })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('reports a failed load with a retry', async () => {
    mockPage.mockRejectedValueOnce(new Error('down'))
    renderDialog()
    expect(await screen.findByRole('alert')).toHaveTextContent('Results could not be loaded.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('option', { name: /^Nine/ })).toBeInTheDocument()
  })
})
