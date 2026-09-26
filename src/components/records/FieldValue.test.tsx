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
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { FieldAdornment, QFieldMetaData, QRecord, QWidgetMetaData } from '@/types'
import { FieldValue } from './FieldValue'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function field(name: string, adornments: FieldAdornment[] = [], extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label: name, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments, ...extra }
}

function show(f: QFieldMetaData, values: Record<string, unknown>, displayValues: Record<string, string> = {}, widgets?: Record<string, QWidgetMetaData>) {
  const record: QRecord = { tableName: 'lab', values, displayValues }
  const client = new QueryClient()
  render(<QueryClientProvider client={client}><FieldValue field={f} record={record} widgetMetaDataMap={widgets} /></QueryClientProvider>)
  return document.querySelector(`[data-qqq-id="field-value-${f.name}"]`) as HTMLElement
}

describe('FieldValue adornments use the backend value keys', () => {
  it('links LINK values to records or URLs, never to unsafe schemes', () => {
    expect(show(field('owner', [{ type: 'LINK', values: { toRecordFromTable: 'person' } }]), { owner: 3 }, { owner: 'Casey Sample' }))
      .toHaveAttribute('href', '/app/person/3')
    const site = show(field('site', [{ type: 'LINK', values: { target: '_blank' } }]), { site: 'https://example.invalid' })
    expect(site).toHaveAttribute('target', '_blank')
    expect(site).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not link a javascript: value', () => {
    const value = show(field('site', [{ type: 'LINK' }]), { site: 'javascript:alert(1)' })
    expect(value.tagName).toBe('SPAN')
  })

  it('colors CHIP values by color.<raw value> and shows the display value', () => {
    const chip = show(field('status', [{ type: 'CHIP', values: { 'color.ACTIVE': 'success', 'icon.ACTIVE': 'check' } }]), { status: 'ACTIVE' }, { status: 'Active' })
    expect(chip).toHaveTextContent('Active')
    expect(chip).toHaveAttribute('data-chip-color', 'success')
    expect(chip).toHaveAttribute('data-chip-icon', 'check')
    // the chip draws the icon, not only names it (Material ValueUtils CHIP icons)
    const glyph = chip.querySelector('svg[data-qqq-icon="check"]')
    expect(glyph).not.toBeNull()
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws no chip icon for a value without one', () => {
    const chip = show(field('status', [{ type: 'CHIP', values: { 'color.DRAFT': 'info', 'icon.ACTIVE': 'check' } }]), { status: 'DRAFT' }, { status: 'Draft' })
    expect(chip).not.toHaveAttribute('data-chip-icon')
    expect(chip.querySelector('svg')).toBeNull()
  })

  it('keeps the line breaks of a multi-line STRING value', () => {
    const value = show(field('address'), { address: '1 Main St\nSpringfield' })
    expect(value.textContent).toBe('1 Main St\nSpringfield')
    expect(value).toHaveClass('whitespace-pre-wrap')
    expect(show(field('city'), { city: 'Springfield' })).not.toHaveClass('whitespace-pre-wrap')
  })

  it('offers open and download links for FILE_DOWNLOAD values', () => {
    const file = show(field('doc', [{ type: 'FILE_DOWNLOAD' }], { type: 'BLOB' }), { doc: '/data/lab/1/doc/a.txt' }, { doc: 'a.txt' })
    expect(file).toHaveTextContent('a.txt')
    expect(document.querySelector('[data-qqq-id="field-value-doc-open"]')).toHaveAttribute('href', '/qqq/v1/table/lab/1/doc/a.txt')
    expect(document.querySelector('[data-qqq-id="field-value-doc-download"]')).toHaveAttribute('href', '/qqq/v1/table/lab/1/doc/a.txt?download=1')
  })

  it('reveals REVEAL values on request', () => {
    const secret = show(field('token', [{ type: 'REVEAL' }], { label: 'Token' }), { token: 'abc' })
    expect(secret).toHaveTextContent('••••••••')
    fireEvent.click(screen.getByRole('button', { name: 'Show Token' }))
    expect(secret).toHaveTextContent('abc')
  })

  it('renders WIDGET values with their widget, or reports a missing widget', () => {
    const widget = { name: 'summary', label: 'Summary', type: 'html' } as unknown as QWidgetMetaData
    const rendered = show(field('summary', [{ type: 'WIDGET', values: { widgetName: 'summary' } }]), { summary: { type: 'html', html: '<b>Hi</b>' } }, {}, { summary: widget })
    expect(rendered.querySelector('b')).toHaveTextContent('Hi')
  })

  it('reports a WIDGET adornment whose widget is not in the metadata', () => {
    show(field('missing', [{ type: 'WIDGET', values: { widgetName: 'nope' } }]), { missing: {} })
    expect(screen.getByRole('alert')).toHaveTextContent('Error: Could not load widget [nope]')
  })

  it('shows a zoned DATE_TIME display value as-is and formats a raw instant in the viewer zone', () => {
    expect(show(field('fixed', [], { type: 'DATE_TIME' }), { fixed: '2024-03-10T08:30:00Z' }, { fixed: '2024-03-10 03:30:00 AM CDT' }))
      .toHaveTextContent('2024-03-10 03:30:00 AM CDT')
    const raw = show(field('plain', [], { type: 'DATE_TIME' }), { plain: '2024-03-10T08:30:00Z' }, { plain: '2024-03-10T08:30:00Z' })
    expect(raw.textContent).toMatch(/^2024-03-10 \d{2}:30:00 [AP]M \S+$/)
    expect(raw).toHaveAttribute('dateTime', '2024-03-10T08:30:00Z')
  })

  it('renders RENDER_HTML sanitized and an empty value as a dash', () => {
    const html = show(field('note', [{ type: 'RENDER_HTML' }]), { note: '<i>ok</i><script>window.bad=1</script>' })
    expect(html.querySelector('i')).toHaveTextContent('ok')
    expect(html.querySelector('script')).toBeNull()
    expect(show(field('empty'), { empty: null })).toHaveTextContent('—')
  })
})

describe('FieldValue links on touch screens', () => {
  const TOUCH = ['pointer-coarse:inline-flex', 'pointer-coarse:min-h-11', 'pointer-coarse:items-center']

  it('gives record, URL, email and file links a 44 px touch target', () => {
    expect(show(field('owner', [{ type: 'LINK', values: { toRecordFromTable: 'person' } }]), { owner: 3 }, { owner: 'Casey Sample' })).toHaveClass(...TOUCH)
    expect(show(field('site', [{ type: 'LINK', values: { target: '_blank' } }]), { site: 'https://example.invalid' })).toHaveClass(...TOUCH)
    expect(show(field('home'), { home: 'https://example.invalid/home' })).toHaveClass(...TOUCH)
    expect(show(field('email'), { email: 'kay@example.invalid' })).toHaveClass(...TOUCH)
    show(field('doc', [{ type: 'FILE_DOWNLOAD' }], { type: 'BLOB' }), { doc: '/data/lab/1/doc/a.txt' }, { doc: 'a.txt' })
    expect(document.querySelector('[data-qqq-id="field-value-doc-open"]')).toHaveClass(...TOUCH)
    expect(document.querySelector('[data-qqq-id="field-value-doc-download"]')).toHaveClass(...TOUCH)
  })

  it('leaves plain text values unchanged', () => {
    expect(show(field('name'), { name: 'Plain' })).not.toHaveClass('pointer-coarse:min-h-11')
  })
})

describe('FieldValue CODE_EDITOR (Material CodeViewer, QRun-IO/qqq#723/#724)', () => {
  const sqlField = field('query', [{ type: 'CODE_EDITOR', values: { languageMode: 'sql' } }], { type: 'TEXT' })
  const sql = "SELECT id, name FROM person WHERE id > 1 AND name = 'A'"

  it('colors the code and formats SQL one clause per line, and back', () => {
    const viewer = show(sqlField, { query: sql })
    const code = viewer.querySelector('code') as HTMLElement
    expect(code.textContent).toBe(sql)
    expect(Array.from(code.querySelectorAll('.qqq-code-keyword')).map((token) => token.textContent)).toEqual(['SELECT', 'FROM', 'WHERE', 'AND'])
    fireEvent.click(screen.getByRole('button', { name: 'Format SQL' }))
    expect(code.textContent).toBe("SELECT\n   id,\n   name\nFROM\n   person\nWHERE\n   id > 1\n   AND name = 'A'")
    fireEvent.click(screen.getByRole('button', { name: 'Reset Format' }))
    expect(code.textContent).toBe(sql)
  })

  it('expands and collapses the code box', () => {
    const viewer = show(sqlField, { query: sql })
    const expand = screen.getByRole('button', { name: 'Expand' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    const box = viewer.querySelector('pre') as HTMLElement
    expect(expand).toHaveAttribute('aria-controls', box.id)
    expect(box.className).toContain('max-h-[200px]')
    fireEvent.click(expand)
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-expanded', 'true')
    expect(box.className).toContain('max-h-[80vh]')
  })

  it('shows a JSON formatting error for five seconds and keeps the text', () => {
    vi.useFakeTimers()
    try {
      const viewer = show(field('config', [{ type: 'CODE_EDITOR', values: { languageMode: 'json' } }]), { config: '{not json' })
      fireEvent.click(screen.getByRole('button', { name: 'Format JSON' }))
      expect(screen.getByRole('alert')).toHaveTextContent(/^Error formatting code:/)
      expect(viewer.querySelector('code')?.textContent).toBe('{not json')
      React.act(() => { vi.advanceTimersByTime(5000) })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers no format button for languages it cannot format', () => {
    show(field('script', [{ type: 'CODE_EDITOR', values: { languageMode: 'javascript' } }]), { script: 'return 1;' })
    expect(screen.queryByRole('button', { name: /^Format/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
  })
})
