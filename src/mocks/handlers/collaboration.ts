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

/** @file Stateful collaboration fixtures using the existing CRM, inventory and record data. */

import { http, HttpResponse } from 'msw'
import type {
  CollaborationFavorite,
  CollaborationFavoriteOrder,
  CollaborationTarget,
} from '@/types/collaboration'
import { qInstance } from '../fixtures/q-instance'
import { personRecords } from '../fixtures/records/person'
import { companyRecords } from '../fixtures/records/company'
import { orderRecords } from '../fixtures/records/order'
import { productRecords } from '../fixtures/records/product'

const BASE = '/qqq/v1/qbit/collaboration'
const records = [...personRecords, ...companyRecords, ...orderRecords, ...productRecords]
let nextId = 10
const identity = (target: CollaborationTarget) =>
  JSON.stringify([target.targetType, target.targetName, target.recordId ?? null])

/**
 * Resolves a mock target's label from metadata or an existing record.
 * @param target - Navigation identity.
 * @returns A favorite-shaped response item.
 */
function entry(target: CollaborationTarget): CollaborationFavorite {
  const table = qInstance.tables[target.targetName]
  const record = records.find(
    (item) =>
      item.tableName === target.targetName &&
      String(item.values[table?.primaryKeyField ?? 'id']) === target.recordId
  )
  const label =
    target.targetType === 'RECORD'
      ? record?.recordLabel
      : target.targetType === 'APP'
        ? qInstance.apps[target.targetName]?.label
        : (table?.label ??
          qInstance.processes[target.targetName]?.label ??
          qInstance.reports[target.targetName]?.label)
  return {
    ...target,
    id: nextId++,
    label: label ?? 'Unavailable',
    available: !!label,
    folder: null,
    sortOrder: nextId,
    href: label
      ? `/app/${encodeURIComponent(target.targetName)}${target.recordId ? `/${encodeURIComponent(target.recordId)}` : ''}`
      : null,
  }
}

let favorites: CollaborationFavorite[] = [
  { ...entry({ targetType: 'TABLE', targetName: 'person' }), folder: 'Customer relationships' },
  { ...entry({ targetType: 'APP', targetName: 'inventory' }), folder: 'Operations' },
  {
    ...entry({ targetType: 'RECORD', targetName: 'order', recordId: 'archived' }),
    folder: 'Operations',
  },
]
let recents = [entry({ targetType: 'RECORD', targetName: 'company', recordId: '1' })]
const asRecord = (item: CollaborationFavorite) => ({
  tableName: 'collaboration_favorite',
  recordLabel: item.label,
  values: { ...item },
  displayValues: {},
})

export const collaborationHandlers = [
  http.post('/qqq/v1/table/collaboration_favorite/query', () =>
    HttpResponse.json({ records: favorites.map(asRecord) })
  ),
  http.post('/qqq/v1/table/collaboration_favorite/count', () =>
    HttpResponse.json({ count: favorites.length })
  ),
  http.get('/qqq/v1/table/collaboration_favorite/:id', ({ params }) => {
    const item = favorites.find((row) => String(row.id) === params.id)
    return item
      ? HttpResponse.json({ record: asRecord(item) })
      : HttpResponse.json({ error: 'Favorite not found' }, { status: 404 })
  }),
  http.patch('/qqq/v1/table/collaboration_favorite/:id', async ({ params, request }) => {
    const item = favorites.find((row) => String(row.id) === params.id)
    if (!item) return HttpResponse.json({ error: 'Favorite not found' }, { status: 404 })
    const body = (await request.json()) as { folder?: string | null; sortOrder?: number }
    if ('folder' in body) item.folder = body.folder ?? null
    if (typeof body.sortOrder === 'number') item.sortOrder = body.sortOrder
    favorites.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    return HttpResponse.json({ record: asRecord(item) })
  }),
  http.delete('/qqq/v1/table/collaboration_favorite/:id', ({ params }) => {
    favorites = favorites.filter((row) => String(row.id) !== params.id)
    return HttpResponse.json({ success: true })
  }),
  http.get('/qqq/v1/version', () =>
    HttpResponse.json({
      apiVersion: '1.0.0',
      basePath: '/qqq/v1',
      supportedMajorVersions: [1],
      extensions: [{ name: 'collaboration', version: '1.0.0' }],
    })
  ),
  http.get(`${BASE}/favorites`, ({ request }) => {
    const params = new URL(request.url).searchParams
    const start = Number(params.get('cursor') ?? 0)
    const limit = Number(params.get('limit') ?? 20)
    return HttpResponse.json({
      items: favorites.slice(start, start + limit),
      nextCursor: start + limit < favorites.length ? String(start + limit) : null,
    })
  }),
  http.put(`${BASE}/favorites`, async ({ request }) => {
    const target = (await request.json()) as CollaborationTarget
    if (!favorites.some((item) => identity(item) === identity(target)))
      favorites.push(entry(target))
    return HttpResponse.json({ success: true })
  }),
  http.delete(`${BASE}/favorites`, async ({ request }) => {
    const target = (await request.json()) as CollaborationTarget
    favorites = favorites.filter((item) => identity(item) !== identity(target))
    return HttpResponse.json({ success: true })
  }),
  http.patch(`${BASE}/favorites/order`, async ({ request }) => {
    const { ids, folders } = (await request.json()) as CollaborationFavoriteOrder
    favorites.sort(
      (a, b) =>
        (ids.includes(a.id!) ? ids.indexOf(a.id!) : ids.length) -
        (ids.includes(b.id!) ? ids.indexOf(b.id!) : ids.length)
    )
    favorites = favorites.map((item, sortOrder) => ({
      ...item,
      sortOrder,
      folder: folders && String(item.id) in folders ? folders[String(item.id)] : item.folder,
    }))
    return HttpResponse.json({ success: true })
  }),
  http.get(`${BASE}/recents`, ({ request }) =>
    HttpResponse.json({
      items: recents
        .filter((item) => item.available)
        .slice(0, Number(new URL(request.url).searchParams.get('limit') ?? 50)),
      nextCursor: null,
    })
  ),
  http.post(`${BASE}/recents`, async ({ request }) => {
    const target = (await request.json()) as CollaborationTarget
    recents = [
      entry(target),
      ...recents.filter((item) => identity(item) !== identity(target)),
    ].slice(0, 50)
    return HttpResponse.json({ success: true })
  }),
]
