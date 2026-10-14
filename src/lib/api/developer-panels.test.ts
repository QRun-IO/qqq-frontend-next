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

// Tests for the developer panels API (parsing and the endpoint's absence on older backends)

import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { getRecordDeveloperPanels, parseDeveloperPanels, resetDeveloperPanelsSupport } from './developer-panels'

describe('parseDeveloperPanels', () => {
  it('keeps valid panels and blocks, drops malformed ones, and sorts by order then title', () => {
    const panels = parseDeveloperPanels({
      panels: [
        { id: 'b', title: 'Beta', order: 500, blocks: [{ type: 'TEXT', text: 'hi', tone: 'WARNING' }, { type: 'UNKNOWN' }] },
        { id: 'a', title: 'Alpha', order: 500, blocks: [{ type: 'TABLE', columns: ['A'], rows: [[1, null]] }] },
        { id: 's', title: 'Security', order: 150, statusTone: 'NOPE', blocks: [{ type: 'LINKS', links: [{ label: 'x', href: '/app/x' }, { label: 'no href' }] }] },
        { title: 'no id' },
        'junk',
      ],
    })
    expect(panels.map((panel) => panel.id)).toEqual(['s', 'a', 'b'])
    expect(panels[0].statusTone).toBeUndefined()
    expect(panels[0].blocks[0].links).toEqual([{ label: 'x', href: '/app/x', description: undefined, external: false }])
    expect(panels[1].blocks[0].rows).toEqual([['1', '']])
    expect(panels[2].blocks).toHaveLength(1)
    expect(panels[2].blocks[0]).toMatchObject({ type: 'TEXT', text: 'hi', tone: 'WARNING' })
  })

  it('returns no panels for a body without them', () => {
    expect(parseDeveloperPanels(null)).toEqual([])
    expect(parseDeveloperPanels({ panels: 'x' })).toEqual([])
  })
})

describe('getRecordDeveloperPanels', () => {
  beforeEach(() => resetDeveloperPanelsSupport())

  it('loads the panels of a record', async () => {
    server.use(http.get('/qqq/v1/table/person/1/developer/panels', () => HttpResponse.json({ panels: [{ id: 'esb', title: 'ESB Events', blocks: [] }] })))
    expect((await getRecordDeveloperPanels('person', 1)).map((panel) => panel.id)).toEqual(['esb'])
  })

  it('treats a backend without the endpoint (404) as no panels, and stops asking for the session', async () => {
    let requests = 0
    server.use(http.get('/qqq/v1/table/:table/:pk/developer/panels', () => {
      requests += 1
      return new HttpResponse(null, { status: 404 })
    }))
    expect(await getRecordDeveloperPanels('person', 1)).toEqual([])
    expect(await getRecordDeveloperPanels('person', 2)).toEqual([])
    expect(requests).toBe(1)
  })

  it('reports other failures', async () => {
    server.use(http.get('/qqq/v1/table/person/1/developer/panels', () => new HttpResponse(null, { status: 500 })))
    await expect(getRecordDeveloperPanels('person', 1)).rejects.toBeTruthy()
  })
})
