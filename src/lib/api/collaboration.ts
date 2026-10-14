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

/** @file Typed collaboration favorites, recents, and optional-extension discovery. */

import type {
  Attachment,
  CollaborationTag,
  CollaborationComment,
  CommentPage,
  FollowState,
  MentionCandidate,
  CollaborationPage,
  CollaborationRecord,
  CollaborationAttachmentPatchRequestV1,
  CollaborationCommentPostRequestV1,
  CollaborationCommentRevisionV1,
  CollaborationFollowRequestV1,
  CollaborationFollowV1,
  CollaborationTagApplyRequestV1,
  CollaborationTagCreateRequestV1,
  CollaborationTimelineItemV1,
  CollaborationFavorite,
  CollaborationFavoriteOrder,
  CollaborationList,
  CollaborationMutationResult,
  CollaborationTarget,
  CollaborationTargetType,
} from '@/types/collaboration'
import type {
  PresenceRequest,
  PresenceTarget,
  PresenceSnapshot,
  CollaborationLinkV1,
  CollaborationShareRequestV1,
  CollaborationSharePreviewV1,
  CollaborationShareListV1,
  CollaborationAccessRequestCreateRequestV1,
  CollaborationAccessRequestV1,
  CollaborationTaskV1,
  CollaborationTaskCreateRequestV1,
  CollaborationTaskPatchRequestV1,
  CollaborationAssignmentRequestV1,
  CollaborationAssignmentV1,
  CollaborationMyWorkV1,
  RecordFeatureSummary,
  CollaborationPersonV1,
} from '@/types/collaboration'

import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { internalAppHref } from '@/lib/utils/internal-app-href'
import apiClient from './client'

const BASE = '/qbit/collaboration'
const TARGET_TYPES: CollaborationTargetType[] = [
  'TABLE',
  'APP',
  'RECORD',
  'PROCESS',
  'REPORT',
  'SAVED_VIEW',
]
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const string = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null
const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/**
 * Drops malformed targets and never exposes cached labels or links for unavailable entries.
 * @param raw - Untrusted response body.
 * @returns A safe list retaining its opaque continuation cursor.
 */
export function normalizeCollaborationList(raw: unknown): CollaborationList {
  const data = object(raw)
  const items: CollaborationFavorite[] = []
  for (const value of Array.isArray(data.items) ? data.items : []) {
    const item = object(value)
    const targetType = item.targetType as CollaborationTargetType
    const targetName = string(item.targetName)
    const recordId = string(item.recordId)
    if (!TARGET_TYPES.includes(targetType) || !targetName || (targetType === 'RECORD' && !recordId))
      continue
    const available = item.available === true
    items.push({
      targetType,
      targetName,
      recordId,
      id: number(item.id),
      available,
      label: available ? (string(item.label) ?? 'Unavailable') : 'Unavailable',
      href: available ? internalAppHref(string(item.href)) : null,
      folder: string(item.folder),
      sortOrder: number(item.sortOrder),
    })
  }
  return { items, nextCursor: string(data.nextCursor) }
}

/**
 * Detects the extension through version metadata, falling back only on older backends.
 * Session caching belongs to the availability query (including negative results).
 * @returns Whether collaboration is installed for this session.
 */
export async function isCollaborationInstalled(): Promise<boolean> {
  try {
    const version = object(await apiClient.get<unknown>('/version'))
    if (Array.isArray(version.extensions))
      return version.extensions.some((extension) => object(extension).name === 'collaboration')
    if (typeof version.apiVersion === 'string') return false
  } catch (error) {
    if (![403, 404].includes(getErrorStatusCode(error) ?? 0)) throw error
  }
  try {
    const data = object(await apiClient.get<unknown>(`${BASE}/favorites`, { params: { limit: 1 } }))
    return Array.isArray(data.items) || data.items === null
  } catch (error) {
    if ([403, 404].includes(getErrorStatusCode(error) ?? 0)) return false
    throw error
  }
}

/**
 * Reads all favorite pages, preserving server order.
 * @returns The complete personal favorites list.
 */
export async function listFavorites(): Promise<CollaborationList> {
  const items: CollaborationFavorite[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  do {
    const page: CollaborationList = normalizeCollaborationList(
      await apiClient.get<unknown>(`${BASE}/favorites`, {
        params: { limit: 100, ...(cursor ? { cursor } : {}) },
      })
    )
    items.push(...page.items)
    cursor = page.nextCursor
    if (cursor && seen.has(cursor))
      throw new Error('Favorites returned a repeated continuation cursor')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return { items, nextCursor: null }
}

/**
 * Rejects invalid mutation acknowledgements so optimistic changes roll back.
 * @param raw - Response body.
 * @returns Successful acknowledgement.
 */
function acknowledgement(raw: unknown): CollaborationMutationResult {
  if (object(raw).success !== true) throw new Error('Collaboration update was not acknowledged')
  return { success: true }
}

/**
 * Stars a target for the current user.
 * @param target - Navigation identity.
 * @returns Mutation acknowledgement.
 */
export async function starFavorite(
  target: CollaborationTarget
): Promise<CollaborationMutationResult> {
  return acknowledgement(await apiClient.put(`${BASE}/favorites`, target))
}

/**
 * Removes a favorite, including an unavailable target.
 * @param target - Navigation identity.
 * @returns Mutation acknowledgement.
 */
export async function unstarFavorite(
  target: CollaborationTarget
): Promise<CollaborationMutationResult> {
  return acknowledgement(await apiClient.delete(`${BASE}/favorites`, { data: target }))
}

/**
 * Reorders favorites and changes their folders.
 * @param order - Ordered identifiers and optional folder assignments.
 * @returns Mutation acknowledgement.
 */
export async function reorderFavorites(
  order: CollaborationFavoriteOrder
): Promise<CollaborationMutationResult> {
  return acknowledgement(await apiClient.patch(`${BASE}/favorites/order`, order))
}

/**
 * Loads the newest visible targets; the server caps this list at fifty.
 * @param limit - Maximum number of targets.
 * @returns Visible recent targets in server order.
 */
export async function listRecents(limit = 50): Promise<CollaborationList> {
  const page = normalizeCollaborationList(
    await apiClient.get<unknown>(`${BASE}/recents`, { params: { limit } })
  )
  return { ...page, items: page.items.filter((item) => item.available && item.href) }
}

/**
 * Records one page open; the server also throttles repeated views.
 * @param target - Navigation identity.
 * @returns Mutation acknowledgement.
 */
export async function recordRecent(
  target: CollaborationTarget
): Promise<CollaborationMutationResult> {
  return acknowledgement(await apiClient.post(`${BASE}/recents`, target))
}

/** Encodes both record path segments independently.
 * @param record - Parent identity.
 * @returns Record resource path.
 */
function recordPath(record: CollaborationRecord) {
  return `${BASE}/records/${encodeURIComponent(record.table)}/${encodeURIComponent(record.pk)}`
}
/** Normalizes nullable list envelopes without changing opaque cursors.
 * @param raw - Response envelope.
 * @param normalize - Item boundary validator.
 * @returns Normalized page.
 */
function page<T>(raw: unknown, normalize: (value: unknown) => T): CollaborationPage<T> {
  const data = object(raw)
  return {
    items: (Array.isArray(data.items) ? data.items : []).map(normalize),
    nextCursor: string(data.nextCursor),
  }
}
/** Requires actionable numeric object identities.
 * @param raw - Wire object.
 * @returns Validated identity and fields.
 */
function identified(raw: unknown): Record<string, unknown> & { id: number } {
  const data = object(raw)
  const id = number(data.id)
  if (id === null) throw new Error('Collaboration response is missing an identifier')
  return { ...data, id }
}
/** Normalizes attachment metadata and fails closed on permissions.
 * @param raw - Wire attachment.
 * @returns Attachment.
 */
export function normalizeAttachment(raw: unknown): Attachment {
  const data = identified(raw)
  return {
    id: data.id,
    fileName: string(data.fileName),
    description: string(data.description),
    contentType: string(data.contentType),
    sizeBytes: number(data.sizeBytes),
    createdByUserId: string(data.createdByUserId),
    createDate: string(data.createDate),
    canDelete: data.canDelete === true,
    tableName: string(data.tableName),
    recordId: string(data.recordId),
    sha256: string(data.sha256),
  }
}
/** Normalizes a tag vocabulary entry.
 * @param raw - Wire tag.
 * @returns Tag.
 */
export function normalizeTag(raw: unknown): CollaborationTag {
  const data = identified(raw)
  return {
    id: data.id,
    label: string(data.label) ?? 'Tag',
    name: string(data.name),
    color: string(data.color),
    approved: data.approved === true,
    tableName: string(data.tableName),
    usageCount: number(data.usageCount),
  }
}
/** Normalizes nullable replies and strips bodies from deleted comments.
 * @param raw - Wire comment.
 * @returns Comment with oldest-first replies.
 */
export function normalizeComment(raw: unknown): CollaborationComment {
  const data = identified(raw)
  return {
    id: data.id,
    authorDisplayName: string(data.authorDisplayName),
    authorUserId: string(data.authorUserId),
    body: data.deleted === true ? null : string(data.body),
    canDelete: data.canDelete === true,
    canEdit: data.canEdit === true,
    createdAt: string(data.createdAt),
    editedAt: string(data.editedAt),
    deleted: data.deleted === true,
    resolved: data.resolved === true,
    fieldName: string(data.fieldName),
    parentCommentId: number(data.parentCommentId),
    threadId: number(data.threadId),
    mentions: (Array.isArray(data.mentions) ? data.mentions : []).map((m) => ({
      userId: string(object(m).userId),
      visible: object(m).visible === true,
    })),
    replies: (Array.isArray(data.replies) ? data.replies : [])
      .map(normalizeComment)
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
  }
}
/** Normalizes follow state and preferences.
 * @param raw - Wire follow state.
 * @returns Subscription state.
 */
export function normalizeFollow(raw: unknown): FollowState {
  const data = object(raw)
  return {
    following: data.following === true,
    follow: data.following === true ? normalizeFollower(data.follow) : null,
  }
}
/** Normalizes nullable follower preferences.
 * @param raw - Wire subscription.
 * @returns Follower.
 */
function normalizeFollower(raw: unknown): CollaborationFollowV1 {
  const data = object(raw)
  const reason = string(data.reason)
  return {
    id: number(data.id),
    userId: string(data.userId),
    notifyOnChange: data.notifyOnChange === true,
    notifyOnComment: data.notifyOnComment === true,
    mutedUntil: string(data.mutedUntil),
    reason: ['MANUAL', 'AUTHOR', 'COMMENTED', 'MENTIONED', 'ASSIGNED', 'SHARED'].includes(
      reason ?? ''
    )
      ? (reason as CollaborationFollowV1['reason'])
      : null,
  }
}
/** Reads record attachments.
 * @param record - Parent identity.
 * @param cursor - Continuation token.
 * @returns Attachment page.
 */
export async function listAttachments(record: CollaborationRecord, cursor?: string) {
  return page(
    await apiClient.get(`${recordPath(record)}/attachments`, { params: { cursor, limit: 20 } }),
    normalizeAttachment
  )
}
/** Uploads one multipart file; callers queue multiple files separately.
 * @param record - Parent identity.
 * @param file - File bytes.
 * @param onProgress - Transfer progress (0–100).
 * @param description - Optional description.
 * @returns Stored attachment.
 */
export async function uploadAttachment(
  record: CollaborationRecord,
  file: File,
  onProgress: (percent: number) => void,
  description?: string
) {
  const form = new FormData()
  form.append('file', file)
  if (description) form.append('description', description)
  return normalizeAttachment(
    await apiClient.post(`${recordPath(record)}/attachments`, form, {
      headers: { 'Content-Type': undefined },
      onUploadProgress: (event) =>
        onProgress(
          Math.min(100, Math.round((100 * event.loaded) / (event.total || file.size || 1)))
        ),
    })
  )
}
/** Gets a short-lived preview or download URL, rejecting active URL schemes.
 * @param id - Attachment identity.
 * @param mode - Desired disposition.
 * @returns Safe URL envelope, never persisted.
 */
export async function attachmentUrl(id: number, mode: 'preview' | 'download') {
  const data = object(
    await (mode === 'preview'
      ? apiClient.get(`${BASE}/attachments/${id}/preview`)
      : apiClient.get(`${BASE}/attachments/${id}/download`))
  )
  const url = string(data.url)
  if (!url || !/^(https?:\/\/|\/(?!\/))/.test(url) || /[\\\u0000-\u0020]/.test(url))
    throw new Error('Invalid attachment URL')
  return { url }
}
/** Updates file display metadata.
 * @param id - Attachment identity.
 * @param patch - Display changes.
 * @returns Updated attachment.
 */
export async function patchAttachment(id: number, patch: CollaborationAttachmentPatchRequestV1) {
  return normalizeAttachment(await apiClient.patch(`${BASE}/attachments/${id}`, patch))
}
/** Deletes one attachment.
 * @param id - Attachment identity.
 * @returns Acknowledgement.
 */
export async function deleteAttachment(id: number) {
  return acknowledgement(await apiClient.delete(`${BASE}/attachments/${id}`))
}
/** Searches the table vocabulary.
 * @param table - Table name.
 * @param q - Search text.
 * @returns Matching tags.
 */
export async function tagVocabulary(table: string, q = '') {
  return page(
    await apiClient.get(`${BASE}/tags`, { params: { table, q, limit: 100 } }),
    normalizeTag
  )
}
/** Creates or suggests a tag according to server policy.
 * @param input - Label and table.
 * @returns Created tag.
 */
export async function createTag(input: CollaborationTagCreateRequestV1) {
  return normalizeTag(await apiClient.post(`${BASE}/tags`, input))
}
/** Reads applied tags, including every continuation page.
 * @param record - Parent identity.
 * @returns Applied tags.
 */
export async function getRecordTags(record: CollaborationRecord) {
  const items: CollaborationTag[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  do {
    const result: CollaborationPage<CollaborationTag> = page(
      await apiClient.get(`${recordPath(record)}/tags`, {
        params: { cursor: cursor ?? undefined, limit: 100 },
      }),
      normalizeTag
    )
    items.push(...result.items)
    cursor = result.nextCursor
    if (cursor && seen.has(cursor)) throw new Error('Tags returned a repeated cursor')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return { items, nextCursor: null } as CollaborationPage<CollaborationTag>
}
/** Applies tag changes atomically.
 * @param record - Parent identity.
 * @param input - Added and removed identifiers.
 * @returns Current tags.
 */
export async function putRecordTags(
  record: CollaborationRecord,
  input: CollaborationTagApplyRequestV1
) {
  return page(await apiClient.put(`${recordPath(record)}/tags`, input), normalizeTag)
}
/** Reads threads in backend latest-activity order.
 * @param record - Parent identity.
 * @param cursor - Continuation token.
 * @returns Threads.
 */
export async function listComments(
  record: CollaborationRecord,
  cursor?: string
): Promise<CommentPage> {
  const data = object(
    await apiClient.get(`${recordPath(record)}/comments`, { params: { cursor, limit: 20 } })
  )
  return {
    threads: (Array.isArray(data.threads) ? data.threads : []).map(normalizeComment),
    nextCursor: string(data.nextCursor),
  }
}
/** Posts a root or reply.
 * @param record - Parent identity.
 * @param input - Comment content.
 * @returns Posted comment.
 */
export async function postComment(
  record: CollaborationRecord,
  input: CollaborationCommentPostRequestV1
) {
  return normalizeComment(await apiClient.post(`${recordPath(record)}/comments`, input))
}
/** Edits the caller's comment.
 * @param id - Comment identity.
 * @param body - Replacement markdown.
 * @returns Edited comment.
 */
export async function editComment(id: number, body: string) {
  return normalizeComment(await apiClient.patch(`${BASE}/comments/${id}`, { body }))
}
/** Soft deletes a comment.
 * @param id - Comment identity.
 * @returns Acknowledgement.
 */
export async function deleteComment(id: number) {
  return acknowledgement(await apiClient.delete(`${BASE}/comments/${id}`))
}
/** Resolves or reopens a root thread.
 * @param id - Root identity.
 * @param resolved - Requested state.
 * @returns Acknowledgement.
 */
export async function resolveComment(id: number, resolved: boolean) {
  return acknowledgement(
    await (resolved
      ? apiClient.post(`${BASE}/comments/${id}/resolve`)
      : apiClient.post(`${BASE}/comments/${id}/reopen`))
  )
}
/** Reads previous bodies.
 * @param id - Comment identity.
 * @param cursor - Continuation token.
 * @returns History page.
 */
export async function commentHistory(id: number, cursor?: string) {
  return page<CollaborationCommentRevisionV1>(
    await apiClient.get(`${BASE}/comments/${id}/history`, { params: { cursor, limit: 20 } }),
    (raw) => {
      const data = object(raw)
      return {
        id: number(data.id),
        body: string(data.body),
        editedAt: string(data.editedAt),
        editedByUserId: string(data.editedByUserId),
      }
    }
  )
}
/** Finds mention candidates with explicit access uncertainty.
 * @param record - Parent identity.
 * @param q - Person search text.
 * @param cursor - Continuation token.
 * @returns Candidate page.
 */
export async function mentionCandidates(record: CollaborationRecord, q: string, cursor?: string) {
  return page<MentionCandidate>(
    await apiClient.get(`${BASE}/mentions/candidates`, {
      params: { ...record, q, cursor, limit: 20 },
    }),
    (raw) => {
      const data = object(raw),
        person = object(data.person)
      const userId = string(person.userId)
      if (!userId) throw new Error('Mention candidate has no identity')
      return {
        person: {
          userId,
          displayName: string(person.displayName) ?? userId,
          email: string(person.email),
          lastSeenAt: string(person.lastSeenAt),
        },
        canRead:
          data.canRead === 'true' || data.canRead === true
            ? 'true'
            : data.canRead === 'false' || data.canRead === false
              ? 'false'
              : 'unknown',
      }
    }
  )
}
/** Reads current follow state.
 * @param record - Parent identity.
 * @returns Subscription.
 */
export async function getFollow(record: CollaborationRecord) {
  return normalizeFollow(await apiClient.get(`${recordPath(record)}/follow`))
}
/** Follows and configures preferences.
 * @param record - Parent identity.
 * @param input - Notification preferences.
 * @returns Subscription.
 */
export async function putFollow(record: CollaborationRecord, input: CollaborationFollowRequestV1) {
  return normalizeFollow(await apiClient.put(`${recordPath(record)}/follow`, input))
}
/** Unfollows a record.
 * @param record - Parent identity.
 * @returns Subscription.
 */
export async function deleteFollow(record: CollaborationRecord) {
  return normalizeFollow(await apiClient.delete(`${recordPath(record)}/follow`))
}
/** Lists followers.
 * @param record - Parent identity.
 * @param cursor - Continuation token.
 * @returns Follower page.
 */
export async function listFollowers(record: CollaborationRecord, cursor?: string) {
  return page(
    await apiClient.get(`${recordPath(record)}/followers`, { params: { cursor, limit: 100 } }),
    normalizeFollower
  )
}
/** Pages the merged audit and activity stream.
 * @param record - Parent identity.
 * @param cursor - Continuation token.
 * @param types - Optional source/type filter.
 * @returns Timeline page.
 */
export async function listTimeline(record: CollaborationRecord, cursor?: string, types?: string) {
  return page<CollaborationTimelineItemV1>(
    await apiClient.get(`${recordPath(record)}/timeline`, { params: { cursor, types, limit: 20 } }),
    (raw) => {
      const data = object(raw)
      return {
        id: number(data.id),
        kind: data.kind === 'AUDIT' ? 'AUDIT' : 'ACTIVITY',
        at: string(data.at),
        actorName: string(data.actorName),
        actorUserId: string(data.actorUserId),
        summary: string(data.summary),
        refId: string(data.refId),
        refTable: string(data.refTable),
        details: (Array.isArray(data.details) ? data.details : []).map((rawDetail) => {
          const detail = object(rawDetail)
          return {
            fieldName: string(detail.fieldName),
            message: string(detail.message),
            oldValue: string(detail.oldValue),
            newValue: string(detail.newValue),
          }
        }),
      }
    }
  )
}

/** Renews a presence lease.
 * @param input - Client identity and focus.
 * @returns Current merged viewers.
 */
export const renewPresence = (input: PresenceRequest) =>
  apiClient.post<PresenceSnapshot>(`${BASE}/presence`, input)
/** Leaves a target.
 * @param input - Lease identity.
 * @returns Acknowledgement.
 */
export const leavePresence = (input: PresenceTarget) =>
  apiClient.delete(`${BASE}/presence`, { data: input })
/** Reads current viewers.
 * @param target - Target identity.
 * @returns Snapshot.
 */
export const getPresence = (target: { table: string; pk?: string }) =>
  apiClient.get<PresenceSnapshot>(`${BASE}/presence`, { params: target })
/** Sends the last heartbeat on pagehide. Beacon only supports POST; DELETE remains the
 * unmount cleanup, and the server's 45-second TTL handles a closed document.
 * @param input - Last presence lease.
 */
export function beaconPresence(input: PresenceRequest) {
  navigator.sendBeacon?.(
    `${process.env.NEXT_PUBLIC_API_BASE_URL || '/qqq/v1'}${BASE}/presence`,
    new Blob([JSON.stringify(input)], { type: 'application/json' })
  )
}
/** Reads directory candidates.
 * @param q - Search text.
 * @returns Directory page.
 */
export async function searchPeople(q: string) {
  return page(await apiClient.get(`${BASE}/people`, { params: { q, limit: 50 } }), (raw) => {
    const data = object(raw)
    return {
      userId: string(data.userId),
      displayName: string(data.displayName),
      email: string(data.email),
    } satisfies CollaborationPersonV1
  })
}
/** Reads a canonical record link.
 * @param record - Parent identity.
 * @returns Link and label.
 */
export const getRecordLink = (record: CollaborationRecord) =>
  apiClient.get<CollaborationLinkV1>(`${recordPath(record)}/link`)
/** Checks recipient visibility before sending.
 * @param record - Parent identity.
 * @param toUserIds - Recipients.
 * @returns Access decisions, including unknown.
 */
export const previewShares = (record: CollaborationRecord, toUserIds: string[]) =>
  apiClient.post<CollaborationSharePreviewV1>(`${recordPath(record)}/shares/preview`, { toUserIds })
/** Sends a share without granting permissions.
 * @param record - Parent identity.
 * @param input - Recipients and message.
 * @returns Per-recipient results.
 */
export const shareRecord = (record: CollaborationRecord, input: CollaborationShareRequestV1) =>
  apiClient.post<CollaborationShareListV1>(`${recordPath(record)}/shares`, input)
/** Requests access without probing record existence.
 * @param input - Opaque target and message.
 * @returns Request acknowledgement.
 */
export const requestAccess = (input: CollaborationAccessRequestCreateRequestV1) =>
  apiClient.post<CollaborationAccessRequestV1>(`${BASE}/access-requests`, input)
/** Reads one page of tasks.
 * @param record - Parent identity.
 * @param cursor - Continuation.
 * @returns Task page.
 */
export async function listTasks(record: CollaborationRecord, cursor?: string) {
  return page(
    await apiClient.get(`${recordPath(record)}/tasks`, {
      params: { includeDone: true, limit: 50, cursor },
    }),
    (raw) => identified(raw) as CollaborationTaskV1 & { id: number }
  )
}
/** Creates a task.
 * @param record - Parent identity.
 * @param input - Task details.
 * @returns Task.
 */
export const createTask = (record: CollaborationRecord, input: CollaborationTaskCreateRequestV1) =>
  apiClient.post<CollaborationTaskV1>(`${recordPath(record)}/tasks`, input)
/** Edits, completes or reopens a task.
 * @param id - Task identity.
 * @param input - Changed fields.
 * @returns Updated task.
 */
export const patchTask = (id: number, input: CollaborationTaskPatchRequestV1) =>
  apiClient.patch<CollaborationTaskV1>(`${BASE}/tasks/${id}`, input)
/** Assigns a record.
 * @param record - Parent identity.
 * @param input - Owner and assignee changes.
 * @returns Assignment.
 */
export const putAssignment = (
  record: CollaborationRecord,
  input: CollaborationAssignmentRequestV1
) => apiClient.put<CollaborationAssignmentV1>(`${recordPath(record)}/assignment`, input)
/** Reads record-specific capabilities and assignment.
 * @param record - Parent identity.
 * @returns Feature summary.
 */
export const getRecordFeatures = (record: CollaborationRecord) =>
  apiClient.get<RecordFeatureSummary>(
    `/table/${encodeURIComponent(record.table)}/${encodeURIComponent(record.pk)}/features`
  )
/** Reads the personal work summary.
 * @returns Work counts and tasks.
 */
export const getMyWork = () => apiClient.get<CollaborationMyWorkV1>(`${BASE}/my-work`)

/** Reads a page of the current user's open tasks.
 * @param cursor - Opaque continuation.
 * @returns Task page.
 */
export async function listMyTasks(cursor?: string) {
  return page(
    await apiClient.get(`${BASE}/tasks/mine`, { params: { status: 'OPEN', limit: 50, cursor } }),
    (raw) => identified(raw) as CollaborationTaskV1 & { id: number }
  )
}
