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

import { describe, expect, it } from 'vitest'

import type { QFieldMetaData, QTableMetaData } from '@/types'
import { applyAdjustedDefinitions, fieldFormAdjusters, hasTableOnLoadAdjuster, tableFieldRules } from './form-adjuster-utils'

function field(name: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label: name, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra }
}

function table(extra: Partial<QTableMetaData> = {}): QTableMetaData {
  return {
    name: 'lab', label: 'Lab', isHidden: false, primaryKeyField: 'id',
    fields: { id: field('id', { type: 'INTEGER' }), size: field('size'), note: field('note') },
    sections: [{ name: 'main', label: 'Main', isHidden: false, fieldNames: ['size', 'note'] }, { name: 'extra', label: 'Extra', isHidden: true, fieldNames: [] }],
    capabilities: [], exposedJoins: [], readPermission: true, insertPermission: true, editPermission: true, deletePermission: true,
    usesVariants: false, variantTableLabel: '',
    ...extra,
  }
}

describe('form adjuster metadata (QRun-IO/qqq#720)', () => {
  it('reads a field\'s adjusters from the v1 or the legacy supplemental key', () => {
    const settings = { formAdjusterIdentifier: 'lab:size', onChangeFormAdjuster: { name: 'x' }, fieldsToDisableWhileRunningAdjusters: ['note', 7] }
    expect(fieldFormAdjusters(field('size', { supplementalMetaData: { materialDashboard: settings } })))
      .toEqual({ identifier: 'lab:size', onChange: true, onLoad: false, fieldsToDisableWhileRunning: ['note'] })
    expect(fieldFormAdjusters(field('size', { supplementalFieldMetaData: { materialDashboard: { ...settings, onLoadFormAdjuster: {} } } })))
      .toMatchObject({ onChange: true, onLoad: true })
  })

  it('ignores adjusters without an identifier, and fields without adjusters', () => {
    expect(fieldFormAdjusters(field('size', { supplementalMetaData: { materialDashboard: { onChangeFormAdjuster: {} } } }))).toBeUndefined()
    expect(fieldFormAdjusters(field('size', { supplementalMetaData: { materialDashboard: { formAdjusterIdentifier: 'x' } } }))).toBeUndefined()
    expect(fieldFormAdjusters(field('size'))).toBeUndefined()
  })

  it('reads the table\'s on-load adjuster and field rules', () => {
    const rules = [
      { trigger: 'ON_CHANGE', sourceField: 'size', action: 'CLEAR_TARGET_FIELD', targetField: 'note' },
      { trigger: 'ON_CHANGE', sourceField: 'size', action: 'RELOAD_WIDGET', targetWidget: 'labWidget' },
      { trigger: 'ON_CHANGE', action: 'CLEAR_TARGET_FIELD' },
    ]
    const withRules = table({ supplementalMetaData: { materialDashboard: { fieldRules: rules, onLoadFormAdjuster: { name: 'x' } } } })
    expect(hasTableOnLoadAdjuster(withRules)).toBe(true)
    expect(hasTableOnLoadAdjuster(table())).toBe(false)
    expect(tableFieldRules(withRules)).toEqual(rules.slice(0, 2))
    expect(tableFieldRules(table({ supplementalTableMetaData: { materialDashboard: { fieldRules: rules } } }))).toHaveLength(2)
  })

  it('replaces the table\'s fields and sections an adjuster updates, and only those', () => {
    const start = table()
    const adjusted = applyAdjustedDefinitions(start, {
      updatedFieldMetaData: { note: field('note', { label: 'Notes', isRequired: true, adornments: undefined as never }), unknown: field('unknown') },
      updatedSectionMetaData: { extra: { name: 'extra', label: 'More', isHidden: false, fieldNames: ['note'] }, missing: { name: 'missing', label: 'x', isHidden: false, fieldNames: [] } },
    })
    expect(adjusted.fields.note).toMatchObject({ label: 'Notes', isRequired: true, adornments: [] })
    expect(adjusted.fields.unknown).toBeUndefined()
    expect(adjusted.sections.map((section) => [section.name, section.label, section.isHidden])).toEqual([['main', 'Main', false], ['extra', 'More', false]])
    expect(start.fields.note.label).toBe('note')
    expect(applyAdjustedDefinitions(start, { updatedFieldValues: { note: 'x' } })).toBe(start)
  })
})
