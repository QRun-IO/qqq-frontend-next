// Tests for process utility functions

import { describe, it, expect } from 'vitest'
import { getProcessesForTable, getSingleRecordProcesses, getBulkProcesses } from './process-utils'
import type { QInstance, QProcessMetaData } from '@/types'

function makeProcess(overrides: Partial<QProcessMetaData>): QProcessMetaData {
  return {
    name: 'testProcess',
    label: 'Test Process',
    tableName: 'person',
    isHidden: false,
    iconName: '',
    hasPermission: true,
    stepFlow: 'LINEAR',
    minInputRecords: 0,
    maxInputRecords: 1,
    frontendSteps: [],
    ...overrides,
  }
}

function makeInstance(processes: Record<string, QProcessMetaData>): QInstance {
  return {
    apps: {},
    appTree: [],
    tables: {},
    processes,
    reports: {},
    widgets: {},
    branding: { companyName: 'Test', companyUrl: '', appName: 'Test' },
    helpContents: {},
    environmentValues: {},
  }
}

describe('getProcessesForTable', () => {
  it('returns processes matching the table name', () => {
    const instance = makeInstance({
      proc1: makeProcess({ name: 'proc1', tableName: 'person' }),
      proc2: makeProcess({ name: 'proc2', tableName: 'order' }),
    })
    const result = getProcessesForTable(instance, 'person')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('proc1')
  })

  it('excludes hidden processes', () => {
    const instance = makeInstance({
      hidden: makeProcess({ name: 'hidden', tableName: 'person', isHidden: true }),
      visible: makeProcess({ name: 'visible', tableName: 'person' }),
    })
    const result = getProcessesForTable(instance, 'person')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('visible')
  })

  it('excludes processes without permission', () => {
    const instance = makeInstance({
      forbidden: makeProcess({ name: 'forbidden', tableName: 'person', hasPermission: false }),
      allowed: makeProcess({ name: 'allowed', tableName: 'person' }),
    })
    const result = getProcessesForTable(instance, 'person')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('allowed')
  })

  it('returns empty array when no processes match', () => {
    const instance = makeInstance({})
    expect(getProcessesForTable(instance, 'person')).toEqual([])
  })

  it('handles undefined processes property', () => {
    const instance = makeInstance({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(instance as any).processes = undefined
    expect(getProcessesForTable(instance, 'person')).toEqual([])
  })
})

describe('getSingleRecordProcesses', () => {
  it('includes processes with no maxInputRecords (unlimited)', () => {
    const processes = [makeProcess({ name: 'unlimited' })]
    expect(getSingleRecordProcesses(processes)).toHaveLength(1)
  })

  it('includes processes with maxInputRecords >= 1', () => {
    const processes = [
      makeProcess({ name: 'single', maxInputRecords: 1 }),
      makeProcess({ name: 'multi', maxInputRecords: 10 }),
    ]
    expect(getSingleRecordProcesses(processes)).toHaveLength(2)
  })

  it('excludes processes with maxInputRecords 0', () => {
    const processes = [makeProcess({ name: 'zero', maxInputRecords: 0 })]
    expect(getSingleRecordProcesses(processes)).toHaveLength(0)
  })
})

describe('getBulkProcesses', () => {
  it('includes processes with no maxInputRecords (unlimited)', () => {
    const processes = [makeProcess({ name: 'unlimited' })]
    expect(getBulkProcesses(processes)).toHaveLength(1)
  })

  it('includes processes with maxInputRecords > 1', () => {
    const processes = [makeProcess({ name: 'bulk', maxInputRecords: 100 })]
    expect(getBulkProcesses(processes)).toHaveLength(1)
  })

  it('includes processes with maxInputRecords === 0 (unlimited)', () => {
    const processes = [makeProcess({ name: 'unlimited2', maxInputRecords: 0 })]
    expect(getBulkProcesses(processes)).toHaveLength(1)
  })

  it('excludes processes with maxInputRecords === 1', () => {
    const processes = [makeProcess({ name: 'single', maxInputRecords: 1 })]
    expect(getBulkProcesses(processes)).toHaveLength(0)
  })
})
