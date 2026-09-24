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
import type { QTableMetaData, QRecord } from '@/types'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { prepareCopyTree, copyTreePayload, copyTableNames } from './copy-tree'

function fixture() {
  const parent = structuredClone(qInstance.tables.person)
  parent.fields = { id: parent.fields.id, firstName: parent.fields.firstName }
  const child: QTableMetaData = { ...structuredClone(parent), name: 'child', label: 'Child', primaryKeyField: 'key', fields: {
    key: { ...parent.fields.firstName, name: 'key', label: 'New child key', isRequired: true },
    owner: { ...parent.fields.id, name: 'owner', isEditable: true, isRequired: true },
    firstName: parent.fields.firstName,
  }, associations: [] }
  parent.associations = ['care / first', 'care second'].map(name => ({ name, associatedTableName: 'child', join: {
    name: 'sharedJoin', leftTable: 'person', rightTable: 'child', type: 'ONE_TO_MANY', joinOns: [{ leftField: 'id', rightField: 'owner' }],
  } }))
  const source: QRecord = { tableName: 'person', values: { id: 1, firstName: 'Parent' }, associatedRecords: {
    'care / first': [{ tableName: 'child', values: { key: 'old', owner: 1, firstName: 'Child' } }],
    'care second': [],
  } }
  return { parent, child, source, tables: { person: parent, child } }
}

describe('Full copy draft', () => {
  it('retains exact paths/empty groups, clears keys and assigned fields, and keeps manual edits without mutating source', () => {
    const f = fixture(); const original = structuredClone(f)
    const tree = prepareCopyTree(f.parent, f.source, f.tables)
    const child = tree.groups['care / first'][0]
    expect(child.values).toEqual({ key: '', firstName: 'Child' })
    expect(() => copyTreePayload(tree, {})).toThrow(/New child key/)
    const edits = { [child.path]: { key: 'fresh/manual', firstName: 'Edited' } }
    expect(copyTreePayload(tree, edits)).toEqual({ 'care / first': [{ values: edits[child.path] }], 'care second': [] })
    expect(f).toEqual(original)
  })
  it('blocks absent groups, missing editable values, metadata and denied child INSERT', () => {
    const f = fixture()
    expect(() => prepareCopyTree(f.parent, { ...f.source, associatedRecords: {} }, f.tables)).toThrow(/care \/ first/)
    expect(() => prepareCopyTree(f.parent, f.source, { person: f.parent })).toThrow(/metadata/)
    delete f.source.associatedRecords!['care / first'][0].values.firstName
    expect(() => prepareCopyTree(f.parent, f.source, f.tables)).toThrow(/source/)
    f.child.insertPermission = false
    expect(() => prepareCopyTree(f.parent, f.source, f.tables)).toThrow(/create/)
  })
  it('allows an empty group without child INSERT and rejects unknown groups rather than pruning', () => {
    const f = fixture(); f.source.associatedRecords!['care / first'] = []; f.child.insertPermission = false
    expect(copyTreePayload(prepareCopyTree(f.parent, f.source, f.tables), {})).toEqual({ 'care / first': [], 'care second': [] })
    f.source.associatedRecords!.unknown = []
    expect(() => prepareCopyTree(f.parent, f.source, f.tables)).toThrow(/unknown/)
  })
  it('bounds actual expanded data by depth and count before loading metadata', () => {
    const f = fixture(); const source = f.source
    source.associatedRecords!['care / first'] = Array.from({ length: 1001 }, () => ({ tableName: 'child', values: {} }))
    expect(() => copyTableNames(source)).toThrow(/1000/)
    source.associatedRecords = { loop: [source] }
    expect(() => copyTableNames(source)).toThrow(/64/)
  })
  it('preserves reverse composite assignments and rejects a cleared prospective non-PK relationship', () => {
    const f = fixture()
    f.parent.associations = [f.parent.associations![0]]
    f.source.associatedRecords = { 'care / first': f.source.associatedRecords!['care / first'] }
    f.parent.associations[0].join = { name: 'reverse', leftTable: 'child', rightTable: 'person', type: 'MANY_TO_ONE',
      joinOns: [{ leftField: 'owner', rightField: 'id' }, { leftField: 'region', rightField: 'firstName' }] }
    f.child.fields.region = { ...f.child.fields.firstName, name: 'region' }
    f.source.associatedRecords['care / first'][0].values.region = 'Parent'
    const tree = prepareCopyTree(f.parent, f.source, f.tables)
    const node = tree.groups['care / first'][0]
    const edits = { [node.path]: { key: 'new', firstName: 'Child', region: 'forged', owner: 77 } }
    expect(copyTreePayload(tree, edits, { firstName: 'Changed' })['care / first'][0].values).toEqual({ key: 'new', firstName: 'Child' })
    expect(() => copyTreePayload(tree, edits, { firstName: null })).toThrow(/relationship/)
  })
  it('copies binary bytes and read-only filename companions without defaulting explicit nulls', async () => {
    const f = fixture()
    f.child.fields.blob = { ...f.child.fields.firstName, name: 'blob', type: 'BLOB', adornments: [{ type: 'FILE_DOWNLOAD', values: { fileNameField: 'filename', defaultMimeType: 'image/png' } }] }
    f.child.fields.filename = { ...f.child.fields.firstName, name: 'filename', isEditable: false }
    f.child.fields.optional = { ...f.child.fields.firstName, name: 'optional', isRequired: false, defaultValue: 'default' }
    const record = f.source.associatedRecords!['care / first'][0]
    Object.assign(record.values, { blob: 'AID/', filename: 'photo.png', optional: null })
    const tree = prepareCopyTree(f.parent, f.source, f.tables)
    const node = tree.groups['care / first'][0]
    const result = copyTreePayload(tree, { [node.path]: { ...node.values, key: 'new' } })['care / first'][0]
    const file = result.values.blob as File
    expect(file.name).toBe('photo.png'); expect(file.type).toBe('image/png')
    expect(await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer))); reader.readAsArrayBuffer(file) })).toEqual([0, 128, 255])
    expect(result.values).toMatchObject({ filename: 'photo.png', optional: null })
    expect(record.values.blob).toBe('AID/')
  })
  it('keeps repeated source identities as two independent named paths', () => {
    const f = fixture()
    f.source.associatedRecords!['care second'] = f.source.associatedRecords!['care / first']
    const tree = prepareCopyTree(f.parent, f.source, f.tables)
    const a = tree.groups['care / first'][0], b = tree.groups['care second'][0]
    expect(a.path).not.toBe(b.path)
    const payload = copyTreePayload(tree, { [a.path]: { key: 'one', firstName: 'One' }, [b.path]: { key: 'two', firstName: 'Two' } })
    expect(payload['care / first'][0].values.key).toBe('one')
    expect(payload['care second'][0].values.key).toBe('two')
  })

  it('does not copy masked child passwords, including masks of stored nulls', () => {
    const f = fixture()
    f.child.fields.secret = { ...f.child.fields.firstName, name: 'secret', label: 'Child secret', type: 'PASSWORD', isRequired: false }
    f.source.associatedRecords!['care / first'][0].values.secret = '********'
    const tree = prepareCopyTree(f.parent, f.source, f.tables), node = tree.groups['care / first'][0]
    expect(node.values.secret).toBe('')
    expect(() => copyTreePayload(tree, { [node.path]: { ...node.values, key: 'fresh' } })).toThrow(/Child secret/)
    expect(copyTreePayload(tree, { [node.path]: { ...node.values, key: 'fresh', secret: 'new-value' } })['care / first'][0].values.secret).toBe('new-value')
  })

})
