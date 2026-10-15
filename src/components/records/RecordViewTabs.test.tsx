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

import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QRecord, QTableMetaData } from '@/types'

vi.mock('@/lib/hooks/use-media-query', async (original) => ({ ...(await original<typeof import('@/lib/hooks/use-media-query')>()), useMediaQuery: () => false }))

import { RecordViewTabs } from './RecordViewTabs'

const tabs = [{ id: 'overview', label: 'Overview' }, ...Array.from({ length: 12 }, (_, index) => ({ id: `section-${index}`, label: `Section ${index}` }))]
const table = { name: 'thing', label: 'Thing', primaryKeyField: 'id', fields: {}, sections: [] } as unknown as QTableMetaData

/** Renders the tab bar with local selection state. */
function Harness() {
  const [activeTab, setActiveTab] = useState('overview')
  return (
    <RecordViewTabs tableMetaData={table} record={{ values: {} } as unknown as QRecord} tabs={tabs} activeTab={activeTab}
      setActiveTab={setActiveTab} secondarySections={[]} tertiarySections={[]} associations={[]} renderAssociation={() => null}
      navigateFrom={{ path: '/app/thing', label: 'Thing' }} />
  )
}

afterEach(cleanup)

describe('RecordViewTabs tab bar (md and wider)', () => {
  it('keeps every section as a tab and wraps instead of scrolling sideways', () => {
    render(<Harness />)
    const tablist = screen.getByRole('tablist')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(tabs.map((tab) => tab.label))
    expect(tablist.className).toContain('flex-wrap')
    expect(tablist.className).not.toMatch(/overflow-(?:x-)?(?:auto|scroll)/)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).not.toContain('whitespace-nowrap')
    }
  })

  it('moves focus with the arrow, Home and End keys and activates with Enter', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const overview = screen.getByRole('tab', { name: 'Overview' })
    overview.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Section 0' })).toHaveFocus()
    expect(overview).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('tab', { name: 'Section 0' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Section 11' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(overview).toHaveFocus()
  })

  it('opens any section by tap, including the last one', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('tab', { name: 'Section 11' }))
    expect(screen.getByRole('tab', { name: 'Section 11' })).toHaveAttribute('aria-selected', 'true')
  })
})
