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

import { beforeEach, expect, it, vi } from 'vitest'
import apiClient from './client'
import * as api from './collaboration'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
const record = { table: 'a/b', pk: 'x y' }
beforeEach(() => vi.resetAllMocks())

it('normalizes nullable pages and preserves opaque cursors with encoded identities', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ items: null, nextCursor: 'opaque:/==' })
  expect(await api.listAttachments(record, 'previous')).toEqual({
    items: [],
    nextCursor: 'opaque:/==',
  })
  expect(apiClient.get).toHaveBeenCalledWith(
    '/qbit/collaboration/records/a%2Fb/x%20y/attachments',
    { params: { cursor: 'previous', limit: 20 } }
  )
})
it('drops deleted bodies, fails closed on permissions and sorts replies oldest first', () => {
  const comment = api.normalizeComment({
    id: 1,
    deleted: true,
    body: 'sensitive',
    canEdit: 'true',
    replies: [
      { id: 3, createdAt: '2026-10-12' },
      { id: 2, createdAt: '2026-10-11' },
    ],
  })
  expect(comment.body).toBeNull()
  expect(comment.canEdit).toBe(false)
  expect(comment.replies.map((r) => r.id)).toEqual([2, 3])
  expect(comment.replies[0].replies).toEqual([])
  expect(() => api.normalizeAttachment({ fileName: 'missing id' })).toThrow('identifier')
})
it('normalizes string mention access and unknown decisions', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    items: [
      { person: { userId: 'sam', displayName: 'Sam' }, canRead: 'false' },
      { person: { userId: 'other' }, canRead: null },
    ],
    nextCursor: null,
  })
  const result = await api.mentionCandidates(record, 'sam')
  expect(result.items.map((item) => item.canRead)).toEqual(['false', 'unknown'])
})
it('keeps multipart content and upload progress on the shared axios client', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ id: 8, fileName: 'hello.txt' })
  const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
  const progress = vi.fn()
  await api.uploadAttachment(record, file, progress, 'Notes')
  const [, form, config] = vi.mocked(apiClient.post).mock.calls[0]
  expect((form as FormData).get('file')).toBe(file)
  expect((form as FormData).get('description')).toBe('Notes')
  expect(config?.headers?.['Content-Type']).toBeUndefined()
  config?.onUploadProgress?.({ loaded: 3, total: 5, bytes: 3, lengthComputable: true })
  expect(progress).toHaveBeenCalledWith(60)
})
it.each(['javascript:alert(1)', '//outside.test/x', '/\\outside.test/x', 'data:text/html,hi'])(
  'rejects unsafe attachment URL %s',
  async (url) => {
    vi.mocked(apiClient.get).mockResolvedValue({ url })
    await expect(api.attachmentUrl(8, 'preview')).rejects.toThrow('Invalid attachment URL')
  }
)
it('accepts presigned URLs without persisting or rewriting them', async () => {
  const url = 'https://storage.example.test/file?signature=temporary'
  vi.mocked(apiClient.get).mockResolvedValue({ url })
  expect(await api.attachmentUrl(8, 'download')).toEqual({ url })
})
it('reads all record tags and rejects repeating cursors', async () => {
  vi.mocked(apiClient.get)
    .mockResolvedValueOnce({ items: [{ id: 1, label: 'One' }], nextCursor: 'next' })
    .mockResolvedValueOnce({ items: [{ id: 2, label: 'Two' }], nextCursor: null })
  expect((await api.getRecordTags(record)).items.map((tag) => tag.id)).toEqual([1, 2])
  vi.mocked(apiClient.get).mockResolvedValue({ items: [], nextCursor: 'repeat' })
  await expect(api.getRecordTags(record)).rejects.toThrow('repeated cursor')
})
it('validates resolve acknowledgements so optimistic rollback can run', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ success: false })
  await expect(api.resolveComment(2, true)).rejects.toThrow('not acknowledged')
})
it('normalizes null follow state and timeline details', async () => {
  expect(api.normalizeFollow({ following: false, follow: { notifyOnChange: true } })).toEqual({
    following: false,
    follow: null,
  })
  vi.mocked(apiClient.get).mockResolvedValue({
    items: [{ id: 1, kind: 'AUDIT', details: null }],
    nextCursor: 'older',
  })
  const result = await api.listTimeline(record, 'before')
  expect(result.items[0].details).toEqual([])
  expect(result.nextCursor).toBe('older')
})

it('uses the exact singular-resource routes and request schemas for file and comment writes', async () => {
  vi.mocked(apiClient.patch).mockResolvedValueOnce({ id: 8, fileName: 'renamed.txt' })
  await api.patchAttachment(8, { fileName: 'renamed.txt', description: '' })
  expect(apiClient.patch).toHaveBeenLastCalledWith('/qbit/collaboration/attachments/8', {
    fileName: 'renamed.txt',
    description: '',
  })
  vi.mocked(apiClient.delete).mockResolvedValue({ success: true })
  await api.deleteAttachment(8)
  expect(apiClient.delete).toHaveBeenLastCalledWith('/qbit/collaboration/attachments/8')
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    threads: [{ id: 4, body: 'Root', replies: null }],
    nextCursor: 'more',
  })
  expect(await api.listComments(record, 'older')).toMatchObject({
    threads: [{ id: 4, replies: [] }],
    nextCursor: 'more',
  })
  expect(apiClient.get).toHaveBeenLastCalledWith(
    '/qbit/collaboration/records/a%2Fb/x%20y/comments',
    { params: { cursor: 'older', limit: 20 } }
  )
  vi.mocked(apiClient.post).mockResolvedValueOnce({ id: 5, body: 'Reply' })
  await api.postComment(record, { body: 'Reply', parentCommentId: 4, fieldName: 'email' })
  expect(apiClient.post).toHaveBeenLastCalledWith(
    '/qbit/collaboration/records/a%2Fb/x%20y/comments',
    { body: 'Reply', parentCommentId: 4, fieldName: 'email' }
  )
  vi.mocked(apiClient.patch).mockResolvedValueOnce({ id: 5, body: 'Edited' })
  await api.editComment(5, 'Edited')
  expect(apiClient.patch).toHaveBeenLastCalledWith('/qbit/collaboration/comments/5', {
    body: 'Edited',
  })
  await api.deleteComment(5)
  expect(apiClient.delete).toHaveBeenLastCalledWith('/qbit/collaboration/comments/5')
  vi.mocked(apiClient.post).mockResolvedValue({ success: true })
  await api.resolveComment(4, false)
  expect(apiClient.post).toHaveBeenLastCalledWith('/qbit/collaboration/comments/4/reopen')
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    items: [{ id: 1, body: 'Old body', editedAt: '2026-10-13', editedByUserId: 'me' }],
    nextCursor: null,
  })
  expect((await api.commentHistory(5, 'revisions')).items[0].body).toBe('Old body')
  expect(apiClient.get).toHaveBeenLastCalledWith('/qbit/collaboration/comments/5/history', {
    params: { cursor: 'revisions', limit: 20 },
  })
})
it('uses vocabulary, delta-tag and follow-state envelopes rather than mutation acknowledgements', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    items: [{ id: 3, label: 'Priority', approved: true }],
    nextCursor: null,
  })
  expect((await api.tagVocabulary('person', 'prior')).items[0].approved).toBe(true)
  expect(apiClient.get).toHaveBeenLastCalledWith('/qbit/collaboration/tags', {
    params: { table: 'person', q: 'prior', limit: 100 },
  })
  vi.mocked(apiClient.post).mockResolvedValueOnce({ id: 4, label: 'Suggestion', approved: false })
  expect((await api.createTag({ table: 'person', label: 'Suggestion' })).approved).toBe(false)
  expect(apiClient.post).toHaveBeenLastCalledWith('/qbit/collaboration/tags', {
    table: 'person',
    label: 'Suggestion',
  })
  vi.mocked(apiClient.put).mockResolvedValueOnce({
    items: [{ id: 3, label: 'Priority' }],
    nextCursor: null,
  })
  expect((await api.putRecordTags(record, { add: [3], remove: [2] })).items[0].id).toBe(3)
  expect(apiClient.put).toHaveBeenLastCalledWith('/qbit/collaboration/records/a%2Fb/x%20y/tags', {
    add: [3],
    remove: [2],
  })
  const state = {
    following: true,
    follow: {
      id: 6,
      userId: 'me',
      notifyOnChange: false,
      notifyOnComment: true,
      reason: 'MANUAL',
      mutedUntil: null,
    },
  }
  vi.mocked(apiClient.get).mockResolvedValueOnce(state)
  expect(await api.getFollow(record)).toEqual(state)
  vi.mocked(apiClient.put).mockResolvedValueOnce(state)
  expect(await api.putFollow(record, { notifyOnChange: false })).toEqual(state)
  expect(apiClient.put).toHaveBeenLastCalledWith('/qbit/collaboration/records/a%2Fb/x%20y/follow', {
    notifyOnChange: false,
  })
  vi.mocked(apiClient.delete).mockResolvedValueOnce({ following: false, follow: null })
  expect(await api.deleteFollow(record)).toEqual({ following: false, follow: null })
  vi.mocked(apiClient.get).mockResolvedValueOnce({ items: [state.follow], nextCursor: 'followers' })
  expect((await api.listFollowers(record, 'more')).items[0]).toEqual(state.follow)
  expect(apiClient.get).toHaveBeenLastCalledWith(
    '/qbit/collaboration/records/a%2Fb/x%20y/followers',
    { params: { cursor: 'more', limit: 100 } }
  )
})
