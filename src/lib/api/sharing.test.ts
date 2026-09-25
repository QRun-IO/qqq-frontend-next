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

// Tests for the sharing API (#665, #444)

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./processes', () => ({ processInit: vi.fn() }))

import type { QJobResponse } from '@/types'
import { processInit } from './processes'
import { deleteSharedRecord, editSharedRecord, getSharedRecords, insertSharedRecord, splitAudienceOption } from './sharing'

const initMock = vi.mocked(processInit)

describe('sharing API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps colons inside audience ids (user:sample:bob)', () => {
    expect(splitAudienceOption('user:sample:bob')).toEqual({ audienceType: 'user', audienceId: 'sample:bob' })
    expect(splitAudienceOption('group:7')).toEqual({ audienceType: 'group', audienceId: '7' })
    expect(splitAudienceOption('nocolon')).toBeNull()
    expect(splitAudienceOption('user:')).toBeNull()
  })

  it('lists shares from the getSharedRecords process', async () => {
    initMock.mockResolvedValue({ processUUID: 'p', values: { resultList: [{ values: { shareId: 4, scopeId: 'READ_ONLY', audienceType: 'user', audienceId: 'sample:bob', audienceLabel: 'Bob' } }] } } as unknown as QJobResponse)
    expect(await getSharedRecords('savedReport', 1)).toEqual([{ shareId: 4, scopeId: 'READ_ONLY', audienceType: 'user', audienceId: 'sample:bob', audienceLabel: 'Bob' }])
    expect(initMock).toHaveBeenCalledWith('getSharedRecords', { values: { tableName: 'savedReport', recordId: 1 } })
  })

  it('adds, edits and deletes shares through their processes', async () => {
    initMock.mockResolvedValue({ processUUID: 'p', values: {} } as unknown as QJobResponse)
    await insertSharedRecord('savedReport', 1, 'user', 'sample:bob', 'READ_ONLY')
    expect(initMock).toHaveBeenLastCalledWith('insertSharedRecord', { values: { tableName: 'savedReport', recordId: 1, audienceType: 'user', audienceId: 'sample:bob', scopeId: 'READ_ONLY' } })
    await editSharedRecord('savedReport', 1, 4, 'READ_WRITE')
    expect(initMock).toHaveBeenLastCalledWith('editSharedRecord', { values: { tableName: 'savedReport', recordId: 1, shareId: 4, scopeId: 'READ_WRITE' } })
    await deleteSharedRecord('savedReport', 1, 4)
    expect(initMock).toHaveBeenLastCalledWith('deleteSharedRecord', { values: { tableName: 'savedReport', recordId: 1, shareId: 4 } })
  })

  it('raises the backend error from a failed share', async () => {
    initMock.mockResolvedValue({ processUUID: 'p', error: 'You are not the owner of this record, so you may not share it.' } as unknown as QJobResponse)
    await expect(insertSharedRecord('savedReport', 101, 'user', 'sample:bob', 'READ_ONLY')).rejects.toThrow('You are not the owner of this record')
  })
})
