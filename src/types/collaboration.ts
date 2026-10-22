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

/** @file Collaboration v1 navigation contracts, normalized for UI consumers. */

/** Navigation kinds supported by the collaboration qbit. */
export type CollaborationTargetType =
  | 'TABLE'
  | 'APP'
  | 'RECORD'
  | 'PROCESS'
  | 'REPORT'
  | 'SAVED_VIEW'

/** Target request shared by star, unstar and record-view mutations. */
export interface CollaborationTarget {
  /** Kind of navigation target. */
  targetType: CollaborationTargetType
  /** Metadata name of the target. */
  targetName: string
  /** Canonical record key; omitted or null for other target types. */
  recordId?: string | null
}

/** FavoriteV1 also represents recent entries; recents have no timestamp in this contract. */
export interface CollaborationFavorite extends CollaborationTarget {
  /** Persisted favorite identifier; null for an optimistic entry. */
  id: number | null
  /** Current server label, or Unavailable when access is lost. */
  label: string
  /** Validated in-app destination, absent when unavailable. */
  href: string | null
  /** The server's current visibility decision. */
  available: boolean
  /** Optional personal grouping. */
  folder: string | null
  /** Position in the personal list. */
  sortOrder: number | null
}

/** FavoriteListV1 and RecentListV1 share the same response shape. */
export interface CollaborationList {
  /** Ordered entries; nullable wire lists normalize to an empty array. */
  items: CollaborationFavorite[]
  /** Opaque continuation token, null after the last page. */
  nextCursor: string | null
}

/** Moves the specified identifiers first and optionally assigns or clears folders. */
export interface CollaborationFavoriteOrder {
  /** Favorite identifiers in the requested order, without duplicates. */
  ids: number[]
  /** Identifier to folder mapping; null values clear a folder. */
  folders?: Record<string, string | null> | null
}

/** MutationResultV1 acknowledgement. */
export interface CollaborationMutationResult {
  /** True when the requested write completed. */
  success: boolean
}

// Wire schemas from qbit-collaboration feature/ui-api-endpoints, v1.0.0.

/** Attachments, newest first. */
export interface CollaborationAttachmentListV1 {
  /** Attachments, newest first. */
  items?: Array<CollaborationAttachmentV1> | null
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
}

/** Change attachment display metadata. */
export interface CollaborationAttachmentPatchRequestV1 {
  /** Optional description; empty clears, null leaves unchanged. */
  description?: string | null
  /** Optional new display filename; null leaves unchanged. */
  fileName?: string | null
}

/** Multipart upload with exactly one file part named file. */
export interface CollaborationAttachmentUploadRequestV1 {
  /** Optional description. */
  description?: string | null
  /** Required file content. */
  file?: string | null
}

/** An attachment visible through its parent record; no storage coordinates are exposed. */
export interface CollaborationAttachmentV1 {
  /** Whether the caller may change or delete this attachment. */
  canDelete?: boolean | null
  /** MIME content type. */
  contentType?: string | null
  /** Upload time. */
  createDate?: string | null
  /** Uploader display name, when the service provides it; the UI falls back to the id. */
  createdByDisplayName?: string | null
  /** Uploader identity. */
  createdByUserId?: string | null
  /** Optional description. */
  description?: string | null
  /** Safe display filename. */
  fileName?: string | null
  /** Attachment identifier. */
  id?: number | null
  /** Canonical parent record key. */
  recordId?: string | null
  /** SHA-256 content digest. */
  sha256?: string | null
  /** Stored byte count. */
  sizeBytes?: number | null
  /** Parent table metadata name. */
  tableName?: string | null
}

/** Replace the caller's comment body. */
export interface CollaborationCommentEditRequestV1 {
  /** Required replacement body, 1 to 20000 characters. */
  body?: string | null
}

/** Previous bodies in edit order. */
export interface CollaborationCommentHistoryV1 {
  /** Previous bodies in edit order. */
  items?: Array<CollaborationCommentRevisionV1> | null
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
}

/** Root threads by latest activity, with replies. */
export interface CollaborationCommentPageV1 {
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
  /** Root threads by latest activity, with replies. */
  threads?: Array<CollaborationCommentV1> | null
}

/** Post a root comment or one-level reply. */
export interface CollaborationCommentPostRequestV1 {
  /** Required body, 1 to 20000 characters; mentions use @[Name](user:id). */
  body?: string | null
  /** Optional existing parent field name. */
  fieldName?: string | null
  /** Optional comment to reply to. */
  parentCommentId?: number | null
}

/** A previous comment body. */
export interface CollaborationCommentRevisionV1 {
  /** Previous body text. */
  body?: string | null
  /** Time the body was replaced. */
  editedAt?: string | null
  /** Editor identity. */
  editedByUserId?: string | null
  /** Revision identifier. */
  id?: number | null
}

/** A comment or reply; deleted comments retain their position without body text. */
export interface CollaborationCommentV1 {
  /** Author display name. */
  authorDisplayName?: string | null
  /** Author identity. */
  authorUserId?: string | null
  /** Plain text with mention tokens; null for deleted comments. */
  body?: string | null
  /** Caller may delete this comment. */
  canDelete?: boolean | null
  /** Caller may edit the body. */
  canEdit?: boolean | null
  /** Creation time. */
  createdAt?: string | null
  /** Whether the comment is soft deleted. */
  deleted?: boolean | null
  /** Last edit time, if edited. */
  editedAt?: string | null
  /** Optional field being discussed. */
  fieldName?: string | null
  /** Comment identifier. */
  id?: number | null
  /** Mention recipients. */
  mentions?: Array<CollaborationMentionV1> | null
  /** Root comment for a reply; null on roots. */
  parentCommentId?: number | null
  /** Replies in oldest-first order; empty on replies. */
  replies?: Array<CollaborationCommentV1> | null
  /** Whether the thread is resolved. */
  resolved?: boolean | null
  /** Root thread identifier; null on roots. */
  threadId?: number | null
}

/** Temporary access to file bytes. Clients follow url. */
export interface CollaborationDownloadV1 {
  /** Presigned URL, valid for five minutes. Clients follow url; never persist it. */
  url?: string | null
}

/** Standard QQQ error response. */
export interface CollaborationErrorV1 {
  /** Human-readable reason the operation failed. */
  error?: string | null
}

/** Ordered personal favorites. */
export interface CollaborationFavoriteListV1 {
  /** Ordered personal favorites. */
  items?: Array<CollaborationFavoriteV1> | null
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
}

/** Move selected favorites first and optionally assign folders. */
export interface CollaborationFavoriteOrderRequestV1 {
  /** Optional map from favorite identifier to folder; null values clear folders. */
  folders?: Record<string, string | null> | null
  /** Required ordered favorite identifiers, with no duplicates. */
  ids?: Array<number> | null
}

/** A saved navigation target, with availability rechecked for the caller. */
export interface CollaborationFavoriteV1 {
  /** Whether the caller can currently open this target. */
  available?: boolean | null
  /** Optional personal grouping. */
  folder?: string | null
  /** Navigation link, absent for unavailable targets. */
  href?: string | null
  /** Favorite identifier. */
  id?: number | null
  /** Current display label; Unavailable when access is lost. */
  label?: string | null
  /** Canonical record key; null for non-record targets. */
  recordId?: string | null
  /** Position in the personal list. */
  sortOrder?: number | null
  /** Metadata name of the table, app, process, report or saved view. */
  targetName?: string | null
  /** Kind of navigation target. */
  targetType?: 'TABLE' | 'APP' | 'RECORD' | 'PROCESS' | 'REPORT' | 'SAVED_VIEW' | null
}

/** Configure the caller's follow preferences. */
export interface CollaborationFollowRequestV1 {
  /** Optional change notifications preference; omission retains current setting. */
  notifyOnChange?: boolean | null
  /** Optional comment notifications preference; omission retains current setting. */
  notifyOnComment?: boolean | null
}

/** The current caller's subscription state. */
export interface CollaborationFollowStateV1 {
  /** Subscription settings; null when not following. */
  follow?: CollaborationFollowV1 | null
  /** Whether the caller follows the record. */
  following?: boolean | null
}

/** A subscription to record changes and comments. */
export interface CollaborationFollowV1 {
  /** Subscription identifier. */
  id?: number | null
  /** Notifications muted until this time, if set. */
  mutedUntil?: string | null
  /** Receive record change digests. */
  notifyOnChange?: boolean | null
  /** Receive new comment notifications. */
  notifyOnComment?: boolean | null
  /** How following began. */
  reason?: 'MANUAL' | 'AUTHOR' | 'COMMENTED' | 'MENTIONED' | 'ASSIGNED' | 'SHARED' | null
  /** Follower identity. */
  userId?: string | null
}

/** Subscriptions for this record. */
export interface CollaborationFollowerListV1 {
  /** Subscriptions for this record. */
  items?: Array<CollaborationFollowV1> | null
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
}

/** Candidates ranked with record participants first. */
export interface CollaborationMentionCandidateListV1 {
  /** Candidates ranked with record participants first. */
  items?: Array<CollaborationMentionCandidateV1> | null
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
}

/** A matching person and their known parent access. */
export interface CollaborationMentionCandidateV1 {
  /** Recipient access: string true, false, or unknown when it cannot be established. */
  canRead?: 'true' | 'false' | 'unknown' | null
  /** Directory identity. */
  person?: CollaborationPersonV1 | null
}

/** A mention embedded in a comment. */
export interface CollaborationMentionV1 {
  /** Mentioned user identity. */
  userId?: string | null
  /** Whether recipient access was confirmed when mentioned. */
  visible?: boolean | null
}

/** Acknowledgement of a completed mutation. */
export interface CollaborationMutationResultV1 {
  /** True after the requested operation completes. */
  success?: boolean | null
}

/** Matching active directory entries. */
export interface CollaborationPersonListV1 {
  /** Matching active directory entries. */
  items?: Array<CollaborationPersonV1> | null
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
}

/** An active directory entry. */
export interface CollaborationPersonV1 {
  /** Display name. */
  displayName?: string | null
  /** Directory email, if known. */
  email?: string | null
  /** Most recent directory refresh time. */
  lastSeenAt?: string | null
  /** Stable user identity. */
  userId?: string | null
}

/** Most recent visible targets, at most fifty. */
export interface CollaborationRecentListV1 {
  /** Most recent visible targets, at most fifty. */
  items?: Array<CollaborationFavoriteV1> | null
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
}

/** Add and remove tag associations in one request. */
export interface CollaborationTagApplyRequestV1 {
  /** Tag identifiers to add; omitted means none. */
  add?: Array<number> | null
  /** Tag identifiers to remove; omitted means none. */
  remove?: Array<number> | null
}

/** Create a tag or suggest one under the table policy. */
export interface CollaborationTagCreateRequestV1 {
  /** Optional display color. */
  color?: string | null
  /** Required display label, 1 to 60 characters. */
  label?: string | null
  /** Required table metadata name. */
  table?: string | null
}

/** Available or applied tags. */
export interface CollaborationTagListV1 {
  /** Available or applied tags. */
  items?: Array<CollaborationTagV1> | null
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
}

/** An approved tag or the caller's pending suggestion. */
export interface CollaborationTagV1 {
  /** Whether anyone may apply this tag. */
  approved?: boolean | null
  /** Optional display color. */
  color?: string | null
  /** Tag identifier. */
  id?: number | null
  /** Display label. */
  label?: string | null
  /** Normalized vocabulary name. */
  name?: string | null
  /** Table scope; null means global. */
  tableName?: string | null
  /** Number of record associations. */
  usageCount?: number | null
}

/** Target to star, unstar, or record as recently viewed. */
export interface CollaborationTargetRequestV1 {
  /** Required for RECORD; omitted otherwise. */
  recordId?: string | null
  /** Required metadata name. */
  targetName?: string | null
  /** Required target kind. */
  targetType?: 'TABLE' | 'APP' | 'RECORD' | 'PROCESS' | 'REPORT' | 'SAVED_VIEW' | null
}

/** A permitted field change from a core audit. */
export interface CollaborationTimelineDetailV1 {
  /** Changed field metadata name. */
  fieldName?: string | null
  /** Optional audit message. */
  message?: string | null
  /** New display value. */
  newValue?: string | null
  /** Previous display value. */
  oldValue?: string | null
}

/** One visible event in the merged record timeline. */
export interface CollaborationTimelineItemV1 {
  /** Actor display name. */
  actorName?: string | null
  /** Actor identity, when known. */
  actorUserId?: string | null
  /** Event time. */
  at?: string | null
  /** Field details filtered by caller permissions. */
  details?: Array<CollaborationTimelineDetailV1> | null
  /** Identifier within the source. */
  id?: number | null
  /** Event source. */
  kind?: 'ACTIVITY' | 'AUDIT' | null
  /** Related record key. */
  refId?: string | null
  /** Related table metadata name. */
  refTable?: string | null
  /** Human-readable event summary. */
  summary?: string | null
}

/** Merged events, newest first. */
export interface CollaborationTimelinePageV1 {
  /** Merged events, newest first. */
  items?: Array<CollaborationTimelineItemV1> | null
  /** Opaque continuation token; null when finished or the service has no continuation support. */
  nextCursor?: string | null
}

/** Core RecordFeaturesV1: settings are extensible; capabilities are server decisions. */
export interface RecordFeaturesV1 {
  ownership?: { ownerFieldName?: string; assigneeFieldName?: string }
  features?: Array<
    | 'ATTACHMENTS'
    | 'TAGS'
    | 'CUSTOM_FIELDS'
    | 'COMMENTS'
    | 'PRESENCE'
    | 'SHARING'
    | 'FAVORITES'
    | 'FOLLOW'
    | 'TIMELINE'
    | 'RECENTS'
    | 'TASKS'
    | 'ASSIGNMENT'
  >
  settings?: Record<string, Record<string, unknown>>
  capabilities?: Record<string, boolean>
}
/** Record identity shared by record collaboration hooks. */
export interface CollaborationRecord {
  table: string
  pk: string
}
/** List envelopes normalize null collections and cursors. */
export interface CollaborationPage<T> {
  items: T[]
  nextCursor: string | null
}
/** UI attachments always have a usable identifier. */
export type Attachment = CollaborationAttachmentV1 & { id: number }
/** UI tags always have a usable identifier and label. */
export type CollaborationTag = CollaborationTagV1 & { id: number; label: string }
/** UI threads normalize replies recursively. */
export type CollaborationComment = Omit<CollaborationCommentV1, 'replies'> & {
  id: number
  replies: CollaborationComment[]
}
/** Normalized comment page. */
export interface CommentPage {
  threads: CollaborationComment[]
  nextCursor: string | null
}
/** Normalized current follow state. */
export interface FollowState {
  following: boolean
  follow: CollaborationFollowV1 | null
}
/** Normalized mention candidate. */
export interface MentionCandidate {
  person: CollaborationPersonV1 & { userId: string; displayName: string }
  canRead: 'true' | 'false' | 'unknown'
}

/** Collaboration wire contract. */
export interface CollaborationAccessRequestCreateRequestV1 {
  message?: string | null
  recordId?: string | null
  shareId?: number | null
  tableName?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationAccessRequestListV1 {
  items?: Array<CollaborationAccessRequestV1> | null
  nextCursor?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationAssignmentRequestV1 {
  assigneeUserId?: string | null
  ownerUserId?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationAssignmentV1 {
  assigneeUserId?: string | null
  id?: number | null
  ownerUserId?: string | null
  recordId?: string | null
  tableName?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationLinkV1 {
  label?: string | null
  url?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationMyWorkV1 {
  assignedRecordsByTable?: Record<string, number> | null
  openTaskCount?: number | null
  tasks?: Array<CollaborationTaskV1> | null
  unreadMentionCount?: number | null
}

/** Collaboration wire contract. */
export interface CollaborationShareListV1 {
  items?: Array<CollaborationShareV1> | null
}

/** Collaboration wire contract. */
export interface CollaborationSharePreviewV1 {
  recipients?: Array<CollaborationShareRecipientV1> | null
}

/** Collaboration wire contract. */
export interface CollaborationShareRequestV1 {
  message?: string | null
  toUserIds?: Array<string> | null
}

/** Collaboration wire contract. */
export interface CollaborationTaskCreateRequestV1 {
  assigneeUserId?: string | null
  dueAt?: string | null
  notes?: string | null
  remindAt?: string | null
  title?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationTaskListV1 {
  items?: Array<CollaborationTaskV1> | null
  nextCursor?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationTaskPatchRequestV1 {
  assigneeUserId?: string | null
  dueAt?: string | null
  notes?: string | null
  remindAt?: string | null
  status?: string | null
  title?: string | null
}

/** Ephemeral viewer; the service merges a user's tabs, preferring EDITING. */
export interface PresenceViewer {
  userId: string
  displayName: string
  mode: 'VIEWING' | 'EDITING'
  fieldName?: string | null
}
/** Presence target and client lease identity. */
export interface PresenceTarget {
  sequence?: number
  connectionId: string
  table: string
  pk?: string
}
/** Presence lease renewal. */
export interface PresenceRequest extends PresenceTarget {
  mode: 'VIEWING' | 'EDITING'
  fieldName?: string
}
/** Snapshot also carried by presence.changed. */
export interface PresenceSnapshot {
  table: string
  pk?: string
  viewers: PresenceViewer[]
}
/** Core record feature summary, including qbit assignment fallback. */
export interface RecordFeatureSummary {
  capabilities?: Record<string, boolean>
  owner?: string | null
  assignee?: string | null
  counts?: Record<string, number>
}

/** Collaboration wire contract. */
export interface CollaborationTaskV1 {
  /** Assignee display name, when provided; the UI falls back to assigneeUserId. */
  assigneeDisplayName?: string | null
  assigneeUserId?: string | null
  completedAt?: string | null
  /** Completer display name, when provided; the UI falls back to completedByUserId. */
  completedByDisplayName?: string | null
  completedByUserId?: string | null
  /** Creator display name, when provided; the UI falls back to createdByUserId. */
  createdByDisplayName?: string | null
  createdByUserId?: string | null
  dueAt?: string | null
  id?: number | null
  notes?: string | null
  recordId?: string | null
  remindAt?: string | null
  status?: string | null
  tableName?: string | null
  title?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationShareV1 {
  /** Sender display name, when provided; the UI falls back to fromUserId. */
  fromDisplayName?: string | null
  fromUserId?: string | null
  id?: number | null
  message?: string | null
  recipientCouldRead?: boolean | null
  recordId?: string | null
  sentAt?: string | null
  tableName?: string | null
  /** Recipient display name, when provided; the UI falls back to toUserId. */
  toDisplayName?: string | null
  toUserId?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationShareRecipientV1 {
  canRead?: boolean | null
  displayName?: string | null
  userId?: string | null
}

/** Collaboration wire contract. */
export interface CollaborationAccessRequestV1 {
  handledAt?: string | null
  id?: number | null
  message?: string | null
  note?: string | null
  recordId?: string | null
  /** Requester display name, when provided; the UI falls back to requesterUserId. */
  requesterDisplayName?: string | null
  requesterUserId?: string | null
  status?: string | null
  tableName?: string | null
}
