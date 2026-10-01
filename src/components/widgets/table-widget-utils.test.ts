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

// Tests for the table widget helpers: column widths, page sizes and the fallback CSV export

import { describe, expect, it } from 'vitest'

import { htmlToExportText, minTableWidth, pageSizeOptions, resolveColumnWidths, tableExportCsv } from './table-widget-utils'

describe('resolveColumnWidths', () => {
  it('keeps auto layout when no column declares a width', () => {
    expect(resolveColumnWidths([undefined, undefined])).toBeNull()
    expect(resolveColumnWidths([])).toBeNull()
  })

  it('shares the width among fr columns, as a grid template does', () => {
    expect(resolveColumnWidths(['2fr', '1fr', '1fr'])).toEqual(['50%', '25%', '25%'])
    // a column without a width is 1fr (Material's default)
    expect(resolveColumnWidths(['3fr', undefined])).toEqual(['75%', '25%'])
  })

  it('gives fr columns their share as percentages, which a fixed layout scales into what fixed lengths leave', () => {
    expect(resolveColumnWidths(['120px', '1fr', '3fr'])).toEqual(['120px', '25%', '75%'])
    expect(resolveColumnWidths(['30%', '1fr', '1fr'])).toEqual(['30%', '35%', '35%'])
    expect(resolveColumnWidths(['100%'])).toEqual(['100%'])
  })
})

describe('minTableWidth', () => {
  it('keeps 6rem per flexible column plus the fixed widths', () => {
    expect(minTableWidth(['1fr', '1fr'])).toBe('12rem')
    expect(minTableWidth(['2fr', '180px', undefined, '60px'])).toBe('calc(12rem + 180px + 60px)')
    expect(minTableWidth(['100%'])).toBe('6rem')
  })
})

describe('pageSizeOptions', () => {
  it('offers the Material sizes plus the current one', () => {
    expect(pageSizeOptions(10)).toEqual([5, 10, 15, 20, 25])
    expect(pageSizeOptions(7)).toEqual([5, 7, 10, 15, 20, 25])
  })
})

describe('htmlToExportText', () => {
  it('drops icon glyphs and button-styled elements and keeps link text', () => {
    expect(htmlToExportText('<a href="/app/person/1">Darin<span class="material-icons-round notranslate MuiIcon-root MuiIcon-fontSizeInherit">open_in_new</span></a>'))
      .toBe('Darin')
    expect(htmlToExportText('Ready <span class="button">Go</span>')).toBe('Ready')
    expect(htmlToExportText('<b>Bold</b> &amp; plain')).toBe('Bold & plain')
  })

  it('puts block elements and line breaks on their own lines', () => {
    expect(htmlToExportText('<div>One</div><div>Two<br>Three</div>')).toBe('One\nTwo\nThree')
  })

  it('returns plain values as they are', () => {
    expect(htmlToExportText('Plain text')).toBe('Plain text')
    expect(htmlToExportText(null)).toBe('')
    expect(htmlToExportText(42)).toBe('42')
  })
})

describe('tableExportCsv', () => {
  it('quotes every header and cell like the Material table widget', () => {
    const csv = tableExportCsv(
      [
        { type: 'default', header: 'Name', accessor: 'name' },
        { type: 'html', header: 'Link', accessor: 'link' },
        { type: 'hidden', header: 'Tooltip', accessor: 'tooltip' },
      ],
      [
        { name: 'Say "hi"', link: '<a href="/x">Open<span class="material-icons">open_in_new</span></a>', tooltip: '<b>tip</b>', subRows: [{ name: 'nested' }] },
        { name: 1234, link: null },
      ],
    )
    expect(csv).toBe('"Name","Link","Tooltip"\n"Say ""hi""","Open","tip"\n"1234","",""\n')
  })
})
