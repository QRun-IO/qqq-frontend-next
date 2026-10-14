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

/** @file Paged comment threads, replies, author controls and edit history. */
'use client'
import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import type {
  CollaborationComment,
  CollaborationRecord,
  RecordFeaturesV1,
} from '@/types/collaboration'
import {
  useComments,
  useCommentActions,
  useResolveComment,
  useCommentHistory,
} from '@/lib/hooks/use-collaboration-record'
import { CommentComposer } from './CommentComposer'
import { CollaborationMarkdown } from './CollaborationMarkdown'

/** One comment with actions authorized by server capabilities.
 * @param props - Comment, parent and capabilities.
 * @returns Comment and optional reply editor.
 */
function Comment({
  comment,
  record,
  canComment,
  fieldLabels,
  root = false,
}: {
  comment: CollaborationComment
  record: CollaborationRecord
  canComment: boolean
  fieldLabels?: Record<string, string>
  root?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [replying, setReplying] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const actions = useCommentActions(record)
  const resolve = useResolveComment(record)
  const history = useCommentHistory(comment.id, historyOpen)
  const collapsed = root && comment.resolved && !expanded
  return (
    <article
      className="min-w-0 space-y-2 rounded-lg border border-border p-3"
      data-qqq-id={`comment-${comment.id}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {comment.authorDisplayName ?? comment.authorUserId ?? 'Unknown'}
        </span>
        <time dateTime={comment.createdAt ?? undefined}>
          {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
        </time>
        {comment.fieldName && (
          <span className="rounded bg-muted px-2 py-1">
            {fieldLabels?.[comment.fieldName] ?? comment.fieldName}
          </span>
        )}
        {comment.editedAt && (
          <Popover.Root open={historyOpen} onOpenChange={setHistoryOpen}>
            <Popover.Trigger className="underline" data-qqq-id={`comment-history-${comment.id}`}>
              edited
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 w-80 max-w-[90vw] space-y-3 rounded border border-border bg-popover p-3 shadow-lg"
                sideOffset={5}
              >
                <h3 className="text-sm font-semibold">Edit history</h3>
                {history.isPending && <p role="status">Loading history…</p>}
                {history.isError && <p role="alert">Could not load history.</p>}
                {history.data?.pages
                  .flatMap((page) => page.items)
                  .map((revision, index) => (
                    <div key={revision.id ?? index}>
                      <time className="text-xs">
                        {revision.editedAt ? new Date(revision.editedAt).toLocaleString() : ''}
                      </time>
                      <CollaborationMarkdown body={revision.body ?? ''} />
                    </div>
                  ))}
                {history.hasNextPage && (
                  <button
                    data-qqq-id="comment-history-more"
                    disabled={history.isFetchingNextPage}
                    onClick={() => void history.fetchNextPage()}
                  >
                    Load more
                  </button>
                )}
                <Popover.Close data-qqq-id="comment-history-close">Close</Popover.Close>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
      {collapsed ? (
        <button
          className="text-sm"
          data-qqq-id={`comment-expand-${comment.id}`}
          onClick={() => setExpanded(true)}
        >
          Resolved thread · Show
        </button>
      ) : (
        <>
          {editing ? (
            <CommentComposer
              record={record}
              initialBody={comment.body ?? ''}
              submitLabel="Save comment"
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                await actions.edit.mutateAsync({ id: comment.id, body })
                setEditing(false)
              }}
            />
          ) : (
            <CollaborationMarkdown
              body={comment.deleted ? 'Comment deleted' : (comment.body ?? '')}
            />
          )}
          {!comment.deleted && (
            <div className="flex flex-wrap gap-3 text-xs">
              {comment.canEdit && !editing && (
                <button data-qqq-id={`comment-edit-${comment.id}`} onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
              {comment.canDelete && (
                <button
                  data-qqq-id={`comment-delete-${comment.id}`}
                  disabled={actions.remove.isPending}
                  onClick={() => {
                    if (window.confirm('Delete this comment?')) actions.remove.mutate(comment.id)
                  }}
                >
                  Delete
                </button>
              )}
              {root && canComment && (
                <button
                  data-qqq-id={`comment-reply-${comment.id}`}
                  onClick={() => setReplying(!replying)}
                >
                  Reply
                </button>
              )}
            </div>
          )}
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              record={record}
              canComment={canComment}
              fieldLabels={fieldLabels}
            />
          ))}
          {replying && (
            <CommentComposer
              record={record}
              submitLabel="Post reply"
              onCancel={() => setReplying(false)}
              onSubmit={async (body) => {
                await actions.post.mutateAsync({ body, parentCommentId: comment.id })
                setReplying(false)
              }}
            />
          )}
        </>
      )}
      {root && canComment && (
        <button
          className="text-xs font-medium text-primary"
          disabled={resolve.isPending}
          data-qqq-id={`comment-resolve-${comment.id}`}
          onClick={() => {
            setExpanded(false)
            resolve.mutate({ id: comment.id, resolved: !comment.resolved })
          }}
        >
          {comment.resolved ? 'Reopen' : 'Resolve'}
        </button>
      )}
      {(actions.remove.isError || resolve.isError) && (
        <p role="alert" className="text-sm text-destructive">
          Could not update comment. Please try again.
        </p>
      )}
    </article>
  )
}
/** Thread list in server latest-activity order with cursor paging.
 * @param props - Record identity and feature metadata.
 * @returns Comments tab.
 */
export function CommentsTab({
  record,
  features,
  fieldLabels,
}: {
  record: CollaborationRecord
  features: RecordFeaturesV1
  fieldLabels?: Record<string, string>
}) {
  const query = useComments(record)
  const actions = useCommentActions(record)
  const threads = query.data?.pages.flatMap((page) => page.threads) ?? []
  const canComment = features.capabilities?.comment === true
  return (
    <div className="space-y-4" data-qqq-id="collaboration-comments">
      {canComment ? (
        <CommentComposer
          key={`${record.table}/${record.pk}`}
          record={record}
          onSubmit={(body) => actions.post.mutateAsync({ body })}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to comment on this record.
        </p>
      )}
      {query.isPending && <p role="status">Loading comments…</p>}
      {query.isError && (
        <p role="alert">
          Could not load comments.{' '}
          <button data-qqq-id="comments-retry" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      )}
      {query.isSuccess && !threads.length && (
        <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>
      )}
      {threads.map((thread) => (
        <Comment
          key={thread.id}
          comment={thread}
          record={record}
          canComment={canComment}
          fieldLabels={fieldLabels}
          root
        />
      ))}
      {query.hasNextPage && (
        <button
          data-qqq-id="comments-more"
          className="w-full rounded border border-border py-2 text-sm"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </div>
  )
}
