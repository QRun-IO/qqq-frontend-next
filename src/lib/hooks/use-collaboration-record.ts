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

/** @file Lazy record collaboration queries, writes and optimistic rollback. */
'use client'

import {
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query'
import type {
  CollaborationRecord,
  CollaborationPage,
  CollaborationTag,
  CommentPage,
  FollowState,
  CollaborationFollowRequestV1,
  CollaborationCommentPostRequestV1,
  CollaborationAttachmentPatchRequestV1,
} from '@/types/collaboration'
import { queryKeys } from '@/lib/query-client'
import * as api from '@/lib/api/collaboration'

/** Reads paged record resources only when enabled.
 * @param record - Parent identity.
 * @param resource - Cache resource.
 * @param read - Page reader.
 * @param enabled - Whether this surface needs the data.
 * @returns Infinite query.
 */
function useRecordPages<T extends { nextCursor: string | null }>(
  record: CollaborationRecord,
  resource: string,
  read: (record: CollaborationRecord, cursor?: string) => Promise<T>,
  enabled = true
) {
  return useInfiniteQuery({
    queryKey: queryKeys.collaborationResource(record.table, record.pk, resource),
    queryFn: ({ pageParam }) => read(record, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last, pages, lastParam, params) =>
      last.nextCursor && last.nextCursor !== lastParam && !params.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
    enabled,
  })
}
/** Attachment pages.
 * @param record - Parent identity.
 * @param enabled - Surface active.
 * @returns Query.
 */
export function useAttachments(record: CollaborationRecord, enabled = true) {
  return useRecordPages(record, 'attachments', api.listAttachments, enabled)
}
/** Comment thread pages.
 * @param record - Parent identity.
 * @param enabled - Surface active.
 * @returns Query.
 */
export function useComments(record: CollaborationRecord, enabled = true) {
  return useRecordPages(record, 'comments', api.listComments, enabled)
}
/** Timeline pages.
 * @param record - Parent identity.
 * @param enabled - Surface active.
 * @returns Query.
 */
export function useTimeline(record: CollaborationRecord, enabled = true) {
  return useRecordPages(record, 'timeline', api.listTimeline, enabled)
}
/** Follower pages.
 * @param record - Parent identity.
 * @param enabled - Surface active.
 * @returns Query.
 */
export function useFollowers(record: CollaborationRecord, enabled = true) {
  return useRecordPages(record, 'followers', api.listFollowers, enabled)
}
/** Applied tags.
 * @param record - Parent identity.
 * @returns Query.
 */
export function useRecordTags(record: CollaborationRecord) {
  return useQuery({
    queryKey: queryKeys.collaborationResource(record.table, record.pk, 'tags'),
    queryFn: () => api.getRecordTags(record),
  })
}
/** Tag vocabulary search.
 * @param table - Table name.
 * @param q - Search text.
 * @param enabled - Picker open.
 * @returns Query.
 */
export function useTagVocabulary(table: string, q: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.collaborationVocabulary(table, q),
    queryFn: () => api.tagVocabulary(table, q),
    enabled,
  })
}
/** Follow state.
 * @param record - Parent identity.
 * @returns Query.
 */
export function useFollow(record: CollaborationRecord) {
  return useQuery({
    queryKey: queryKeys.collaborationResource(record.table, record.pk, 'follow'),
    queryFn: () => api.getFollow(record),
  })
}
/** Mention candidates for the current autocomplete term.
 * @param record - Parent identity.
 * @param q - Search term, null when autocomplete is closed.
 * @returns Query.
 */
export function useMentionCandidates(record: CollaborationRecord, q: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.collaborationMentions(record.table, record.pk, q ?? ''),
    queryFn: ({ pageParam }) => api.mentionCandidates(record, q ?? '', pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: q !== null,
  })
}
/** Previous comment bodies, fetched only when history opens.
 * @param id - Comment identity.
 * @param enabled - Popover open.
 * @returns Query.
 */
export function useCommentHistory(id: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.collaborationHistory(id),
    queryFn: ({ pageParam }) => api.commentHistory(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  })
}
/** Ephemeral attachment URL; never place it in persistent record data.
 * @param id - Attachment identity.
 * @param mode - Disposition.
 * @param enabled - Preview requested.
 * @returns URL query.
 */
export function useAttachmentUrl(id: number, mode: 'preview' | 'download', enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.collaborationResource('attachment', String(id), mode),
    queryFn: () => api.attachmentUrl(id, mode),
    enabled,
    staleTime: 0,
    gcTime: 0,
  })
}

/** Optimistic writes share a pending lock across all controls for this resource.
 * @param record - Parent identity.
 * @param key - Optimistic cache entry.
 * @param write - Server mutation.
 * @param optimistic - Applies an immutable local update.
 * @returns Mutation with shared pending state.
 */
function useOptimistic<T, V>(
  record: CollaborationRecord,
  key: QueryKey,
  write: (input: V) => Promise<unknown>,
  optimistic: (previous: T | undefined, input: V) => T
) {
  const client = useQueryClient()
  const mutationKey = [...key, 'write']
  const pending = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: (m) => m.state.status,
  })
  const mutation = useMutation({
    mutationKey,
    mutationFn: write,
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<T>(key)
      client.setQueryData(key, optimistic(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) client.setQueryData(key, context.previous)
      else client.removeQueries({ queryKey: key, exact: true })
    },
    onSettled: () =>
      client.invalidateQueries({
        queryKey: queryKeys.collaborationRecord(record.table, record.pk),
      }),
  })
  return { ...mutation, isPending: mutation.isPending || pending.length > 0 }
}
/** Applies tag changes immediately and restores the previous list on failure.
 * @param record - Parent identity.
 * @returns Tag mutation.
 */
export function useUpdateTags(record: CollaborationRecord) {
  const client = useQueryClient()
  return useOptimistic<
    CollaborationPage<CollaborationTag>,
    { add?: CollaborationTag[]; remove?: number[] }
  >(
    record,
    queryKeys.collaborationResource(record.table, record.pk, 'tags'),
    async (input) => {
      const result = await api.putRecordTags(record, {
        add: input.add?.map((tag) => tag.id),
        remove: input.remove,
      })
      void client.invalidateQueries({ queryKey: queryKeys.tableRecords(record.table) })
      return result
    },
    (previous, input) => ({
      items: [
        ...(previous?.items ?? []).filter((tag) => !input.remove?.includes(tag.id)),
        ...(input.add ?? []).filter((tag) => !previous?.items.some((item) => item.id === tag.id)),
      ],
      nextCursor: null,
    })
  )
}
/** Optimistic follow preferences and rollback.
 * @param record - Parent identity.
 * @returns Follow mutation; null unfollows.
 */
export function useUpdateFollow(record: CollaborationRecord) {
  return useOptimistic<FollowState, CollaborationFollowRequestV1 | null>(
    record,
    queryKeys.collaborationResource(record.table, record.pk, 'follow'),
    (input) => (input === null ? api.deleteFollow(record) : api.putFollow(record, input)),
    (previous, input) =>
      input === null
        ? { following: false, follow: null }
        : {
            following: true,
            follow: { notifyOnChange: true, notifyOnComment: true, ...previous?.follow, ...input },
          }
  )
}
/** Optimistic resolve/reopen across all loaded thread pages.
 * @param record - Parent identity.
 * @returns Resolve mutation.
 */
export function useResolveComment(record: CollaborationRecord) {
  return useOptimistic<InfiniteData<CommentPage>, { id: number; resolved: boolean }>(
    record,
    queryKeys.collaborationResource(record.table, record.pk, 'comments'),
    ({ id, resolved }) => api.resolveComment(id, resolved),
    (previous, input) => ({
      pages: (previous?.pages ?? []).map((page) => ({
        ...page,
        threads: page.threads.map((thread) =>
          thread.id === input.id ? { ...thread, resolved: input.resolved } : thread
        ),
      })),
      pageParams: previous?.pageParams ?? [],
    })
  )
}
/** Invalidates record counts and activity after non-optimistic writes.
 * @param record - Parent identity.
 * @param write - Server mutation.
 * @returns Mutation.
 */
function useRecordWrite<V>(record: CollaborationRecord, write: (input: V) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: write,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: queryKeys.collaborationRecord(record.table, record.pk),
      }),
  })
}
/** Comment post/edit/delete operations.
 * @param record - Parent identity.
 * @returns Separate mutation states.
 */
export function useCommentActions(record: CollaborationRecord) {
  const client = useQueryClient()
  const post = useRecordWrite(record, (input: CollaborationCommentPostRequestV1) =>
    api.postComment(record, input)
  )
  const edit = useRecordWrite(record, async ({ id, body }: { id: number; body: string }) => {
    const result = await api.editComment(id, body)
    void client.invalidateQueries({ queryKey: queryKeys.collaborationHistory(id) })
    return result
  })
  const remove = useRecordWrite(record, (id: number) => api.deleteComment(id))
  return { post, edit, remove }
}
/** File upload, edit and delete operations.
 * @param record - Parent identity.
 * @returns Separate mutation states.
 */
export function useAttachmentActions(record: CollaborationRecord) {
  const upload = useRecordWrite(
    record,
    ({ file, onProgress }: { file: File; onProgress: (value: number) => void }) =>
      api.uploadAttachment(record, file, onProgress)
  )
  const patch = useRecordWrite(
    record,
    ({ id, patch }: { id: number; patch: CollaborationAttachmentPatchRequestV1 }) =>
      api.patchAttachment(id, patch)
  )
  const remove = useRecordWrite(record, (id: number) => api.deleteAttachment(id))
  return { upload, patch, remove }
}
/** Creates a vocabulary entry and refreshes matching searches.
 * @param table - Table name.
 * @returns Create/suggest mutation.
 */
export function useCreateTag(table: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (label: string) => api.createTag({ table, label }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.collaborationVocabularyRoot(table) }),
  })
}

/** Record tasks, including done items, paged without losing cursor state.
 * @param record - Parent identity.
 * @param enabled - Feature enabled.
 * @returns Query.
 */
export function useTasks(record: CollaborationRecord, enabled = true) {
  return useRecordPages(record, 'tasks', api.listTasks, enabled)
}
/** Task writes refresh record panels and My work.
 * @param record - Parent identity.
 * @returns Create and edit operations.
 */
export function useTaskActions(record: CollaborationRecord) {
  const client = useQueryClient()
  const refreshWork = () => {
    void client.invalidateQueries({ queryKey: queryKeys.collaborationMyWork() })
  }
  const create = useRecordWrite(
    record,
    async (input: import('@/types/collaboration').CollaborationTaskCreateRequestV1) => {
      const result = await api.createTask(record, input)
      refreshWork()
      return result
    }
  )
  const patch = useRecordWrite(
    record,
    async ({
      id,
      input,
    }: {
      id: number
      input: import('@/types/collaboration').CollaborationTaskPatchRequestV1
    }) => {
      const result = await api.patchTask(id, input)
      refreshWork()
      return result
    }
  )
  return { create, patch }
}
