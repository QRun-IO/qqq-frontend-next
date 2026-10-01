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

// Tests for process utility functions

import { describe, it, expect } from 'vitest'
import {
  getProcessesForTable,
  getSingleRecordProcesses,
  getBulkProcesses,
  getProcessesForAllScreens,
  getRecordActionProcesses,
  launchTableName,
} from './process-utils'
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

describe('processes added to every query and record screen (Material)', () => {
  const withMaterial = (processes: Record<string, QProcessMetaData>, names: unknown) => ({
    ...makeInstance(processes),
    supplementalInstanceMetaData: { materialDashboard: { processNamesToAddToAllQueryAndViewScreens: names } },
  })

  it('appends the configured processes, in order, after the table\'s own and without duplicates', () => {
    const instance = withMaterial({
      own: makeProcess({ name: 'own', label: 'Own', tableName: 'person' }),
      tag: makeProcess({ name: 'tag', tableName: '', isHidden: true }),
      audit: makeProcess({ name: 'audit', tableName: '' }),
    }, ['audit', 'own', 'tag', 'audit'])
    expect(getProcessesForAllScreens(instance).map((p) => p.name)).toEqual(['audit', 'own', 'tag'])
    expect(getProcessesForTable(instance, 'person').map((p) => p.name)).toEqual(['own', 'audit', 'tag'])
    // another table gets them too
    expect(getProcessesForTable(instance, 'order').map((p) => p.name)).toEqual(['audit', 'own', 'tag'])
  })

  it('lists only processes present in the metadata and permitted', () => {
    const instance = withMaterial({
      denied: makeProcess({ name: 'denied', tableName: '', hasPermission: false }),
    }, ['absent', 'denied', 42])
    expect(getProcessesForAllScreens(instance)).toEqual([])
    expect(getProcessesForAllScreens(withMaterial({}, undefined))).toEqual([])
  })

  it('falls back to runRecordScript only without Material instance metadata (deprecated)', () => {
    const script = makeProcess({ name: 'runRecordScript', tableName: '' })
    expect(getProcessesForAllScreens(makeInstance({ runRecordScript: script }))).toEqual([script])
    expect(getProcessesForAllScreens(makeInstance({}))).toEqual([])
    expect(getProcessesForAllScreens(withMaterial({ runRecordScript: script }, []))).toEqual([])
  })

  it('record actions keep hidden all-screens processes but not the table\'s hidden ones', () => {
    const processes = [
      makeProcess({ name: 'own', tableName: 'person' }),
      makeProcess({ name: 'ownHidden', tableName: 'person', isHidden: true }),
      makeProcess({ name: 'tag', tableName: '', isHidden: true }),
      makeProcess({ name: 'bulkOnly', tableName: '', maxInputRecords: 0 }),
    ]
    expect(getRecordActionProcesses(processes, 'person').map((p) => p.name)).toEqual(['own', 'tag'])
    expect(getRecordActionProcesses(undefined, 'person')).toEqual([])
  })

  it('names the launching table only for processes that are not the table\'s own', () => {
    expect(launchTableName(makeProcess({ tableName: 'person' }), 'person')).toBeUndefined()
    expect(launchTableName(makeProcess({ tableName: '' }), 'person')).toBe('person')
    expect(launchTableName(makeProcess({ tableName: 'order' }), 'person')).toBe('person')
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
