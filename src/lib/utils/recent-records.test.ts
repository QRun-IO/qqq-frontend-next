// Tests for recent-records localStorage tracker

import { describe, it, expect, beforeEach } from 'vitest'
import { getRecentRecords, addRecentRecord, clearRecentRecords } from './recent-records'

const STORAGE_KEY = 'qqq-recent-records'

function makeRecord(overrides: { path?: string; recordId?: string; recordLabel?: string } = {}) {
  return {
    tableName: 'person',
    tableLabel: 'People',
    recordId: overrides.recordId ?? '1',
    recordLabel: overrides.recordLabel ?? 'Alice Smith',
    path: overrides.path ?? '/app/person/1',
  }
}

describe('getRecentRecords', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when nothing is stored', () => {
    expect(getRecentRecords()).toEqual([])
  })

  it('returns stored records sorted by viewedAt descending', () => {
    const records = [
      { ...makeRecord({ path: '/app/person/1', recordId: '1' }), viewedAt: 1000 },
      { ...makeRecord({ path: '/app/person/2', recordId: '2' }), viewedAt: 2000 },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    const result = getRecentRecords()
    expect(result[0].recordId).toBe('2')
    expect(result[1].recordId).toBe('1')
  })

  it('returns empty array for invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json')
    expect(getRecentRecords()).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
    expect(getRecentRecords()).toEqual([])
  })
})

describe('addRecentRecord', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adds a record to an empty list', () => {
    addRecentRecord(makeRecord())
    const records = getRecentRecords()
    expect(records).toHaveLength(1)
    expect(records[0].recordId).toBe('1')
  })

  it('deduplicates by path (updates timestamp)', () => {
    addRecentRecord(makeRecord({ path: '/app/person/1', recordId: '1' }))
    addRecentRecord(makeRecord({ path: '/app/person/1', recordId: '1', recordLabel: 'Alice Updated' }))
    const records = getRecentRecords()
    expect(records).toHaveLength(1)
    expect(records[0].recordLabel).toBe('Alice Updated')
  })

  it('prepends new records (most recent first)', () => {
    addRecentRecord(makeRecord({ path: '/app/person/1', recordId: '1' }))
    addRecentRecord(makeRecord({ path: '/app/person/2', recordId: '2' }))
    const records = getRecentRecords()
    expect(records[0].recordId).toBe('2')
    expect(records[1].recordId).toBe('1')
  })

  it('trims list to 20 entries', () => {
    for (let i = 1; i <= 25; i++) {
      addRecentRecord(makeRecord({ path: `/app/person/${i}`, recordId: String(i) }))
    }
    expect(getRecentRecords()).toHaveLength(20)
  })

  it('sets viewedAt as a recent timestamp', () => {
    const before = Date.now()
    addRecentRecord(makeRecord())
    const after = Date.now()
    const records = getRecentRecords()
    expect(records[0].viewedAt).toBeGreaterThanOrEqual(before)
    expect(records[0].viewedAt).toBeLessThanOrEqual(after)
  })
})

describe('clearRecentRecords', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('removes all records from storage', () => {
    addRecentRecord(makeRecord())
    clearRecentRecords()
    expect(getRecentRecords()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('does not throw when storage is already empty', () => {
    expect(() => clearRecentRecords()).not.toThrow()
  })
})
