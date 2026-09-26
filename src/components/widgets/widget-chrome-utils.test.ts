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

// Tests for the widget chrome helpers: Material grid sizes, slot help, dropdown dates and timeframes

import { describe, it, expect } from 'vitest'

import type { QWidgetMetaData } from '@/types'
import {
  customTimeframeValue, formatDropdownDate, isoDay, localDateTimeToUtc, normalizeDropdownDate, parseCustomTimeframe,
  parseDropdownDate, utcToLocalDateTime, widgetColumnClasses, widgetHelpKey, widgetSlotHelp,
} from './widget-utils'

describe('widgetColumnClasses with Material per-breakpoint sizes', () => {
  it('keeps the gridColumns sizing when no sizeClass is declared', () => {
    expect(widgetColumnClasses(6, { other: 1 })).toBe('col-span-12 min-w-0 lg:col-span-6')
  })

  it('sizes from the declared breakpoints at Material widths, xs defaulting to 12 and xxl to gridColumns', () => {
    expect(widgetColumnClasses(4, { 'gridCols:sizeClass:md': 6 })).toBe('col-span-12 min-[768px]:col-span-6 min-[1400px]:col-span-4 min-w-0')
    expect(widgetColumnClasses(undefined, { 'gridCols:sizeClass:xs': '6', 'gridCols:sizeClass:lg': 3, 'gridCols:sizeClass:xxl': 2 }))
      .toBe('col-span-6 min-[992px]:col-span-3 min-[1400px]:col-span-2 min-w-0')
    expect(widgetColumnClasses(undefined, { 'gridCols:sizeClass:sm': 4, 'gridCols:sizeClass:xl': 8 }))
      .toBe('col-span-12 min-[576px]:col-span-4 min-[1200px]:col-span-8 min-[1400px]:col-span-12 min-w-0')
  })

  it('ignores unusable sizes', () => {
    expect(widgetColumnClasses(5, { 'gridCols:sizeClass:md': 40, 'gridCols:sizeClass:lg': 'wide' })).toBe('col-span-12 min-w-0 lg:col-span-5')
  })
})

describe('widgetSlotHelp', () => {
  const widget: QWidgetMetaData = {
    name: 'accHelpSlots', label: 'Help Slots', hasPermission: true,
    helpContent: {
      label: [{ content: 'Label help' }],
      sectionSubhead: [{ content: 'Edit help', roles: ['EDIT_SCREEN'] }, { content: 'View help', roles: ['VIEW_SCREEN'] }],
      'ownedBlock,number': [{ content: '<b>Number</b> help', format: 'HTML' }],
    },
  }

  it('chooses the slot entry for the screen roles', () => {
    expect(widgetSlotHelp(widget, 'label')?.content).toBe('Label help')
    expect(widgetSlotHelp(widget, 'sectionSubhead', ['VIEW_SCREEN'])?.content).toBe('View help')
    expect(widgetSlotHelp(widget, 'sectionSubhead', ['EDIT_SCREEN'])?.content).toBe('Edit help')
    expect(widgetSlotHelp(widget, 'ownedBlock,number')).toEqual({ content: '<b>Number</b> help', format: 'HTML' })
    expect(widgetSlotHelp(widget, 'top')).toBeUndefined()
    expect(widgetSlotHelp(undefined, 'label')).toBeUndefined()
  })

  it('reads the single-content shape as the label slot', () => {
    const single = { ...widget, helpContent: { content: 'Only help' } } as QWidgetMetaData
    expect(widgetSlotHelp(single, 'label')?.content).toBe('Only help')
    expect(widgetSlotHelp(single, 'sectionSubhead')).toBeUndefined()
  })

  it('shows every slot with its key in help-authoring mode', () => {
    expect(widgetHelpKey('accHelpSlots', 'top')).toBe('widget:accHelpSlots;slot:top')
    expect(widgetSlotHelp(widget, 'top', ['VIEW_SCREEN'], true)?.content).toBe('[widget:accHelpSlots;slot:top]')
    expect(widgetSlotHelp(widget, 'label', ['VIEW_SCREEN'], true)?.content).toBe('Label help [widget:accHelpSlots;slot:label]')
  })
})

describe('dropdown dates', () => {
  it('formats a day as toLocaleDateString and reads it back, also from an ISO day', () => {
    const day = new Date(2025, 11, 31)
    expect(formatDropdownDate(day)).toBe(day.toLocaleDateString())
    expect(parseDropdownDate(formatDropdownDate(day))?.getTime()).toBe(day.getTime())
    expect(parseDropdownDate('2025-12-31')?.getTime()).toBe(day.getTime())
    expect(isoDay(day)).toBe('2025-12-31')
    expect(normalizeDropdownDate('2025-12-31')).toBe(day.toLocaleDateString())
  })

  it('rejects values that are not dates', () => {
    expect(parseDropdownDate('')).toBeNull()
    expect(parseDropdownDate(null)).toBeNull()
    expect(parseDropdownDate('not a date')).toBeNull()
    expect(parseDropdownDate('99/99/9999')).toBeNull()
    expect(normalizeDropdownDate('someday')).toBe('someday')
  })
})

describe('custom timeframes', () => {
  it('converts local date-times to the UTC form Material sends, and back', () => {
    const local = '2026-09-01T08:00'
    const utc = localDateTimeToUtc(local)!
    expect(utc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/)
    expect(new Date(utc).getTime()).toBe(new Date(local).getTime())
    expect(utcToLocalDateTime(utc)).toBe(local)
    expect(localDateTimeToUtc('')).toBeNull()
    expect(utcToLocalDateTime(undefined)).toBe('')
  })

  it('builds custom,<utcStart>,<utcEnd> only when both ends are set, and parses it back', () => {
    expect(customTimeframeValue('2026-09-01T08:00', '')).toBeNull()
    const value = customTimeframeValue('2026-09-01T08:00', '2026-09-02T17:30')!
    expect(value).toBe(`custom,${localDateTimeToUtc('2026-09-01T08:00')},${localDateTimeToUtc('2026-09-02T17:30')}`)
    expect(parseCustomTimeframe(value)).toEqual({ start: '2026-09-01T08:00', end: '2026-09-02T17:30' })
    expect(parseCustomTimeframe('week')).toBeNull()
    expect(parseCustomTimeframe(null)).toBeNull()
  })
})
