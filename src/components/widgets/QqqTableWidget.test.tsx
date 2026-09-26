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

// Tests for the table widget's Material parity: typed cells, sub-rows, widths, paging, help and multi-table chrome

import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { QWidgetMetaData } from '@/types'
import { QContext } from '@/lib/context/q-context'
import type { QContextType } from '@/lib/context/q-context'
import { QqqMultiTableWidget, QqqTableWidget } from './QqqTableWidget'
import type { QqqTablePayload } from './QqqTableWidget'

const downloads = vi.hoisted(() => [] as Array<{ fileName: string; text: string }>)
vi.mock('./widget-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./widget-utils')>()),
  downloadText: (fileName: string, text: string) => { downloads.push({ fileName, text }) },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const meta = (extra: Partial<QWidgetMetaData> = {}): QWidgetMetaData => ({ name: 'tbl', label: 'Owned Table', hasPermission: true, ...extra })

/** Text of each body row's cells. */
function bodyRows(): string[][] {
  return Array.from(document.querySelectorAll('tbody tr')).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent ?? ''))
}

const numbered = (count: number) => Array.from({ length: count }, (_, index) => ({ name: `Row ${index + 1}` }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('QqqTableWidget cells', () => {
  it('formats numbers, hides helper columns and renders html, htmlAndTooltip, image and composite cells', () => {
    const data: QqqTablePayload = {
      columns: [
        { type: 'default', header: 'Count', accessor: 'count' },
        { type: 'hidden', header: 'Image URL', accessor: 'imageUrl' },
        { type: 'hidden', header: 'Tooltip', accessor: 'tooltip' },
        { type: 'html', header: 'Html', accessor: 'html' },
        { type: 'htmlAndTooltip', header: 'Tipped', accessor: 'tipped' },
        { type: 'image', header: 'Product', accessor: 'product' },
        { type: 'composite', header: 'Composite', accessor: 'composite' },
      ],
      rows: [{
        count: 1234567, imageUrl: '/owned.png', imageLabel: 'Owned product', imageTotal: 2500, imageTotalType: 'sold',
        tooltip: '<i>Owned tip</i>', html: '<b>bold</b><script>alert(1)</script>', tipped: '<u>hover me</u>',
        composite: { blocks: [{ blockTypeName: 'TEXT', values: { text: 'Owned composite text' } }] },
      }],
    }
    render(<QqqTableWidget widgetMetaData={meta()} data={data} />)
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Count', 'Html', 'Tipped', 'Product', 'Composite'])
    const cells = document.querySelectorAll('tbody td')
    expect(cells[0].textContent).toBe('1,234,567')
    expect(cells[1].querySelector('b')?.textContent).toBe('bold')
    expect(cells[1].querySelector('script')).toBeNull()
    const tip = within(cells[2] as HTMLElement).getByRole('tooltip', { hidden: true })
    expect(tip.querySelector('i')?.textContent).toBe('Owned tip')
    fireEvent.focus(cells[2].querySelector('[data-tooltip-trigger]') as HTMLElement)
    expect(tip).toBeVisible()
    const image = cells[3].querySelector('img') as HTMLImageElement
    expect(image.getAttribute('src')).toBe('/owned.png')
    expect(image.getAttribute('alt')).toBe('Owned product')
    expect(cells[3].textContent).toBe('Owned product2,500 sold')
    expect(cells[4].textContent).toContain('Owned composite text')
  })

  it('applies fr widths as a fixed layout', () => {
    render(<QqqTableWidget widgetMetaData={meta()} data={{ columns: [{ header: 'A', accessor: 'a', width: '1fr' }, { header: 'B', accessor: 'b', width: '3fr' }], rows: [{ a: 1, b: 2 }] }} />)
    const table = screen.getByRole('table')
    expect(table.className).toContain('table-fixed')
    expect(Array.from(table.querySelectorAll('col')).map((col) => col.style.width)).toEqual(['25%', '75%'])
    expect(screen.getAllByRole('columnheader')[0].className).toContain('sticky')
  })
})

describe('QqqTableWidget sub-rows', () => {
  it('expands and collapses nested rows, shading them', () => {
    render(<QqqTableWidget widgetMetaData={meta()} data={{
      columns: [{ type: 'default', header: 'Name', accessor: 'name' }],
      rows: [{ name: 'Parent', subRows: [{ name: 'Child one' }, { name: 'Child two', subRows: [{ name: 'Grandchild' }] }] }, { name: 'Loner' }],
    }} />)
    expect(bodyRows()).toEqual([['Parent', ''], ['Loner', '']])
    const expand = screen.getByRole('button', { name: 'Expand row 1' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(expand)
    expect(bodyRows().map((row) => row[0])).toEqual(['Parent', 'Child one', 'Child two', 'Loner'])
    expect(document.querySelector('[data-qqq-id="table-row-tbl-0"]')?.className).toContain('bg-muted/40')
    expect(document.querySelector('[data-qqq-id="table-row-tbl-0.1"]')?.getAttribute('data-depth')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Expand row 1.2' }))
    expect(bodyRows().map((row) => row[0])).toEqual(['Parent', 'Child one', 'Child two', 'Grandchild', 'Loner'])
    fireEvent.click(screen.getByRole('button', { name: 'Collapse row 1' }))
    expect(bodyRows().map((row) => row[0])).toEqual(['Parent', 'Loner'])
    expect(screen.queryByRole('button', { name: /row 2/ })).toBeNull()
  })
})

describe('QqqTableWidget paging', () => {
  const columns = [{ type: 'default', header: 'Name', accessor: 'name' }]

  it('shows 10 rows per page when rowsPerPage is unset, with numbered pages and chevrons', () => {
    render(<QqqTableWidget widgetMetaData={meta()} data={{ columns, rows: numbered(23) }} />)
    expect(bodyRows().map((row) => row[0])).toEqual(numbered(10).map((row) => row.name))
    expect(screen.queryByRole('button', { name: 'Previous page' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Page \d$/ }).map((button) => button.textContent)).toEqual(['1', '2', '3'])
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))
    expect(bodyRows().map((row) => row[0])).toEqual(['Row 21', 'Row 22', 'Row 23'])
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(bodyRows()[0][0]).toBe('Row 11')
  })

  it('jumps to a typed page when there are more than six pages', () => {
    render(<QqqTableWidget widgetMetaData={meta()} data={{ columns, rows: numbered(70), rowsPerPage: 10 }} />)
    expect(screen.queryByRole('button', { name: 'Page 1' })).toBeNull()
    const jump = screen.getByRole('spinbutton', { name: 'Go to page (1 to 7)' })
    expect(jump).toHaveValue(1)
    fireEvent.change(jump, { target: { value: '5' } })
    expect(bodyRows()[0][0]).toBe('Row 41')
    fireEvent.change(jump, { target: { value: '99' } })
    expect(bodyRows()[0][0]).toBe('Row 41')
    fireEvent.blur(jump)
    expect(jump).toHaveValue(5)
  })

  it('offers the entries-per-page select only when hidePaginationDropdown is false', () => {
    const { unmount } = render(<QqqTableWidget widgetMetaData={meta()} data={{ columns, rows: numbered(12), hidePaginationDropdown: true }} />)
    expect(screen.queryByRole('combobox', { name: 'Entries per page' })).toBeNull()
    unmount()
    render(<QqqTableWidget widgetMetaData={meta()} data={{ columns, rows: numbered(12), hidePaginationDropdown: false }} />)
    const select = screen.getByRole('combobox', { name: 'Entries per page' })
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual(['5', '10', '15', '20', '25'])
    expect(select).toHaveValue('10')
    fireEvent.change(select, { target: { value: '5' } })
    expect(bodyRows()).toHaveLength(5)
    expect(screen.getAllByRole('button', { name: /^Page \d$/ })).toHaveLength(3)
  })
})

describe('QqqTableWidget column-header help', () => {
  const data: QqqTablePayload = { columns: [{ header: 'Name', accessor: 'name' }, { header: 'Plain', accessor: 'plain' }], rows: [{ name: 'A', plain: 'B' }] }
  const helpful = meta({ helpContent: { 'columnHeader=name': [{ content: 'Owned <b>column</b> help', format: 'HTML', roles: ['ALL_SCREENS'] }] } })

  it('shows the columnHeader slot help as a tooltip on that header', () => {
    render(<QqqTableWidget widgetMetaData={helpful} data={data} />)
    const [name, plain] = screen.getAllByRole('columnheader')
    const tip = within(name).getByRole('tooltip', { hidden: true })
    expect(tip.querySelector('b')?.textContent).toBe('column')
    expect(within(plain).queryByRole('tooltip', { hidden: true })).toBeNull()
  })

  it('shows every slot key in help-authoring mode', () => {
    render(
      <QContext.Provider value={{ helpHelpActive: true } as QContextType}>
        <QqqTableWidget widgetMetaData={helpful} data={data} />
      </QContext.Provider>,
    )
    const [name, plain] = screen.getAllByRole('columnheader')
    expect(within(name).getByRole('tooltip', { hidden: true }).textContent).toBe('Owned column help [widget:tbl;slot:columnHeader=name]')
    expect(within(plain).getByRole('tooltip', { hidden: true }).textContent).toBe('[widget:tbl;slot:columnHeader=plain]')
  })
})

describe('QqqMultiTableWidget', () => {
  it('gives each table its own export button and footer', () => {
    downloads.length = 0
    render(<QqqMultiTableWidget widgetMetaData={meta({ showExportButton: true })} data={{
      tableDataList: [
        { label: 'First', footerHTML: '<i>First footer</i>', columns: [{ type: 'html', header: 'Name', accessor: 'name' }], rows: [{ name: '<a href="/x">One<span class="MuiIcon-root">open_in_new</span></a>' }] },
        { label: 'Second', columns: [{ header: 'Name', accessor: 'name' }], rows: [], csvData: [['Name'], ['Two']] },
      ],
    }} />)
    expect(document.querySelector('[data-qqq-id="table-footer-tbl-0"] i')?.textContent).toBe('First footer')
    expect(document.querySelector('[data-qqq-id="table-footer-tbl-1"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Export First' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export Second' }))
    expect(downloads.map((download) => download.text)).toEqual(['"Name"\n"One"\n', '"Name"\n"Two"\n'])
    expect(downloads.map((download) => download.fileName)).toEqual([expect.stringMatching(/^First \d{4}-\d\d-\d\d \d{4}\.csv$/), expect.stringMatching(/^Second /)])
  })
})
