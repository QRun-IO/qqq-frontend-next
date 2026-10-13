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

/**
 * FilterBuilder stories — date-first conditions on DATE and DATE_TIME fields: pick dates (not
 * date-times), whole-day ranges, relative presets that stay relative, and an "Include time" switch
 * to exact date-times.
 */
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QFieldMetaData, QFilterCriteria, QQueryFilter, QTableMetaData } from '@/types'
import { emptyFilter } from '@/lib/utils/filter-utils'
import { browserTimeZone, startOfDayWire } from '@/lib/utils/date-range-utils'
import { FilterBuilder } from './FilterBuilder'

const field = (name: string, label: string, type: QFieldMetaData['type']): QFieldMetaData => ({
  name, label, type, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [],
})

const table: QTableMetaData = {
  name: 'order', label: 'Order', isHidden: false, primaryKeyField: 'id', sections: [], capabilities: [], readPermission: true,
  insertPermission: true, editPermission: true, deletePermission: true, usesVariants: false, variantTableLabel: '',
  fields: { number: field('number', 'Order Number', 'STRING'), created: field('created', 'Created', 'DATE_TIME'), due: field('due', 'Due', 'DATE') },
  exposedJoins: [],
}

const zone = browserTimeZone()
const filterOf = (...criteria: QFilterCriteria[]): QQueryFilter => ({ ...emptyFilter(), criteria })

/** A builder that holds its own filter, so every control can be used. */
function Builder({ initial }: { initial: QQueryFilter }) {
  const [filter, setFilter] = useState(initial)
  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="w-[760px] max-w-full rounded-lg border border-border bg-card">
        <FilterBuilder tableMetaData={table} filter={filter} onChange={setFilter} />
      </div>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Query/FilterBuilder dates',
  component: Builder,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Builder>

export default meta
type Story = StoryObj<typeof meta>

/** A new condition on a DATE_TIME field: dates, not date-times. */
export const DateFirst: Story = {
  args: { initial: filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] }) },
}

/** A whole-day range: Oct 1 to Oct 12 is `>=` Oct 1 00:00 and `<` Oct 13 00:00 in the user's zone. */
export const BetweenDays: Story = {
  args: {
    initial: filterOf(
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [startOfDayWire('2026-10-01', zone)] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [startOfDayWire('2026-10-13', zone)] },
    ),
  },
}

/** A relative range stays relative: it is stored as StartOfPeriod expressions, so it moves with the calendar. */
export const RelativePreset: Story = {
  args: {
    initial: filterOf(
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: -6 }] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: 1 }] },
    ),
  },
}

/** "Include time" gives exact date-time pickers, for the cases that need them. */
export const IncludeTime: Story = {
  args: { initial: filterOf({ fieldName: 'created', operator: 'BETWEEN', values: ['2026-10-01T08:30', '2026-10-12T17:00'] }) },
}

/** DATE fields get the same comparisons and presets, without the time switch. */
export const DateField: Story = {
  args: { initial: filterOf({ fieldName: 'due', operator: 'BETWEEN', values: ['2026-10-01', '2026-10-12'] }) },
}
