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

// Tests for Material dashboard URL resolution (nested app paths and backend redirects)

import { describe, expect, it } from 'vitest'

import type { QInstance } from '@/types'
import { applyRedirects, legacyMaterialPath } from './legacy-paths'

const metaData = {
  apps: { peopleApp: { name: 'peopleApp' }, greetingsApp: { name: 'greetingsApp' }, setup: { name: 'setup' }, admin: { name: 'admin' } },
  tables: { person: { name: 'person' }, roles: { name: 'roles' } },
  processes: { greetInteractive: { name: 'greetInteractive' }, 'person.bulkEdit': { name: 'person.bulkEdit' } },
  reports: { personReport: { name: 'personReport' } },
} as unknown as QInstance

describe('applyRedirects', () => {
  const redirects = { '/admin/roles': '/setup/roles', '/admin/roles/*': '/setup/roles' }

  it('replaces an exact path and keeps the rest of a wildcard path (Material RedirectRoute)', () => {
    expect(applyRedirects('/admin/roles', redirects)).toBe('/setup/roles')
    expect(applyRedirects('/admin/roles/', redirects)).toBe('/setup/roles')
    expect(applyRedirects('/admin/roles/5/edit', redirects)).toBe('/setup/roles/5/edit')
    expect(applyRedirects('/admin/rolesX', redirects)).toBe('/admin/rolesX')
    expect(applyRedirects('/admin/roles', undefined)).toBe('/admin/roles')
  })
})

describe('legacyMaterialPath', () => {
  it('drops the enclosing apps and keeps the rest of the path', () => {
    expect(legacyMaterialPath('/peopleApp/greetingsApp/person', metaData)).toBe('/app/person')
    expect(legacyMaterialPath('/peopleApp/greetingsApp/person/1/edit', metaData)).toBe('/app/person/1/edit')
    expect(legacyMaterialPath('/peopleApp/greetingsApp/person/savedView/3', metaData)).toBe('/app/person/savedView/3')
    expect(legacyMaterialPath('/peopleApp/greetingsApp/greetInteractive', metaData)).toBe('/app/greetInteractive')
    expect(legacyMaterialPath('/peopleApp/personReport', metaData)).toBe('/app/personReport')
    expect(legacyMaterialPath('/peopleApp/greetingsApp/person/person.bulkEdit', metaData)).toBe('/app/person/person.bulkEdit')
  })

  it('opens an app path at its last app', () => {
    expect(legacyMaterialPath('/peopleApp/greetingsApp', metaData)).toBe('/app/greetingsApp')
    expect(legacyMaterialPath('/peopleApp/', metaData)).toBe('/app/peopleApp')
  })

  it('follows the backend redirects first', () => {
    const withRedirects = { ...metaData, redirects: { '/admin/roles': '/setup/roles', '/admin/roles/*': '/setup/roles' } } as QInstance
    expect(legacyMaterialPath('/admin/roles/5', withRedirects)).toBe('/app/roles/5')
  })

  it('is null for paths that are not Material paths of the instance', () => {
    expect(legacyMaterialPath('/person/1', metaData)).toBeNull()
    expect(legacyMaterialPath('/peopleApp/nothing', metaData)).toBeNull()
    expect(legacyMaterialPath('/', metaData)).toBeNull()
    expect(legacyMaterialPath('/peopleApp/person', undefined)).toBeNull()
  })
})
