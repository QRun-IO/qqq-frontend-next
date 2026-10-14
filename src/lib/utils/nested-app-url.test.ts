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

import { qInstance } from '@/mocks/fixtures/q-instance'
import { nestedAppUrl } from './nested-app-url'

const metadata = {
  apps: { parent: { ...Object.values(qInstance.apps)[0], name: 'parent' }, child: { ...Object.values(qInstance.apps)[0], name: 'child' } },
  tables: { person: qInstance.tables.person },
  processes: { run: Object.values(qInstance.processes)[0] },
}

describe('nestedAppUrl', () => {
  it.each([
    ['/app/parent/person', '/app/person'],
    ['/app/parent/person/42', '/app/person/42'],
    ['/app/parent/person/42/edit', '/app/person/42/edit'],
    ['/app/parent/person/create', '/app/person/create'],
    ['/app/parent/run', '/app/run'],
    ['/app/parent/child', '/app/child'],
    ['/app/parent/person/42?filter=a%20b&tag=1&tag=2#details', '/app/person/42?filter=a%20b&tag=1&tag=2#details'],
    ['/app/parent/person/a%2Fb/edit/', '/app/person/a%2Fb/edit/'],
    ['/app/%70arent/person', '/app/person'],
  ])('maps %s to %s', (href, expected) => {
    expect(nestedAppUrl(href, metadata)).toBe(expected)
  })

  it.each(['/app/unknown/person', '/app/parent/unknown', '/app/person/42', '/app/parent', '/other/parent/person', '/app/%ZZ/person', '/app/parent/toString'])('leaves %s untouched', (href) => {
    expect(nestedAppUrl(href, metadata)).toBeNull()
  })

  it('preserves table routes when a table and app share a name', () => {
    expect(nestedAppUrl('/app/parent/person', { ...metadata, tables: { ...metadata.tables, parent: qInstance.tables.person } })).toBeNull()
  })

  it('cannot loop even when the app name is repeated', () => {
    const target = nestedAppUrl('/app/parent/parent', metadata)
    expect(target).toBe('/app/parent')
    expect(nestedAppUrl(target!, metadata)).toBeNull()
  })
})
