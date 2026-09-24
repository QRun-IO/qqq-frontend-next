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
import type { QAssociation } from '@/types'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { associationWidgetBinding, resolveAssociationValues } from './association-utils'

function fixture() {
  const parent = structuredClone(qInstance.tables.person)
  const child = { ...structuredClone(qInstance.tables.company), name: 'pet' }
  parent.fields.zone = { ...parent.fields.id, name: 'zone', type: 'BOOLEAN' as const }
  child.fields.owner = { ...parent.fields.id, name: 'owner' }
  child.fields.region = { ...parent.fields.zone, name: 'region' }
  const association: QAssociation = { name: 'scheduled / reviews', associatedTableName: 'pet', join: {
    name: 'bySchedule', leftTable: 'person', rightTable: 'pet', type: 'ONE_TO_MANY',
    joinOns: [{ leftField: 'id', rightField: 'owner' }, { leftField: 'zone', rightField: 'region' }],
  } }
  return { parent, child, association, record: { tableName: 'person', values: { id: 0, zone: false } } }
}

describe('Exact association values', () => {
  it('preserves all forward and reverse join pairs, zero/false and input objects', () => {
    const f = fixture()
    const before = structuredClone(f)
    expect(resolveAssociationValues(f.association, f.parent, f.record, f.child)).toEqual({ values: { owner: 0, region: false }, reverse: false })
    const reverse: QAssociation = { ...f.association, join: { ...f.association.join,
      leftTable: 'pet', rightTable: 'person', type: 'MANY_TO_ONE',
      joinOns: [{ leftField: 'owner', rightField: 'id' }, { leftField: 'region', rightField: 'zone' }],
    } }
    expect(resolveAssociationValues(reverse, f.parent, f.record, f.child)).toEqual({ values: { owner: 0, region: false }, reverse: true })
    expect(f).toEqual(before)
  })

  it('uses a non-PK parent field without PVS discovery', () => {
    const f = fixture()
    f.association.join.joinOns = [{ leftField: 'zone', rightField: 'region' }]
    expect(resolveAssociationValues(f.association, f.parent, f.record, f.child)).toEqual({ values: { region: false }, reverse: false })
  })

  it.each([undefined, null, '', {}, NaN])('rejects missing or unserializable relationship values: %j', (value) => {
    const f = fixture()
    expect(resolveAssociationValues(f.association, f.parent, { ...f.record, values: { id: value, zone: false } }, f.child)).toHaveProperty('error')
  })

  it('rejects unrelated/empty joins, missing personalized fields and conflicting assignments', () => {
    const f = fixture()
    const resolve = () => resolveAssociationValues(f.association, f.parent, f.record, f.child)
    delete f.child.fields.owner
    expect(resolve()).toHaveProperty('error')
    f.association.join.joinOns = []
    expect(resolve()).toHaveProperty('error')
    f.association.join.joinOns = [{ leftField: 'id', rightField: 'region' }, { leftField: 'zone', rightField: 'region' }]
    expect(resolve()).toHaveProperty('error')
    f.association.join.leftTable = 'other'
    expect(resolve()).toHaveProperty('error')
  })

  it('uses only known explicit widget names, preserving arbitrary group strings', () => {
    const base = { name: 'companionPanel', label: 'Companions', hasPermission: true }
    expect(associationWidgetBinding({ ...base, type: 'childRecordList', defaultValues: { manageAssociationName: 'care / primary' } })).toEqual({ name: 'care / primary' })
    expect(associationWidgetBinding({ ...base, type: 'rowBuilder', defaultValues: { associationName: 'scheduled reviews' } })).toEqual({ name: 'scheduled reviews' })
    expect(associationWidgetBinding({ ...base, type: 'chart', defaultValues: { associationName: 'unrelated' } })).toBeUndefined()
    expect(associationWidgetBinding({ ...base, type: 'childRecordList' })).toBeUndefined()
    expect(associationWidgetBinding({ ...base, type: 'childRecordList', defaultValues: { manageAssociationName: 'a', associationName: 'b' } })).toHaveProperty('error')
  })
})
