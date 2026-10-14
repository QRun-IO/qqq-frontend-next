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
  Attachment,
  CollaborationComment,
  CollaborationTag,
  CollaborationCommentRevisionV1,
  CollaborationFollowV1,
  CollaborationTimelineItemV1,
  FollowState,
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

// Record fixtures remain isolated by parent, and live only for this mock session.
interface RecordState {
  comments: CollaborationComment[]
  attachments: Attachment[]
  tags: CollaborationTag[]
  follow: FollowState
  followers: CollaborationFollowV1[]
  timeline: CollaborationTimelineItemV1[]
}
const vocabulary: CollaborationTag[] = [
  { id: 1, label: 'Priority', name: 'priority', approved: true, color: '#2563eb' },
  { id: 2, label: 'Customer', name: 'customer', approved: true, color: '#059669' },
  { id: 3, label: 'Needs review', name: 'needs review', approved: true },
]
const recordStates = new Map<string, RecordState>()
const histories = new Map<number, CollaborationCommentRevisionV1[]>()
const fileBytes = new Map<number, { bytes: ArrayBuffer; type: string }>()
let objectId = 1000
/** Gets independent realistic fixtures for a parent record.
 * @param table - Table name.
 * @param pk - Record key.
 * @returns Mutable session state.
 */
function recordState(table: string, pk: string): RecordState {
  const key = JSON.stringify([table, pk])
  if (!recordStates.has(key))
    recordStates.set(key, {
      comments: [
        {
          id: objectId++,
          authorDisplayName: 'Morgan Lee',
          authorUserId: 'morgan',
          body: 'Please check the contact details before the next call.',
          createdAt: '2026-10-12T15:30:00Z',
          fieldName: 'email',
          replies: [
            {
              id: objectId++,
              authorDisplayName: 'Alex Rivera',
              authorUserId: 'alex',
              body: 'Email confirmed with the customer.',
              createdAt: '2026-10-12T16:00:00Z',
              replies: [],
            },
          ],
          canEdit: false,
          canDelete: true,
          resolved: false,
        },
      ],
      attachments: [
        {
          id: objectId++,
          fileName: 'Contact notes.txt',
          contentType: 'text/plain',
          sizeBytes: 64,
          description: 'Notes from our introductory call.',
          createdByUserId: 'Morgan Lee',
          createDate: '2026-10-12T15:00:00Z',
          canDelete: true,
          tableName: table,
          recordId: pk,
        },
      ],
      tags: [vocabulary[1]],
      follow: { following: false, follow: null },
      followers: [
        {
          id: 22,
          userId: 'morgan',
          reason: 'COMMENTED',
          notifyOnComment: true,
          notifyOnChange: false,
        },
      ],
      timeline: Array.from({ length: 23 }, (_, index) => ({
        id: objectId++,
        kind: index % 2 ? ('AUDIT' as const) : ('ACTIVITY' as const),
        at: new Date(Date.UTC(2026, 9, 12, 16) - index * 3600000).toISOString(),
        actorName: index % 2 ? 'Alex Rivera' : 'Morgan Lee',
        actorUserId: index % 2 ? 'alex' : 'morgan',
        summary: index % 2 ? 'Updated contact details' : 'Reviewed this contact',
        details: index % 2 ? [{ fieldName: 'status', oldValue: 'Lead', newValue: 'Active' }] : [],
      })),
    })
  return recordStates.get(key)!
}
/** Paginates mock collections with opaque tokens.
 * @param items - Ordered values.
 * @param request - HTTP request.
 * @returns Page envelope.
 */
function mockPage<T>(items: T[], request: Request) {
  const params = new URL(request.url).searchParams
  const offset = Number((params.get('cursor') ?? 'page:0').replace('page:', '')) || 0
  const limit = Math.max(1, Math.min(100, Number(params.get('limit') ?? 20)))
  return {
    items: items.slice(offset, offset + limit),
    nextCursor: offset + limit < items.length ? `page:${offset + limit}` : null,
  }
}
/** Adds visible activity after mock mutations.
 * @param state - Parent state.
 * @param summary - Human summary.
 */
function activity(state: RecordState, summary: string) {
  state.timeline.unshift({
    id: objectId++,
    kind: 'ACTIVITY',
    at: new Date().toISOString(),
    actorName: 'You',
    actorUserId: 'me',
    summary,
    details: [],
  })
}
/** Finds a stored comment, including replies.
 * @param id - Comment identifier.
 * @returns Comment and parent state.
 */
function findComment(id: number) {
  for (const state of recordStates.values())
    for (const root of state.comments) {
      const comment = root.id === id ? root : root.replies.find((item) => item.id === id)
      if (comment) return { state, root, comment }
    }
}
/** Finds an attachment's parent.
 * @param id - File identifier.
 * @returns State and file.
 */
function findAttachment(id: number) {
  for (const state of recordStates.values()) {
    const file = state.attachments.find((item) => item.id === id)
    if (file) return { state, file }
  }
}
const missing = () => HttpResponse.json({ error: 'Not found' }, { status: 404 })

collaborationHandlers.push(
  http.get(`${BASE}/records/:table/:pk/comments`, ({ params, request }) => {
    const page = mockPage(recordState(String(params.table), String(params.pk)).comments, request)
    return HttpResponse.json({ threads: page.items, nextCursor: page.nextCursor })
  }),
  http.post(`${BASE}/records/:table/:pk/comments`, async ({ params, request }) => {
    const state = recordState(String(params.table), String(params.pk))
    const input = (await request.json()) as {
      body: string
      parentCommentId?: number
      fieldName?: string
    }
    if (!input.body?.trim())
      return HttpResponse.json({ error: 'Comment body is required' }, { status: 400 })
    const comment: CollaborationComment = {
      id: objectId++,
      authorUserId: 'me',
      authorDisplayName: 'You',
      body: input.body,
      fieldName: input.fieldName,
      parentCommentId: input.parentCommentId,
      createdAt: new Date().toISOString(),
      canEdit: true,
      canDelete: true,
      replies: [],
      resolved: false,
    }
    if (input.parentCommentId) {
      const root = state.comments.find((item) => item.id === input.parentCommentId)
      if (!root) return missing()
      root.replies.push(comment)
      state.comments = [root, ...state.comments.filter((item) => item.id !== root.id)]
    } else state.comments.unshift(comment)
    activity(state, 'Posted a comment')
    return HttpResponse.json(comment)
  }),
  http.patch(`${BASE}/comments/:id`, async ({ params, request }) => {
    const found = findComment(Number(params.id))
    if (!found) return missing()
    const { body } = (await request.json()) as { body: string }
    histories.set(found.comment.id, [
      ...(histories.get(found.comment.id) ?? []),
      {
        id: objectId++,
        body: found.comment.body,
        editedAt: new Date().toISOString(),
        editedByUserId: 'me',
      },
    ])
    found.comment.body = body
    found.comment.editedAt = new Date().toISOString()
    activity(found.state, 'Edited a comment')
    return HttpResponse.json(found.comment)
  }),
  http.delete(`${BASE}/comments/:id`, ({ params }) => {
    const found = findComment(Number(params.id))
    if (!found) return missing()
    found.comment.deleted = true
    found.comment.body = null
    activity(found.state, 'Deleted a comment')
    return HttpResponse.json({ success: true })
  }),
  ...(['resolve', 'reopen'] as const).map((action) =>
    http.post(`${BASE}/comments/:id/${action}`, ({ params }) => {
      const found = findComment(Number(params.id))
      if (!found) return missing()
      found.root.resolved = action === 'resolve'
      activity(found.state, action === 'resolve' ? 'Resolved a thread' : 'Reopened a thread')
      return HttpResponse.json({ success: true })
    })
  ),
  http.get(`${BASE}/comments/:id/history`, ({ params, request }) =>
    HttpResponse.json(mockPage(histories.get(Number(params.id)) ?? [], request))
  ),
  http.get(`${BASE}/mentions/candidates`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? ''
    return HttpResponse.json(
      mockPage(
        [
          { person: { userId: 'sam', displayName: 'Sam Parker' }, canRead: 'false' },
          { person: { userId: 'alex', displayName: 'Alex Rivera' }, canRead: 'true' },
          { person: { userId: 'morgan', displayName: 'Morgan Lee' }, canRead: 'unknown' },
        ].filter((item) => item.person.displayName.toLowerCase().includes(q)),
        request
      )
    )
  }),
  http.get(`${BASE}/records/:table/:pk/attachments`, ({ params, request }) =>
    HttpResponse.json(
      mockPage(recordState(String(params.table), String(params.pk)).attachments, request)
    )
  ),
  http.post(`${BASE}/records/:table/:pk/attachments`, async ({ params, request }) => {
    const state = recordState(String(params.table), String(params.pk))
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File))
      return HttpResponse.json({ error: 'One file is required' }, { status: 400 })
    const attachment: Attachment = {
      id: objectId++,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      createdByUserId: 'You',
      createDate: new Date().toISOString(),
      canDelete: true,
      tableName: String(params.table),
      recordId: String(params.pk),
    }
    fileBytes.set(attachment.id, { bytes: await file.arrayBuffer(), type: attachment.contentType! })
    state.attachments.unshift(attachment)
    activity(state, `Added file ${file.name}`)
    return HttpResponse.json(attachment)
  }),
  http.patch(`${BASE}/attachments/:id`, async ({ params, request }) => {
    const found = findAttachment(Number(params.id))
    if (!found) return missing()
    Object.assign(found.file, await request.json())
    return HttpResponse.json(found.file)
  }),
  http.delete(`${BASE}/attachments/:id`, ({ params }) => {
    const found = findAttachment(Number(params.id))
    if (!found) return missing()
    found.state.attachments = found.state.attachments.filter((item) => item.id !== found.file.id)
    fileBytes.delete(found.file.id)
    activity(found.state, `Deleted file ${found.file.fileName}`)
    return HttpResponse.json({ success: true })
  }),
  ...(['preview', 'download'] as const).map((mode) =>
    http.get(`${BASE}/attachments/:id/${mode}`, ({ params }) =>
      findAttachment(Number(params.id))
        ? HttpResponse.json({ url: `${BASE}/mock-files/${params.id}` })
        : missing()
    )
  ),
  http.get(`${BASE}/mock-files/:id`, ({ params }) => {
    const file = fileBytes.get(Number(params.id))
    return file
      ? new HttpResponse(file.bytes, { headers: { 'Content-Type': file.type } })
      : new HttpResponse('Notes from our introductory call.', {
          headers: { 'Content-Type': 'text/plain' },
        })
  }),
  http.get(`${BASE}/tags`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? ''
    return HttpResponse.json({
      items: vocabulary.filter((tag) => tag.label.toLowerCase().includes(q)),
      nextCursor: null,
    })
  }),
  http.post(`${BASE}/tags`, async ({ request }) => {
    const input = (await request.json()) as { table: string; label: string }
    const approved =
      qInstance.tables[input.table]?.recordFeatures?.settings?.TAGS?.mode !== 'APPROVED_ONLY'
    const tag = {
      id: objectId++,
      label: input.label,
      name: input.label.trim().toLowerCase().replace(/\s+/g, ' '),
      approved,
      tableName: input.table,
    }
    vocabulary.push(tag)
    return HttpResponse.json(tag)
  }),
  http.get(`${BASE}/records/:table/:pk/tags`, ({ params, request }) =>
    HttpResponse.json(mockPage(recordState(String(params.table), String(params.pk)).tags, request))
  ),
  http.put(`${BASE}/records/:table/:pk/tags`, async ({ params, request }) => {
    const state = recordState(String(params.table), String(params.pk))
    const input = (await request.json()) as { add?: number[]; remove?: number[] }
    state.tags = [
      ...state.tags.filter((tag) => !input.remove?.includes(tag.id)),
      ...vocabulary.filter(
        (tag) =>
          input.add?.includes(tag.id) &&
          tag.approved &&
          !state.tags.some((item) => item.id === tag.id)
      ),
    ]
    activity(state, 'Updated tags')
    return HttpResponse.json({ items: state.tags, nextCursor: null })
  }),
  http.get(`${BASE}/records/:table/:pk/follow`, ({ params }) =>
    HttpResponse.json(recordState(String(params.table), String(params.pk)).follow)
  ),
  http.put(`${BASE}/records/:table/:pk/follow`, async ({ params, request }) => {
    const state = recordState(String(params.table), String(params.pk))
    const preferences = (await request.json()) as {
      notifyOnChange?: boolean
      notifyOnComment?: boolean
    }
    state.follow = {
      following: true,
      follow: {
        id: 33,
        userId: 'me',
        reason: 'MANUAL',
        notifyOnChange: true,
        notifyOnComment: true,
        ...state.follow.follow,
        ...preferences,
      },
    }
    activity(state, 'Followed this record')
    return HttpResponse.json(state.follow)
  }),
  http.delete(`${BASE}/records/:table/:pk/follow`, ({ params }) => {
    const state = recordState(String(params.table), String(params.pk))
    state.follow = { following: false, follow: null }
    return HttpResponse.json(state.follow)
  }),
  http.get(`${BASE}/records/:table/:pk/followers`, ({ params, request }) => {
    const state = recordState(String(params.table), String(params.pk))
    return HttpResponse.json(
      mockPage([...state.followers, ...(state.follow.follow ? [state.follow.follow] : [])], request)
    )
  }),
  http.get(`${BASE}/records/:table/:pk/timeline`, ({ params, request }) =>
    HttpResponse.json(
      mockPage(recordState(String(params.table), String(params.pk)).timeline, request)
    )
  )
)

/** Supplies the virtual query column from the same mutable tags as the panel.
 * @param table - Parent table.
 * @param pk - Parent key.
 * @returns Applied tags, or null for tables without this feature.
 */
export function mockRecordTags(table: string, pk: string): CollaborationTag[] | null {
  return qInstance.tables[table]?.recordFeatures?.features?.includes('TAGS')
    ? recordState(table, pk).tags
    : null
}

// Realtime/phase g–i mock backend. Controllers stay in this MSW client's lifetime.
const streams = new Map<
  string,
  {
    controller: ReadableStreamDefaultController<Uint8Array>
    channels: Set<string>
    sequence: number
  }
>()
const encoder = new TextEncoder()
/** Publishes a fixture event to subscribed mock streams.
 * @param event - Named event.
 * @param data - Contract payload.
 */
export function publishCollaborationEvent(event: string, data: Record<string, unknown>) {
  for (const [id, stream] of streams) {
    const channel = data.table
      ? data.pk
        ? `record:${data.table}:${data.pk}`
        : `table:${data.table}`
      : 'user:me'
    if (!stream.channels.has(channel) && event !== 'resync' && event !== 'session-ended') continue
    try {
      stream.controller.enqueue(
        encoder.encode(
          `id: ${id}:${++stream.sequence}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        )
      )
    } catch {
      streams.delete(id)
    }
  }
}
const people = [
  // The mock session's own directory entry; the share picker leaves it out.
  { userId: 'me', displayName: 'Anonymous', email: 'anonymous@localhost' },
  { userId: 'alex', displayName: 'Alex Rivera' },
  { userId: 'sam', displayName: 'Sam Parker' },
  { userId: 'unknown', displayName: 'Taylor Chen' },
]
const viewers = [
  { userId: 'sam', displayName: 'Sam Parker', mode: 'EDITING', fieldName: 'firstName' },
  { userId: 'alex', displayName: 'Alex Rivera', mode: 'VIEWING' },
]
const taskStore: import('@/types/collaboration').CollaborationTaskV1[] = [
  {
    id: 8001,
    tableName: 'person',
    recordId: '1',
    title: 'Review customer requirements',
    notes: 'Confirm the **delivery date**.',
    assigneeUserId: 'alex',
    status: 'OPEN',
    dueAt: '2026-10-01T12:00:00Z',
  },
]
const assignments = new Map<
  string,
  { ownerUserId?: string | null; assigneeUserId?: string | null }
>()
collaborationHandlers.push(
  http.get('/qqq/v1/realtime/stream', ({ request }) => {
    const id = `mock-${objectId++}`
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streams.set(id, { controller, channels: new Set(), sequence: 0 })
        controller.enqueue(
          encoder.encode(
            `id: ${id}:0\nevent: hello\ndata: ${JSON.stringify({ connectionId: id, heartbeatSeconds: 25, metaDataGeneration: 1 })}\n\n`
          )
        )
        if (request.headers.get('Last-Event-ID'))
          controller.enqueue(encoder.encode('event: resync\ndata: {}\n\n'))
        request.signal.addEventListener('abort', () => {
          streams.delete(id)
          try {
            controller.close()
          } catch {
            /* Already closed. */
          }
        })
      },
      cancel() {
        streams.delete(id)
      },
    })
    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }),
  http.post('/qqq/v1/realtime/subscriptions', async ({ request }) => {
    const body = (await request.json()) as {
      connectionId: string
      add?: string[]
      remove?: string[]
    }
    const stream = streams.get(body.connectionId)
    if (!stream) return missing()
    for (const channel of body.add ?? []) stream.channels.add(channel)
    for (const channel of body.remove ?? []) stream.channels.delete(channel)
    return HttpResponse.json({ active: [...stream.channels], refused: [] })
  }),
  http.post('/qqq/v1/mock/realtime', async ({ request }) => {
    const body = (await request.json()) as { event: string; data: Record<string, unknown> }
    publishCollaborationEvent(body.event, body.data)
    return HttpResponse.json({ success: true })
  }),
  http.get(`${BASE}/presence`, ({ request }) => {
    const params = new URL(request.url).searchParams
    return HttpResponse.json({ table: params.get('table'), pk: params.get('pk'), viewers })
  }),
  http.post(`${BASE}/presence`, async ({ request }) => {
    const input = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ table: input.table, pk: input.pk, viewers })
  }),
  http.delete(`${BASE}/presence`, () => HttpResponse.json({ success: true })),
  http.get(`${BASE}/people`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? ''
    return HttpResponse.json({
      items: people.filter((p) => `${p.displayName} ${p.userId}`.toLowerCase().includes(q)),
      nextCursor: null,
    })
  }),
  http.get(`${BASE}/records/:table/:pk/link`, ({ params, request }) =>
    HttpResponse.json({
      url: `${new URL(request.url).origin}/app/${params.table}/${params.pk}`,
      label: 'Record link',
    })
  ),
  http.post(`${BASE}/records/:table/:pk/shares/preview`, async ({ request }) => {
    const input = (await request.json()) as { toUserIds: string[] }
    return HttpResponse.json({
      recipients: input.toUserIds.map((id) => ({
        userId: id,
        displayName: people.find((p) => p.userId === id)?.displayName,
        canRead: id === 'unknown' ? null : id !== 'sam',
      })),
    })
  }),
  http.post(`${BASE}/records/:table/:pk/shares`, async ({ params, request }) => {
    const input = (await request.json()) as { toUserIds: string[]; message: string }
    return HttpResponse.json({
      items: input.toUserIds.map((id) => ({
        id: objectId++,
        tableName: params.table,
        recordId: params.pk,
        toUserId: id,
        recipientCouldRead: id === 'alex',
        message: input.message,
      })),
    })
  }),
  http.post(`${BASE}/access-requests`, async () =>
    HttpResponse.json({ id: objectId++, status: 'PENDING' })
  ),
  http.get(`${BASE}/records/:table/:pk/tasks`, ({ params, request }) =>
    HttpResponse.json(
      mockPage(
        taskStore.filter((task) => task.tableName === params.table && task.recordId === params.pk),
        request
      )
    )
  ),
  http.post(`${BASE}/records/:table/:pk/tasks`, async ({ params, request }) => {
    const input =
      (await request.json()) as import('@/types/collaboration').CollaborationTaskCreateRequestV1
    if (input.assigneeUserId && input.assigneeUserId !== 'alex')
      return HttpResponse.json({ error: 'The assignee cannot open this record.' }, { status: 400 })
    const task = {
      ...input,
      id: objectId++,
      status: 'OPEN',
      tableName: String(params.table),
      recordId: String(params.pk),
    }
    taskStore.push(task)
    publishCollaborationEvent('task.changed', {
      table: params.table,
      pk: params.pk,
      taskId: task.id,
    })
    return HttpResponse.json(task)
  }),
  http.patch(`${BASE}/tasks/:id`, async ({ params, request }) => {
    const task = taskStore.find((t) => String(t.id) === params.id)
    if (!task) return missing()
    const input =
      (await request.json()) as import('@/types/collaboration').CollaborationTaskPatchRequestV1
    if (input.assigneeUserId && input.assigneeUserId !== 'alex')
      return HttpResponse.json({ error: 'The assignee cannot open this record.' }, { status: 400 })
    Object.assign(task, input)
    publishCollaborationEvent('task.changed', {
      table: task.tableName,
      pk: task.recordId,
      taskId: task.id,
    })
    return HttpResponse.json(task)
  }),
  http.get(`${BASE}/tasks/mine`, ({ request }) =>
    HttpResponse.json(
      mockPage(
        taskStore.filter((t) => t.status === 'OPEN'),
        request
      )
    )
  ),
  http.put(`${BASE}/records/:table/:pk/assignment`, async ({ params, request }) => {
    const input = (await request.json()) as { ownerUserId?: string; assigneeUserId?: string }
    const key = `${params.table}/${params.pk}`
    const value = { ...assignments.get(key), ...input }
    assignments.set(key, value)
    return HttpResponse.json(value)
  }),
  http.get('/qqq/v1/table/:table/:pk/features', ({ params }) => {
    const assignment = assignments.get(`${params.table}/${params.pk}`)
    return HttpResponse.json({
      capabilities: qInstance.tables[String(params.table)]?.recordFeatures?.capabilities,
      owner: assignment?.ownerUserId ?? 'Alex Rivera',
      assignee: assignment?.assigneeUserId ?? 'Sam Parker',
    })
  }),
  http.get(`${BASE}/my-work`, () =>
    HttpResponse.json({
      tasks: taskStore.filter((t) => t.status === 'OPEN'),
      openTaskCount: taskStore.filter((t) => t.status === 'OPEN').length,
      assignedRecordsByTable: { person: 1 },
      unreadMentionCount: 2,
    })
  )
)

/** Assignment fields used by the mock query expander.
 * @param table - Parent table.
 * @param pk - Parent key.
 * @returns Fixture assignment.
 */
export function mockRecordAssignment(table: string, pk: string) {
  return (
    assignments.get(`${table}/${pk}`) ??
    (table === 'person' && pk === '1' ? { ownerUserId: 'me', assigneeUserId: 'alex' } : undefined)
  )
}
