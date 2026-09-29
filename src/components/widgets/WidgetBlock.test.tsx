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

// Tests for WidgetBlock chrome: collapsible widgets, icon tiles, the main icon, and labels as page titles

import React, { useContext } from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { QWidgetMetaData } from '@/types'
import { QContext, type QContextType } from '@/lib/context/q-context'
import { WidgetBlock, initialCollapsibleOpenState } from './WidgetBlock'
import { WidgetMetaDataContext } from './widget-context'

const base: QWidgetMetaData = { name: 'accChrome', label: 'Owned Chrome', type: 'html', hasPermission: true, isCard: true }
const collapsible: QWidgetMetaData = {
  ...base, collapsible: { isCollapsible: true, initiallyOpen: false }, showReloadButton: true, showExportButton: true,
  icons: { topRightInsideCard: { name: 'star', color: '#8f00d8' } },
}
const STORAGE_KEY = 'qqq.widget.collapsibleOpenState.accChrome'
const dropdown = { paramName: 'accChoice', label: 'Choice', type: 'POSSIBLE_VALUE_SOURCE' as const, options: [{ id: 'a', label: 'A' }], value: null }

describe('WidgetBlock collapsible widgets', () => {
  beforeEach(() => localStorage.clear())

  it('starts from the remembered state, else initiallyOpen; widgets that are not collapsible are open', () => {
    expect(initialCollapsibleOpenState(base)).toBe(true)
    expect(initialCollapsibleOpenState(collapsible)).toBe(false)
    expect(initialCollapsibleOpenState({ ...collapsible, collapsible: { isCollapsible: true, initiallyOpen: true } })).toBe(true)
    localStorage.setItem(STORAGE_KEY, 'true')
    expect(initialCollapsibleOpenState(collapsible)).toBe(true)
  })

  it('hides the body, footer and header controls when collapsed, and remembers each toggle', async () => {
    const user = userEvent.setup()
    render(
      <WidgetBlock widgetMetaData={{ ...collapsible, footerHTML: 'Owned footer' }} onReload={vi.fn()} onExport={vi.fn()} dropdowns={[dropdown]}>
        <p>Owned body</p>
      </WidgetBlock>
    )
    const toggle = screen.getByRole('button', { name: 'Expand Owned Chrome' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Owned body')).toBeNull()
    expect(screen.queryByText('Owned footer')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reload Owned Chrome' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Export Owned Chrome' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Select Choice' })).toBeNull()
    expect(document.querySelector('[data-qqq-id="widget-icon-topRightInsideCard-accChrome"]')).toBeNull()
    // the label stays
    expect(screen.getByRole('heading', { name: 'Owned Chrome' })).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Collapse Owned Chrome' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Owned body')).toBeInTheDocument()
    expect(screen.getByText('Owned footer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload Owned Chrome' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Select Choice' })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')

    // a click on the header bar toggles, a click on one of its controls does not
    await user.click(screen.getByRole('button', { name: 'Reload Owned Chrome' }))
    expect(screen.getByText('Owned body')).toBeInTheDocument()
    fireEvent.click(document.querySelector('[data-qqq-id="widget-header-accChrome"]')!)
    expect(screen.queryByText('Owned body')).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
    expect(document.querySelector('[data-qqq-id="widget-accChrome"]')).toHaveAttribute('data-collapsed', 'true')
  })

  it('has no toggle for a widget that is not collapsible', () => {
    render(<WidgetBlock widgetMetaData={base}><p>Owned body</p></WidgetBlock>)
    expect(screen.queryByRole('button', { name: /Collapse|Expand/ })).toBeNull()
    fireEvent.click(document.querySelector('[data-qqq-id="widget-header-accChrome"]')!)
    expect(screen.getByText('Owned body')).toBeInTheDocument()
  })
})

describe('WidgetBlock icons', () => {
  it('draws header glyphs in the metadata color and preserves image paths', () => {
    render(
      <WidgetBlock widgetMetaData={{ ...base, icons: { topRightInsideCard: { name: 'sports', color: 'rgb(143, 0, 216)' }, topLeftInsideCard: { path: '/owned-icon.png', color: 'rgb(0, 97, 255)' } } }}>
        <p>Body</p>
      </WidgetBlock>
    )
    const right = document.querySelector('[data-qqq-id="widget-icon-topRightInsideCard-accChrome"]') as HTMLElement
    expect(right).toHaveAttribute('data-icon-name', 'sports')
    expect(right.style.backgroundColor).toBe('')
    expect(right.style.color).toBe('rgb(143, 0, 216)')
    const left = document.querySelector('[data-qqq-id="widget-icon-topLeftInsideCard-accChrome"]') as HTMLElement
    expect(left).toHaveAttribute('data-icon-path', '/owned-icon.png')
    expect(left.querySelector('img')).toHaveAttribute('src', '/owned-icon.png')
    expect(left.style.backgroundColor).toBe('')
  })

  it('draws the main metadata icon as a 64 px tile, any Material name falling back to the shared map', () => {
    render(<WidgetBlock widgetMetaData={{ ...base, icon: 'local_shipping' }}><p>Body</p></WidgetBlock>)
    const tile = document.querySelector('[data-qqq-id="widget-main-icon-accChrome"]') as HTMLElement
    expect(tile).toHaveAttribute('data-icon-name', 'local_shipping')
    expect(tile.className).toContain('h-16')
    expect(tile.className).toContain('w-16')
    expect(tile.style.color).toBe('rgb(255, 255, 255)')
  })
})

describe('WidgetBlock labels', () => {
  it('uses a parent widget label as the page title and keeps the last one while the label is missing', () => {
    const parent: QWidgetMetaData = { ...base, type: 'parentWidget', label: '' }
    const { rerender } = render(<WidgetBlock widgetMetaData={parent} data={{ label: 'Owned Title', isLabelPageTitle: true }}><p>Body</p></WidgetBlock>)
    const title = screen.getByRole('heading', { level: 2, name: 'Owned Title' })
    expect(title).toHaveAttribute('data-page-title', 'true')
    rerender(<WidgetBlock widgetMetaData={parent} data={{}}><p>Body</p></WidgetBlock>)
    expect(screen.getByRole('heading', { level: 2, name: 'Owned Title' })).toBeInTheDocument()
  })

  it('keeps a normal heading for other widgets and when the page-title flag is off', () => {
    render(<WidgetBlock widgetMetaData={base} data={{ label: 'Owned Label', isLabelPageTitle: true }}><p>Body</p></WidgetBlock>)
    expect(screen.getByRole('heading', { level: 3, name: 'Owned Label' })).toBeInTheDocument()
  })

  it('shows the label help, and its key in help-authoring mode', () => {
    const helped = { ...base, helpContent: { label: [{ content: 'Owned <b>help</b>', format: 'HTML' as const }] } }
    const { unmount } = render(<WidgetBlock widgetMetaData={helped}><p>Body</p></WidgetBlock>)
    expect(document.querySelector('[data-qqq-id="button-widget-help-accChrome"]')).toHaveAttribute('aria-label', 'Help for Owned Chrome')
    unmount()
    render(
      <QContext.Provider value={{ helpHelpActive: true } as QContextType}>
        <WidgetBlock widgetMetaData={base}><p>Body</p></WidgetBlock>
      </QContext.Provider>
    )
    // every slot has help in help-authoring mode, carrying its key
    expect(document.querySelector('[data-qqq-id="button-widget-help-accChrome"]')).toBeInTheDocument()
  })

  it('provides the widget metadata to its content', () => {
    let seen: QWidgetMetaData | null = null
    function Probe() {
      seen = useContext(WidgetMetaDataContext)
      return null
    }
    render(<WidgetBlock widgetMetaData={base}><Probe /></WidgetBlock>)
    expect(seen).toMatchObject({ name: 'accChrome' })
  })
})


describe('widget export availability', () => {
  for (const mode of ['generic', 'specialized']) {
    it.each([
      { name: 'permission denied', data: { hasPermission: false } },
      ...(mode === 'specialized' ? [{ name: 'selection required', data: { dropdownNeedsSelectedText: 'Choose a customer' } }] : []),
      { name: 'loading', isLoading: true },
      { name: 'failed reload', isError: true, error: new Error('Reload failed') },
    ])(`hides ${mode} export when $name`, ({ name: _name, ...state }) => {
      render(<WidgetBlock widgetMetaData={{ ...base, showExportButton: true }} {...state}
        onExport={mode === 'generic' ? () => {} : undefined}
        exportControl={mode === 'specialized' ? <button>Export rows</button> : undefined}>
        <p>Private rows</p>
      </WidgetBlock>)
      expect(screen.queryByRole('button', { name: /^Export/ })).toBeNull()
      expect(screen.queryByText('Private rows')).toBeNull()
    })
  }
})


it('exports a parent payload while its children wait for dropdown selection', () => {
  const onExport = vi.fn()
  render(<WidgetBlock widgetMetaData={{ ...base, type: 'parentWidget', showExportButton: true }}
    data={{ dropdownNeedsSelectedText: 'Choose a customer' }} onExport={onExport}>
    <p>Child rows</p>
  </WidgetBlock>)
  expect(screen.getByText('Choose a customer')).toBeVisible()
  expect(screen.queryByText('Child rows')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Export Owned Chrome' }))
  expect(onExport).toHaveBeenCalledOnce()
})
