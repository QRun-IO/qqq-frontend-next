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
import { normalizeQaCaptureCapability } from '@/lib/api/qa-capture'
import { buildJamMetadata, METADATA_MAX_BYTES, resolveRouteContext } from './route-context'

const META = {
  apps: { crm: {} },
  tables: { person: {} },
  processes: { 'person.bulkEdit': {}, runReport: {} },
  reports: { salesReport: {} },
}

const CAPABILITY = normalizeQaCaptureCapability({
  enabled: true,
  provider: 'jam',
  providerConfig: { teamId: 'team-1' },
  sanitizer: { queryParamNames: ['token'] },
  context: { environment: 'prod', backendVersion: '0.1.110', node: 'node-1' },
})

describe('QA route context', () => {
  it('resolves apps, tables, records, record actions and processes', () => {
    expect(resolveRouteContext('/app/crm', META)).toEqual({ appName: 'crm', tableName: null, recordId: null, processName: null })
    expect(resolveRouteContext('/app/person', META).tableName).toBe('person')
    expect(resolveRouteContext('/app/person/42', META)).toEqual({ appName: null, tableName: 'person', recordId: '42', processName: null })
    expect(resolveRouteContext('/app/person/42/edit', META).recordId).toBe('42')
    expect(resolveRouteContext('/app/person/create', META).recordId).toBeNull()
    expect(resolveRouteContext('/app/person/42/person.bulkEdit', META).processName).toBe('person.bulkEdit')
    expect(resolveRouteContext('/app/runReport', META).processName).toBe('runReport')
    expect(resolveRouteContext('/app/salesReport', META).processName).toBe('salesReport')
    expect(resolveRouteContext('/app/a%20b/%E0%A4%A', META)).toEqual({ appName: null, tableName: null, recordId: null, processName: null })
    expect(resolveRouteContext('/login', META).tableName).toBeNull()
    expect(resolveRouteContext('/app/person/1', undefined).tableName).toBeNull()
  })

  it('builds Jam metadata with the context, versions and filtered page path', () => {
    const metadata = buildJamMetadata({
      capability: CAPABILITY,
      route: resolveRouteContext('/app/person/42', META),
      href: 'https://a.example.com/app/person/42?token=secret&tab=2&jam-recording=r',
      requestIds: [{ id: 'req-1', method: 'GET', path: '/qqq/v1/x', status: 200, at: '2026-10-15T00:00:00Z' }],
      reportReference: 'qa-1',
    })
    expect(metadata).toMatchObject({
      table: 'person',
      recordId: '42',
      backend: { environment: 'prod', backendVersion: '0.1.110', node: 'node-1' },
      reportReference: 'qa-1',
      pagePath: '/app/person/42?tab=2',
      requestIds: [{ id: 'req-1', method: 'GET', path: '/qqq/v1/x', status: 200 }],
    })
    expect(typeof metadata.frontendVersion).toBe('string')
  })

  it('stays under 10 KB by dropping the oldest request ids', () => {
    const requestIds = Array.from({ length: 50 }, (_, i) => ({ id: `${'r'.repeat(120)}${i}`, method: 'POST', path: `/qqq/v1/${'p'.repeat(250)}`, status: 200, at: '2026-10-15T00:00:00Z' }))
    const metadata = buildJamMetadata({ capability: CAPABILITY, route: resolveRouteContext('/app/crm', META), href: 'not a url', requestIds, reportReference: null })
    expect(new TextEncoder().encode(JSON.stringify(metadata)).length).toBeLessThanOrEqual(METADATA_MAX_BYTES)
    const kept = metadata.requestIds as Array<{ id: string }>
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.at(-1)!.id.endsWith('49')).toBe(true)
  })
})
