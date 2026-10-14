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
import type { CollaborationFavorite } from '@/types/collaboration'
import type { QInstance } from '@/types'
import { favoritePageTarget, paletteFavorites, paletteRecents } from './command-palette-collaboration'

const alice: CollaborationFavorite = {
  targetType: 'RECORD',
  targetName: 'person',
  recordId: '1',
  id: 1,
  label: 'Alice Johnson',
  href: '/app/person/1',
  available: true,
  folder: null,
  sortOrder: 0,
}
const meta = {
  tables: { person: { name: 'person', label: 'People' } },
  apps: { crm: { name: 'crm', label: 'Customer Relationships' } },
} as unknown as QInstance

describe('palette collaboration composition', () => {
  it('preserves favorite order when empty and uses existing multi-word matching and ranking', () => {
    const items = [
      { ...alice, id: 2, label: 'Mary Alice Johnson' },
      alice,
      { ...alice, available: false },
    ]
    expect(paletteFavorites(items, '').map((item) => item.id)).toEqual([2, 1])
    expect(paletteFavorites(items, 'alice john').map((item) => item.id)).toEqual([1, 2])
    expect(paletteFavorites(items, 'john alice')).toEqual([])
  })
  it('selects only server records when installed, even when the server list is empty', () => {
    const local = [
      {
        tableName: 'person',
        tableLabel: 'People',
        recordId: '9',
        recordLabel: 'Local record',
        path: '/app/person/9',
        viewedAt: 123,
      },
    ]
    expect(paletteRecents(false, [], local, meta)).toBe(local)
    expect(paletteRecents(true, [], local, meta)).toEqual([])
    expect(
      paletteRecents(
        true,
        [alice, { ...alice, targetType: 'TABLE' }, { ...alice, available: false }],
        local,
        meta
      )
    ).toEqual([
      {
        tableName: 'person',
        tableLabel: 'People',
        tableIcon: undefined,
        recordId: '1',
        recordLabel: 'Alice Johnson',
        path: '/app/person/1',
        viewedAt: 0,
      },
    ])
  })
  it.each([
    ['/app/person', { targetType: 'TABLE', targetName: 'person', recordId: undefined }],
    ['/app/person/a%2Fb/', { targetType: 'RECORD', targetName: 'person', recordId: 'a/b' }],
    ['/app/crm/', { targetType: 'APP', targetName: 'crm' }],
    ['/app/person/1/edit', null],
    ['/app/person/create', null],
    ['/app/unknown', null],
  ])('resolves a page action on %s', (path, expected) => {
    expect(favoritePageTarget(path, '', meta)).toEqual(expected)
  })
})
