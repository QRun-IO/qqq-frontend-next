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

import type { QInstance } from '@/types'
import { screenAnalytics } from './page-views'

const metaData = {
  apps: { peopleApp: { name: 'peopleApp', label: 'People' } },
  tables: { person: { name: 'person', label: 'Person' } },
  processes: { greet: { name: 'greet', label: 'Greet People' } },
} as unknown as QInstance

const title = (path: string) => screenAnalytics(path, '', metaData)?.pageView.title

describe('screenAnalytics', () => {
  it('titles the Material screens with metadata labels', () => {
    expect(title('/app/peopleApp')).toBe('App: People')
    expect(title('/app/person')).toBe('Query: Person')
    expect(title('/app/person/savedView/3')).toBe('Query: Person')
    expect(title('/app/person/create')).toBe('New: Person')
    expect(title('/app/person/42')).toBe('View: Person')
    expect(title('/app/person/42/edit')).toBe('Edit: Person')
    expect(title('/app/person/42/copy')).toBe('Copy: Person')
    expect(title('/app/person/42/dev')).toBe('Developer Mode: Person')
    expect(title('/app/person/dev')).toBe('Developer Mode: Person')
    expect(title('/app/greet')).toBe('Process: Greet People')
    expect(title('/app/person/42/greet')).toBe('Process: Greet People')
  })

  it('marks the record id and sends Material opening events', () => {
    expect(screenAnalytics('/app/person/42/edit', '?x=1', metaData)?.pageView).toEqual({ location: { pathname: '/app/person/42/edit', search: '?x=1' }, title: 'Edit: Person', recordId: '42' })
    expect(screenAnalytics('/app/peopleApp', '', metaData)?.events).toEqual([{ category: 'appEvents', action: 'loadAppScreen', label: 'People' }])
    expect(screenAnalytics('/app/greet', '', metaData)?.events).toEqual([{ category: 'processEvents', action: 'startProcess', label: 'Greet People' }])
    expect(screenAnalytics('/app/person/42/greet', '', metaData)?.pageView.recordId).toBe('42')
  })

  it('records nothing for other routes', () => {
    for (const path of ['/', '/login', '/app', '/app/developer', '/app/search', '/app/unknown', '/app/person/key', '/app/person/42/unknown']) {
      expect(screenAnalytics(path, '', metaData)).toBeNull()
    }
  })
})
