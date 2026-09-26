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

// Material parity of the statistics, stepper, field value list and USA map widgets (QRun-IO/qqq#728, WID-072)

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render as renderUi, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api/metadata', () => ({
  loadMetaData: vi.fn(async () => ({ tables: { person: { name: 'person', label: 'Person' } }, widgets: {} })),
}))

import type { QWidgetMetaData } from '@/types'
import { QqqStatisticsWidget } from './QqqStatisticsWidgets'
import { QqqFieldValueListWidget, QqqStepperWidget, QqqUsaMapWidget } from './QqqDisplayWidgets'
import { projectUsLatLng, US_MAP_HEIGHT, US_MAP_WIDTH } from './us-map-projection'
import { US_STATES } from './us-states-map'
import { widgetRecord, widgetField } from './widget-field-values'

const meta = (name: string, type: string): QWidgetMetaData => ({ name, label: `Owned ${name}`, type, hasPermission: true })

/**
 * Renders with a query client (value widgets read the cached instance metadata).
 *
 * @param ui - Element to render.
 * @returns The render result.
 */
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderUi(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('statistics (Material StatisticsCard)', () => {
  it('leaves the change row out when the percentage is 0 or absent', () => {
    const { container, rerender } = render(<QqqStatisticsWidget widgetMetaData={meta('flat', 'statistics')} data={{ count: 5, percentageAmount: 0, percentageLabel: 'vs flat' }} />)
    expect(container.querySelector('[data-qqq-id="statistics-count-flat"]')).toHaveTextContent('5')
    expect(container.querySelector('[data-qqq-id="statistics-percentage-flat"]')).toBeNull()
    expect(screen.queryByText('vs flat')).toBeNull()
    rerender(<QueryClientProvider client={new QueryClient()}><QqqStatisticsWidget widgetMetaData={meta('flat', 'statistics')} data={{ count: 5 }} /></QueryClientProvider>)
    expect(container.querySelector('[data-qqq-id="statistics-percentage-flat"]')).toBeNull()
  })

  it('shows a spinner until the count arrives', () => {
    const { container } = render(<QqqStatisticsWidget widgetMetaData={meta('pending', 'statistics')} data={{ countContext: 'owned units', percentageAmount: 3 }} />)
    expect(screen.getByRole('status', { name: 'Loading count' })).toBeInTheDocument()
    expect(container.querySelector('[data-qqq-id="statistics-count-pending"]')).toBeNull()
    expect(container.querySelector('[data-qqq-id="statistics-percentage-pending"]')).toHaveTextContent('+3%')
  })
})

describe('stepper (Material StepperCard)', () => {
  it('uses each step iconOverride and colors its icon and label with colorOverride', () => {
    const { container } = render(<QqqStepperWidget widgetMetaData={meta('steps', 'stepper')} data={{
      activeStep: 1,
      steps: [
        { label: 'Owned done', iconOverride: 'inventory', colorOverride: '#8F00D8' },
        { label: 'Owned now', colorOverride: 'rgb(0, 98, 255)' },
        { label: 'Owned later', iconOverride: 'schedule' },
      ],
    }} />)
    const icon = (index: number) => container.querySelector(`[data-qqq-id="stepper-icon-steps-${index}"]`) as HTMLElement
    const label = (index: number) => container.querySelector(`[data-qqq-id="stepper-label-steps-${index}"]`) as HTMLElement
    expect(icon(0)).toHaveAttribute('data-icon-name', 'inventory')
    expect(icon(0)).toHaveStyle({ color: '#8F00D8' })
    expect(label(0)).toHaveStyle({ color: '#8F00D8' })
    expect(icon(1).tagName.toLowerCase()).toBe('svg')
    expect(icon(1)).toHaveStyle({ color: 'rgb(0, 98, 255)' })
    expect(label(1)).toHaveStyle({ color: 'rgb(0, 98, 255)' })
    expect(icon(2)).toHaveAttribute('data-icon-name', 'schedule')
    expect(label(2)).not.toHaveAttribute('style')
  })
})

describe('field value list (Material ValueUtils.getDisplayValue)', () => {
  it('formats values by type, display format and adornment', async () => {
    const { container } = render(<QqqFieldValueListWidget widgetMetaData={meta('typed', 'fieldValueList')} data={{
      fields: [
        { name: 'active', label: 'Active', type: 'BOOLEAN' },
        { name: 'amount', label: 'Amount', type: 'DECIMAL', displayFormat: '$%,.2f' },
        { name: 'notes', label: 'Notes', type: 'TEXT' },
        { name: 'owner', label: 'Owner', type: 'INTEGER', adornments: [{ type: 'LINK', values: { toRecordFromTable: 'person' } }] },
        { name: 'status', label: 'Status', type: 'STRING', adornments: [{ type: 'CHIP', values: { 'color.done': 'success' } }] },
        { name: 'contact', label: 'Contact', type: 'STRING' },
      ],
      record: { values: { active: true, amount: 1234.5, notes: 'Line one\nLine two', owner: 1, status: 'done', contact: 'owned@example.com' }, displayValues: { owner: 'Owned person', status: 'Done' } },
    }} />)
    const value = (name: string) => container.querySelector(`[data-qqq-id="field-value-typed-${name}"] dd`) as HTMLElement
    expect(value('active')).toHaveTextContent('Yes')
    expect(value('amount')).toHaveTextContent('$1,234.50')
    expect(value('notes').firstElementChild).toHaveClass('whitespace-pre-wrap')
    expect(value('notes')).toHaveTextContent('Line one Line two')
    await waitFor(() => expect(value('owner').querySelector('a')).toHaveAttribute('href', '/app/person/1'))
    expect(value('owner')).toHaveTextContent('Owned person')
    expect(value('status').querySelector('[data-chip-color="success"]')).toHaveTextContent('Done')
    expect(value('contact').querySelector('a')).toHaveAttribute('href', 'mailto:owned@example.com')
  })

  it('keeps display values, shows zero and marks missing values', () => {
    const fields = [widgetField({ name: 'zero', type: 'INTEGER', displayFormat: '%,d' }), widgetField({ name: 'none', type: 'STRING' })]
    expect(widgetRecord({ values: { zero: 0, none: null } }, fields).displayValues).toEqual({ zero: '0' })
    expect(widgetRecord({ values: { zero: 1200 }, displayValues: { zero: 'twelve hundred' } }, fields).displayValues).toEqual({ zero: 'twelve hundred' })
    const { container } = render(<QqqFieldValueListWidget widgetMetaData={meta('plain', 'fieldValueList')} data={{
      fields: [{ name: 'zero', label: 'Zero' }, { name: 'none', label: 'None' }],
      record: { values: { zero: 0 } },
    }} />)
    expect(container.querySelector('[data-qqq-id="field-value-plain-zero"]')).toHaveTextContent('Zero:0')
    expect(container.querySelector('[data-qqq-id="field-value-plain-none"]')).toHaveTextContent('None:—')
  })
})

describe('USA map (Material USMapWidget, jvectormap us_aea)', () => {
  it('projects latitudes and longitudes into the states, Alaska and Hawaii insets', () => {
    const springfield = projectUsLatLng(39.7817, -89.6501)!
    const denver = projectUsLatLng(39.7392, -104.9903)!
    const fairbanks = projectUsLatLng(64.8378, -147.7164)!
    const honolulu = projectUsLatLng(21.3069, -157.8583)!
    expect(denver.x).toBeLessThan(springfield.x)
    expect(fairbanks.y).toBeGreaterThan(440) // the Alaska inset sits bottom left
    expect(fairbanks.x).toBeLessThan(220)
    expect(honolulu.x).toBeGreaterThan(245) // the Hawaii inset
    expect(honolulu.x).toBeLessThan(325)
    expect(projectUsLatLng(48.8566, 2.3522)).toBeNull() // Paris is not on the map
    expect(springfield.x).toBeLessThan(US_MAP_WIDTH)
    expect(springfield.y).toBeLessThan(US_MAP_HEIGHT)
  })

  it('draws every state and DC, then a marker per located entry', async () => {
    expect(US_STATES).toHaveLength(51)
    const { container } = render(<QqqUsaMapWidget widgetMetaData={meta('map', 'usaMap')} data={{
      height: '300px',
      mapMarkerList: [{ name: 'Owned Denver', latitude: 39.7392, longitude: -104.9903 }, { name: 'Owned Paris', latitude: 48.8566, longitude: 2.3522 }],
    }} />)
    await waitFor(() => expect(container.querySelectorAll('[data-qqq-id="usa-map-states-map"] path')).toHaveLength(51))
    expect(container.querySelector('path[data-state-code="CO"]')).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('data-basemap', 'qqq-us-states-map')
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Owned map: 2 locations')
    // a point outside the map is listed but not drawn
    expect(container.querySelectorAll('[data-qqq-id^="usa-map-marker-map-"]')).toHaveLength(1)
    expect(container.querySelector('[data-qqq-id="usa-map-location-map-1"]')).toHaveTextContent('Owned Paris (48.8566, 2.3522)')
  })
})
