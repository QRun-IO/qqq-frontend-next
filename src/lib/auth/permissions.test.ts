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
import type { Capability } from '@/types'
import {
  canAccessProcess,
  canDeleteRecords,
  canEditRecords,
  canInsertRecords,
  canReadRecords,
  canRunProcess,
  canViewWidget,
} from './permissions'

const ALL: Capability[] = ['TABLE_QUERY', 'TABLE_GET', 'TABLE_COUNT', 'TABLE_INSERT', 'TABLE_UPDATE', 'TABLE_DELETE']
const table = (overrides: Partial<{ capabilities: Capability[]; readPermission: boolean; insertPermission: boolean; editPermission: boolean; deletePermission: boolean }> = {}) => ({
  capabilities: ALL, readPermission: true, insertPermission: true, editPermission: true, deletePermission: true, ...overrides,
})

describe('permission gating (QRun-IO/qqq#671)', () => {
  it('requires both the permission and the capability for writes', () => {
    expect(canInsertRecords(table())).toBe(true)
    expect(canInsertRecords(table({ insertPermission: false }))).toBe(false)
    expect(canInsertRecords(table({ capabilities: ['TABLE_QUERY'] }))).toBe(false)
    expect(canEditRecords(table({ capabilities: ['TABLE_QUERY', 'TABLE_INSERT'] }))).toBe(false)
    expect(canDeleteRecords(table({ deletePermission: false }))).toBe(false)
    expect(canDeleteRecords(undefined)).toBe(false)
  })

  it('treats a disabled table (readPermission false) or an absent one as unreadable', () => {
    expect(canReadRecords(table())).toBe(true)
    expect(canReadRecords(table({ readPermission: false }))).toBe(false)
    expect(canReadRecords(undefined)).toBe(false)
  })

  it('offers processes only when permitted, and in menus only when visible', () => {
    expect(canAccessProcess({ hasPermission: true })).toBe(true)
    expect(canAccessProcess({ hasPermission: false })).toBe(false)
    expect(canAccessProcess(undefined)).toBe(false)
    expect(canRunProcess({ hasPermission: true, isHidden: true })).toBe(false)
    expect(canRunProcess({ hasPermission: true, isHidden: false })).toBe(true)
    expect(canRunProcess({ hasPermission: false, isHidden: false })).toBe(false)
  })

  it('loads widgets only when permitted', () => {
    expect(canViewWidget({ hasPermission: true })).toBe(true)
    expect(canViewWidget({ hasPermission: false })).toBe(false)
  })
})
