// Tests for Zod schema builders from QQQ metadata

import { describe, it, expect } from 'vitest'
import { zodFieldFromMetadata, zodSchemaFromTableMetadata, zodSchemaFromFields, defaultValuesFromRecord } from './zod-from-metadata'
import type { QFieldMetaData, QTableMetaData } from '@/types'

function makeField(overrides: Partial<QFieldMetaData>): QFieldMetaData {
  return {
    name: 'testField',
    label: 'Test Field',
    type: 'STRING',
    isRequired: false,
    isEditable: true,
    isHeavy: false,
    isHidden: false,
    adornments: [],
    ...overrides,
  }
}

function makeTable(fields: Record<string, QFieldMetaData>): QTableMetaData {
  return {
    name: 'testTable',
    label: 'Test Table',
    isHidden: false,
    primaryKeyField: 'id',
    fields,
    sections: [],
    capabilities: [],
    exposedJoins: [],
    readPermission: true,
    insertPermission: true,
    editPermission: true,
    deletePermission: true,
    usesVariants: false,
    variantTableLabel: '',
  }
}

describe('zodFieldFromMetadata', () => {
  describe('STRING type', () => {
    it('optional string by default', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'STRING' }))
      expect(schema.safeParse(undefined).success).toBe(true)
      expect(schema.safeParse('hello').success).toBe(true)
    })

    it('required string fails on empty', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'STRING', isRequired: true, label: 'Name' }))
      expect(schema.safeParse('').success).toBe(false)
      expect(schema.safeParse('Alice').success).toBe(true)
    })

    it('enforces maxLength', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'STRING', maxLength: 5 }))
      expect(schema.safeParse('hello').success).toBe(true)
      expect(schema.safeParse('toolong').success).toBe(false)
    })
  })

  describe('INTEGER / LONG type', () => {
    it('optional integer accepts empty string', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'INTEGER' }))
      expect(schema.safeParse('').success).toBe(true)
      expect(schema.safeParse(42).success).toBe(true)
    })

    it('required integer fails on empty', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'INTEGER', isRequired: true, label: 'Age' }))
      expect(schema.safeParse(0).success).toBe(true)
      expect(schema.safeParse(3.14).success).toBe(false) // not integer
    })

    it('LONG behaves same as INTEGER', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'LONG' }))
      expect(schema.safeParse(9999999).success).toBe(true)
    })
  })

  describe('DECIMAL type', () => {
    it('accepts decimal numbers', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'DECIMAL' }))
      expect(schema.safeParse(3.14).success).toBe(true)
      expect(schema.safeParse('').success).toBe(true)
    })

    it('required decimal validates', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'DECIMAL', isRequired: true, label: 'Price' }))
      expect(schema.safeParse(0.01).success).toBe(true)
    })
  })

  describe('BOOLEAN type', () => {
    it('accepts true and false', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'BOOLEAN' }))
      expect(schema.safeParse(true).success).toBe(true)
      expect(schema.safeParse(false).success).toBe(true)
      expect(schema.safeParse(undefined).success).toBe(true)
    })
  })

  describe('DATE / TIME / DATE_TIME types', () => {
    it('optional date accepts empty string', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'DATE' }))
      expect(schema.safeParse('2025-01-01').success).toBe(true)
      expect(schema.safeParse('').success).toBe(true)
    })

    it('required date fails on empty string', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'DATE', isRequired: true, label: 'Date' }))
      expect(schema.safeParse('2025-01-01').success).toBe(true)
      expect(schema.safeParse('').success).toBe(false)
    })

    it('TIME type works the same', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'TIME' }))
      expect(schema.safeParse('10:30').success).toBe(true)
    })

    it('DATE_TIME type works the same', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'DATE_TIME', isRequired: true, label: 'DT' }))
      expect(schema.safeParse('2025-01-01T10:00').success).toBe(true)
      expect(schema.safeParse('').success).toBe(false)
    })
  })

  describe('PASSWORD type', () => {
    it('optional password', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'PASSWORD' }))
      expect(schema.safeParse('secret').success).toBe(true)
      expect(schema.safeParse('').success).toBe(true)
    })

    it('required password with maxLength', () => {
      const schema = zodFieldFromMetadata(makeField({
        type: 'PASSWORD',
        isRequired: true,
        maxLength: 20,
        label: 'Password',
      }))
      expect(schema.safeParse('12345').success).toBe(true)
      expect(schema.safeParse('').success).toBe(false)
      expect(schema.safeParse('a'.repeat(21)).success).toBe(false)
    })
  })

  describe('TEXT / HTML types', () => {
    it('optional TEXT', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'TEXT' }))
      expect(schema.safeParse('some text').success).toBe(true)
    })

    it('required HTML', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'HTML', isRequired: true, label: 'Body' }))
      expect(schema.safeParse('<p>hello</p>').success).toBe(true)
      expect(schema.safeParse('').success).toBe(false)
    })
  })

  describe('BLOB type', () => {
    it('accepts File objects', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'BLOB' }))
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      expect(schema.safeParse(file).success).toBe(true)
    })

    it('accepts string (URL)', () => {
      const schema = zodFieldFromMetadata(makeField({ type: 'BLOB' }))
      expect(schema.safeParse('https://example.com/file.pdf').success).toBe(true)
    })
  })
})

describe('zodSchemaFromTableMetadata', () => {
  it('includes only editable, non-hidden fields', () => {
    const table = makeTable({
      name: makeField({ name: 'name', type: 'STRING', isEditable: true }),
      hidden: makeField({ name: 'hidden', type: 'STRING', isHidden: true }),
      readonly: makeField({ name: 'readonly', type: 'STRING', isEditable: false }),
    })

    const schema = zodSchemaFromTableMetadata(table)
    const shape = schema.shape
    expect(Object.keys(shape)).toContain('name')
    expect(Object.keys(shape)).not.toContain('hidden')
    expect(Object.keys(shape)).not.toContain('readonly')
  })

  it('filters by fieldNamesToInclude when provided', () => {
    const table = makeTable({
      name: makeField({ name: 'name', type: 'STRING' }),
      email: makeField({ name: 'email', type: 'STRING' }),
    })

    const schema = zodSchemaFromTableMetadata(table, ['name'])
    expect(Object.keys(schema.shape)).toEqual(['name'])
  })

  it('validates data against the schema', () => {
    const table = makeTable({
      name: makeField({ name: 'name', type: 'STRING', isRequired: true, label: 'Name' }),
    })
    const schema = zodSchemaFromTableMetadata(table)
    expect(schema.safeParse({ name: 'Alice' }).success).toBe(true)
    expect(schema.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('zodSchemaFromFields', () => {
  it('builds schema from field array, skipping hidden', () => {
    const fields: QFieldMetaData[] = [
      makeField({ name: 'firstName', type: 'STRING' }),
      makeField({ name: 'hiddenField', type: 'STRING', isHidden: true }),
    ]
    const schema = zodSchemaFromFields(fields)
    expect(Object.keys(schema.shape)).toContain('firstName')
    expect(Object.keys(schema.shape)).not.toContain('hiddenField')
  })
})

describe('defaultValuesFromRecord', () => {
  it('uses record values for editable fields', () => {
    const table = makeTable({
      name: makeField({ name: 'name', type: 'STRING', isEditable: true }),
    })
    const defaults = defaultValuesFromRecord(table, { name: 'Alice' })
    expect(defaults.name).toBe('Alice')
  })

  it('skips hidden and non-editable fields', () => {
    const table = makeTable({
      hidden: makeField({ name: 'hidden', type: 'STRING', isHidden: true }),
      readonly: makeField({ name: 'readonly', type: 'STRING', isEditable: false }),
    })
    const defaults = defaultValuesFromRecord(table, { hidden: 'x', readonly: 'y' })
    expect(Object.keys(defaults)).not.toContain('hidden')
    expect(Object.keys(defaults)).not.toContain('readonly')
  })

  it('converts date to string', () => {
    const table = makeTable({
      dob: makeField({ name: 'dob', type: 'DATE', isEditable: true }),
    })
    const defaults = defaultValuesFromRecord(table, { dob: '2000-01-01' })
    expect(defaults.dob).toBe('2000-01-01')
  })

  it('converts boolean field', () => {
    const table = makeTable({
      active: makeField({ name: 'active', type: 'BOOLEAN', isEditable: true }),
    })
    const defaults = defaultValuesFromRecord(table, { active: 1 })
    expect(defaults.active).toBe(true)
  })

  it('uses defaultValue from metadata when no record value', () => {
    const table = makeTable({
      status: makeField({ name: 'status', type: 'STRING', isEditable: true, defaultValue: 'pending' }),
    })
    const defaults = defaultValuesFromRecord(table, {})
    expect(defaults.status).toBe('pending')
  })

  it('uses empty string for string fields with no value and no default', () => {
    const table = makeTable({
      notes: makeField({ name: 'notes', type: 'STRING', isEditable: true }),
    })
    const defaults = defaultValuesFromRecord(table, {})
    expect(defaults.notes).toBe('')
  })

  it('uses false for boolean fields with no value and no default', () => {
    const table = makeTable({
      active: makeField({ name: 'active', type: 'BOOLEAN', isEditable: true }),
    })
    const defaults = defaultValuesFromRecord(table, {})
    expect(defaults.active).toBe(false)
  })
})
