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

/** @file Markdown composer with cursor-aware keyboard mention completion and access warnings. */
'use client'
import { useId, useRef, useState } from 'react'
import type { CollaborationRecord, MentionCandidate } from '@/types/collaboration'
import { useMentionCandidates } from '@/lib/hooks/use-collaboration-record'
import { CollaborationMarkdown } from './CollaborationMarkdown'

/** Checks access for pasted or previously saved mentions as well as autocomplete inserts.
 * @param props - Mention identity, display name and any already-known access decision.
 * @returns Access warning, if the recipient cannot read.
 */
function MentionWarning({
  record,
  userId,
  name,
  known,
}: {
  record: CollaborationRecord
  userId: string
  name: string
  known?: MentionCandidate
}) {
  const candidates = useMentionCandidates(record, known ? null : name)
  const candidate =
    known ??
    candidates.data?.pages
      .flatMap((page) => page.items)
      .find((item) => item.person.userId === userId)
  return candidate?.canRead === 'false' ? (
    <p
      className="rounded-lg bg-muted px-2 py-1 text-xs"
      role="status"
      data-qqq-id="mention-warning"
    >
      {name} can&apos;t see this record and won&apos;t be notified.
    </p>
  ) : null
}

/** Writes or edits a comment without losing the draft on failure.
 * @param props - Identity, initial draft and save callback.
 * @returns Composer.
 */
export function CommentComposer({
  record,
  initialBody = '',
  submitLabel = 'Post comment',
  onSubmit,
  onCancel,
  disabled = false,
}: {
  record: CollaborationRecord
  initialBody?: string
  submitLabel?: string
  onSubmit: (body: string) => Promise<unknown>
  onCancel?: () => void
  disabled?: boolean
}) {
  const id = useId()
  const [body, setBody] = useState(initialBody)
  const [preview, setPreview] = useState(false)
  const [caret, setCaret] = useState(initialBody.length)
  const [closed, setClosed] = useState(false)
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState<MentionCandidate[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const match = body.slice(0, caret).match(/(?:^|\s)@([^@\n[\]]*)$/)
  const term = !closed && !preview && match ? match[1] : null
  const candidates = useMentionCandidates(record, term)
  const options = candidates.data?.pages.flatMap((page) => page.items) ?? []
  const mentions = [
    ...new Map(
      Array.from(body.matchAll(/@\[([^\]]+)\]\(user:([^\)]+)\)/g), (match) => [
        match[2],
        { name: match[1], userId: match[2] },
      ])
    ).values(),
  ]
  const insert = (candidate: MentionCandidate) => {
    const start = caret - (term?.length ?? 0) - 1
    const token = `@[${candidate.person.displayName.replace(/[\[\]\n]/g, '')}](user:${candidate.person.userId}) `
    setBody(body.slice(0, start) + token + body.slice(caret))
    setCaret(start + token.length)
    setSelected((items) => [
      ...items.filter((item) => item.person.userId !== candidate.person.userId),
      candidate,
    ])
    setClosed(true)
    requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.setSelectionRange(start + token.length, start + token.length)
    })
  }
  return (
    <form
      className="space-y-2"
      data-qqq-id="comment-composer"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!body.trim() || saving || disabled) return
        setSaving(true)
        setError('')
        try {
          await onSubmit(body)
          setBody('')
          setSelected([])
          setPreview(false)
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Could not save comment.')
        } finally {
          setSaving(false)
        }
      }}
    >
      <div className="flex gap-1" role="group" aria-label="Comment editor mode">
        {['Write', 'Preview'].map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={preview === Boolean(index)}
            className="rounded px-3 py-2 text-sm aria-pressed:bg-muted"
            data-qqq-id={`comment-${label.toLowerCase()}`}
            onClick={() => setPreview(Boolean(index))}
          >
            {label}
          </button>
        ))}
      </div>
      {preview ? (
        <div className="rounded border border-border p-3" data-qqq-id="comment-preview-body">
          <CollaborationMarkdown body={body || 'Nothing to preview.'} />
        </div>
      ) : (
        <>
          <label htmlFor={id} className="sr-only">
            Comment
          </label>
          <textarea
            id={id}
            ref={input}
            value={body}
            rows={4}
            maxLength={20000}
            disabled={disabled || saving}
            placeholder="Write a comment… Use @ to mention someone."
            className="w-full resize-y rounded-md border border-border bg-background p-3 text-sm"
            data-qqq-id="comment-body"
            aria-controls={term !== null ? `${id}-mentions` : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              term !== null && options[active] ? `${id}-mention-${active}` : undefined
            }
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            onChange={(event) => {
              setBody(event.target.value)
              setCaret(event.target.selectionStart)
              setClosed(false)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (term === null) return
              if (event.key === 'Escape') {
                setClosed(true)
                event.preventDefault()
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((value) =>
                  Math.max(
                    0,
                    Math.min(options.length - 1, value + (event.key === 'ArrowDown' ? 1 : -1))
                  )
                )
              }
              if (event.key === 'Enter' && options[active]) {
                event.preventDefault()
                insert(options[active])
              }
            }}
          />
          {term !== null && (
            <div
              role="listbox"
              id={`${id}-mentions`}
              aria-label="Mention candidates"
              className="rounded border border-border bg-popover p-1"
            >
              {options.map((candidate, index) => (
                <button
                  key={candidate.person.userId}
                  type="button"
                  role="option"
                  id={`${id}-mention-${index}`}
                  aria-selected={active === index}
                  data-qqq-id={`mention-${candidate.person.userId}`}
                  className="flex w-full flex-wrap gap-2 rounded px-2 py-2 text-left text-sm aria-selected:bg-accent"
                  onClick={() => insert(candidate)}
                >
                  {candidate.person.displayName}
                  {candidate.canRead !== 'true' && (
                    <span className="text-xs text-muted-foreground">
                      {candidate.canRead === 'false' ? "can't open this record" : 'unknown'}
                    </span>
                  )}
                </button>
              ))}
              {candidates.isPending && <p role="status">Finding people…</p>}
              {candidates.isError && <p role="alert">Could not load mention candidates.</p>}
              {candidates.hasNextPage && (
                <button
                  type="button"
                  data-qqq-id="mention-more"
                  disabled={candidates.isFetchingNextPage}
                  onClick={() => void candidates.fetchNextPage()}
                >
                  More people
                </button>
              )}
            </div>
          )}
        </>
      )}
      {mentions.map((mention) => (
        <MentionWarning
          key={mention.userId}
          record={record}
          {...mention}
          known={selected.find((candidate) => candidate.person.userId === mention.userId)}
        />
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          disabled={disabled || saving || !body.trim()}
          className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          data-qqq-id="comment-submit"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            data-qqq-id="comment-cancel"
            className="px-3 py-2 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
