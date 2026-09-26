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

// Tests for widget help slots other than the label: block slot fallback, setup widget subheads, cron top

import React from 'react'
import { beforeAll, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })) }))

import type { QRecord, QWidgetMetaData } from '@/types'
import { QContext, type QContextType } from '@/lib/context/q-context'
import { BlockSlot, blockHelpSlot } from './blocks/BlockSlot'
import { CronUIWidget } from './CronUIWidget'
import { FilterAndColumnsSetupWidget } from './FilterAndColumnsSetupWidget'
import { PivotTableSetupWidget } from './PivotTableSetupWidget'
import { WidgetSlotHelp } from './WidgetSlotHelp'
import { WidgetMetaDataContext } from './widget-context'

beforeAll(() => {
  // Radix tooltips measure their trigger; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const helped: QWidgetMetaData = {
  name: 'accHelpSlots', label: 'Owned Help Slots', hasPermission: true,
  helpContent: {
    'ownedBlock,number': [{ content: 'Owned <b>number</b> help', format: 'HTML' }],
    context: [{ content: 'Owned context help' }],
    sectionSubhead: [{ content: 'Owned subhead help', roles: ['VIEW_SCREEN'] }],
    top: [{ content: 'Owned schedule help' }],
  },
}

describe('block slot help fallback (Material BlockElementWrapper)', () => {
  it('keys slot help by blockId,slot, else the slot', () => {
    expect(blockHelpSlot({ blockId: 'ownedBlock' }, 'number')).toBe('ownedBlock,number')
    expect(blockHelpSlot({}, 'context')).toBe('context')
  })

  it('describes a slot without a tooltip with its help content', () => {
    render(
      <WidgetMetaDataContext.Provider value={helped}>
        <BlockSlot block={{ blockId: 'ownedBlock' }} slot="number"><span>42</span></BlockSlot>
        <BlockSlot block={{}} slot="context"><span>vs last week</span></BlockSlot>
        <BlockSlot block={{}} slot="heading"><span>No help here</span></BlockSlot>
      </WidgetMetaDataContext.Provider>
    )
    const number = screen.getByText('42').closest('[data-block-slot]')!
    expect(number).toHaveAttribute('tabindex', '0')
    expect(document.getElementById(number.getAttribute('aria-describedby')!)).toHaveTextContent('Owned number help')
    const context = screen.getByText('vs last week').closest('[data-block-slot]')!
    expect(document.getElementById(context.getAttribute('aria-describedby')!)).toHaveTextContent('Owned context help')
    expect(screen.getByText('No help here').closest('[data-block-slot]')).not.toHaveAttribute('aria-describedby')
  })

  it('prefers the block tooltip over the help content', () => {
    render(
      <WidgetMetaDataContext.Provider value={helped}>
        <BlockSlot block={{ blockId: 'ownedBlock', tooltip: { title: 'Owned tooltip' } }} slot="number"><span>42</span></BlockSlot>
      </WidgetMetaDataContext.Provider>
    )
    const number = screen.getByText('42').closest('[data-block-slot]')!
    expect(document.getElementById(number.getAttribute('aria-describedby')!)).toHaveTextContent('Owned tooltip')
  })

  it('shows every slot key in help-authoring mode', () => {
    render(
      <QContext.Provider value={{ helpHelpActive: true } as QContextType}>
        <WidgetMetaDataContext.Provider value={helped}>
          <BlockSlot block={{}} slot="heading"><span>Heading</span></BlockSlot>
        </WidgetMetaDataContext.Provider>
      </QContext.Provider>
    )
    const heading = screen.getByText('Heading').closest('[data-block-slot]')!
    expect(document.getElementById(heading.getAttribute('aria-describedby')!)).toHaveTextContent('[widget:accHelpSlots;slot:heading]')
  })
})

describe('setup and schedule widget help slots', () => {
  const report: QRecord = { tableName: 'savedReport', values: { id: 1, tableName: 'person', queryFilterJson: '{}', pivotTableJson: JSON.stringify({ rows: [{ fieldName: 'id' }] }) } }

  it('shows the sectionSubhead help above the filter and columns', () => {
    render(<FilterAndColumnsSetupWidget widgetMetaData={helped} data={{}} recordContext={{ tableName: 'savedReport', record: report }} />)
    const help = document.querySelector('[data-qqq-id="widget-help-sectionSubhead-accHelpSlots"]')
    expect(help).toHaveTextContent('Owned subhead help')
    expect(help).toHaveAttribute('data-help-key', 'widget:accHelpSlots;slot:sectionSubhead')
  })

  it('shows the sectionSubhead help above the pivot table definition', () => {
    render(<PivotTableSetupWidget widgetMetaData={helped} data={{}} recordContext={{ tableName: 'savedReport', record: report }} />)
    expect(document.querySelector('[data-qqq-id="widget-help-sectionSubhead-accHelpSlots"]')).toHaveTextContent('Owned subhead help')
  })

  it('shows the cron widget top help', () => {
    render(<CronUIWidget widgetMetaData={helped} data={{ cronDescription: 'Every day' }} />)
    expect(document.querySelector('[data-qqq-id="widget-help-top-accHelpSlots"]')).toHaveTextContent('Owned schedule help')
  })

  it('renders nothing for a slot without help, and the key in help-authoring mode', () => {
    const { container } = render(<WidgetSlotHelp widgetMetaData={helped} slot="modalSubheader" />)
    expect(container).toBeEmptyDOMElement()
    render(
      <QContext.Provider value={{ helpHelpActive: true } as QContextType}>
        <WidgetSlotHelp widgetMetaData={helped} slot="modalSubheader" />
      </QContext.Provider>
    )
    expect(document.querySelector('[data-qqq-id="widget-help-modalSubheader-accHelpSlots"]')).toHaveTextContent('[widget:accHelpSlots;slot:modalSubheader]')
  })
})
