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

import { afterEach, describe, expect, it } from 'vitest'

import type { QInstance, QTableMetaData, QTableSection } from '@/types'
import {
  collapsibleSectionStorageKey, gridSpanClasses, initialSectionOpen, isCollapsibleSection, recordViewActionsPlacement, recordViewSections,
  showRecordSidebar, storeSectionOpen, twelfths,
} from './record-layout-utils'

function section(name: string, extra: Partial<QTableSection> = {}): QTableSection {
  return { name, label: name, fieldNames: [], isHidden: false, ...extra }
}

function table(extra: Partial<QTableMetaData> = {}): QTableMetaData {
  return { name: 'lab', label: 'Lab', sections: [], fields: {}, ...extra } as unknown as QTableMetaData
}

afterEach(() => window.localStorage.clear())

describe('record view layout from metadata', () => {
  it('replaces a section by its RECORD_VIEW alternative and keeps the others', () => {
    const alternative = section('details', { label: 'Details For Viewing', fieldNames: ['b'] })
    const sections = recordViewSections(table({ sections: [section('identity'), section('details', { fieldNames: ['a'], alternatives: { RECORD_VIEW: alternative, RECORD_EDIT: section('x') } })] }))
    expect(sections.map((s) => s.label)).toEqual(['identity', 'Details For Viewing'])
    expect(sections[1].fieldNames).toEqual(['b'])
  })

  it('opens a collapsible section from storage first, then initiallyOpen; others are always open', () => {
    const closed = section('archive', { collapsible: { isCollapsible: true, initiallyOpen: false } })
    const open = section('details', { collapsible: { isCollapsible: true, initiallyOpen: true } })
    expect(isCollapsibleSection(closed)).toBe(true)
    expect(isCollapsibleSection(section('plain', { collapsible: { isCollapsible: false, initiallyOpen: false } }))).toBe(false)
    expect(initialSectionOpen('lab', closed)).toBe(false)
    expect(initialSectionOpen('lab', open)).toBe(true)
    expect(initialSectionOpen('lab', section('plain', { collapsible: { isCollapsible: false, initiallyOpen: false } }))).toBe(true)

    storeSectionOpen('lab', 'archive', true)
    expect(window.localStorage.getItem(collapsibleSectionStorageKey('lab', 'archive'))).toBe('true')
    expect(collapsibleSectionStorageKey('lab', 'archive')).toBe('qqq.recordView.collapsibleSectionOpenStates.lab.archive')
    expect(initialSectionOpen('lab', closed)).toBe(true)
    storeSectionOpen('lab', 'details', false)
    expect(initialSectionOpen('lab', open)).toBe(false)
  })

  it('shows the record sidebar unless the table turns it off', () => {
    expect(showRecordSidebar(table())).toBe(true)
    expect(showRecordSidebar(table({ supplementalMetaData: { materialDashboard: { showRecordSidebar: true } } }))).toBe(true)
    expect(showRecordSidebar(table({ supplementalMetaData: { materialDashboard: { showRecordSidebar: false } } }))).toBe(false)
  })

  it('places actions by the instance setting, then the table\'s, then in the identity section', () => {
    const inline = table({ supplementalMetaData: { materialDashboard: { recordViewActionsPlacement: 'INLINE_WITH_PAGE_TITLE' } } })
    const instance = (placement?: string) => ({ supplementalInstanceMetaData: { materialDashboard: { recordViewActionsPlacement: placement } } }) as unknown as QInstance
    expect(recordViewActionsPlacement(undefined, table())).toBe('IN_IDENTITY_SECTION')
    expect(recordViewActionsPlacement(undefined, inline)).toBe('INLINE_WITH_PAGE_TITLE')
    expect(recordViewActionsPlacement(instance('IN_IDENTITY_SECTION'), inline)).toBe('IN_IDENTITY_SECTION')
    expect(recordViewActionsPlacement(instance('INLINE_WITH_PAGE_TITLE'), table())).toBe('INLINE_WITH_PAGE_TITLE')
    expect(recordViewActionsPlacement(instance(undefined), inline)).toBe('INLINE_WITH_PAGE_TITLE')
    expect(recordViewActionsPlacement(instance('SIDEWAYS'), table())).toBe('IN_IDENTITY_SECTION')
  })

  it('reads gridColumns as twelfths of a 12-column grid', () => {
    expect(twelfths(6)).toBe(6)
    expect(twelfths(0)).toBeUndefined()
    expect(twelfths(13)).toBeUndefined()
    expect(twelfths(undefined)).toBeUndefined()
    expect(gridSpanClasses(4)).toBe('col-span-12 min-w-0 lg:col-span-4')
    expect(gridSpanClasses(99)).toBe('col-span-12 min-w-0 lg:col-span-12')
  })
})
