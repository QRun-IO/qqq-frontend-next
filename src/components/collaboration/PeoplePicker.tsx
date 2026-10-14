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

/** @file Directory picker with a record-specific access preview. */
'use client'
import { useContext, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CollaborationPersonV1, CollaborationRecord } from '@/types/collaboration'
import { QContext } from '@/lib/context/q-context'
import { searchPeople, previewShares } from '@/lib/api/collaboration'
import { useMentionCandidates } from '@/lib/hooks/use-collaboration-record'
import { queryKeys } from '@/lib/query-client'
import { collaborationInput } from './CollaborationDialog'
/** Whether a directory entry is the signed-in user; the app's user id is the session email, so it
 * is compared (case-insensitively) with the entry's user id and email.
 * @param person - Directory entry.
 * @param userId - The signed-in user's id, if known.
 * @returns True for the caller's own entry.
 */
export function isCurrentUser(person: CollaborationPersonV1, userId: string | undefined) {
  const mine = userId?.toLowerCase()
  return !!mine && [person.userId, person.email].some((value) => value?.toLowerCase() === mine)
}

/** Searchable people with fail-closed assignment checks.
 * @param props - Parent, selection and whether reading is required.
 * @returns Picker and preview badges.
 */
export function PeoplePicker({
  record,
  selected,
  onChange,
  requireRead = false,
  excludeSelf = false,
  label = 'People',
}: {
  record: CollaborationRecord
  selected: string[]
  onChange: (ids: string[]) => void
  requireRead?: boolean
  /** Leave the signed-in user out of the results (sharing with yourself is meaningless). */
  excludeSelf?: boolean
  label?: string
}) {
  const [q, setQ] = useState('')
  const userId = useContext(QContext)?.userId
  // The read-only candidate endpoint checks access without requiring permission to share.
  const candidates = useMentionCandidates(record, requireRead ? q : null)
  const people = useQuery({
    queryKey: ['qqq', 'collaboration', 'people', q],
    queryFn: () => searchPeople(q),
    enabled: !requireRead,
  })
  // The service also leaves the caller out; this guards older services.
  const found = (people.data?.items ?? []).filter(
    (person) => !(excludeSelf && isCurrentUser(person, userId))
  )
  const ids = found.flatMap((p) => (p.userId ? [p.userId] : []))
  const preview = useQuery({
    queryKey: [...queryKeys.collaborationResource(record.table, record.pk, 'share-preview'), ids],
    queryFn: () => previewShares(record, ids),
    enabled: !requireRead && ids.length > 0,
  })
  const candidateItems = candidates.data?.pages.flatMap((page) => page.items) ?? []
  const entries = requireRead
    ? candidateItems.map((candidate) => candidate.person)
    : found
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <input
        aria-label={`Search ${label.toLowerCase()}`}
        placeholder="Search by name"
        className={collaborationInput}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        data-qqq-id="people-search"
      />
      {(people.isError || candidates.isError) && <p role="alert">Could not load people.</p>}
      {preview.isError && <p role="alert">Could not check access.</p>}
      {entries?.map((person) => {
        if (!person.userId) return null
        const id = person.userId
        const candidateAccess = candidateItems.find(
          (candidate) => candidate.person.userId === id
        )?.canRead
        const access = requireRead
          ? candidateAccess === 'true'
            ? true
            : candidateAccess === 'false'
              ? false
              : null
          : preview.data?.recipients?.find((r) => r.userId === id)?.canRead
        return (
          <label
            key={id}
            className="flex min-h-10 flex-wrap items-center gap-2 rounded border border-border p-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(id)}
              disabled={requireRead && access !== true}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? requireRead
                      ? [id]
                      : [...selected, id]
                    : selected.filter((v) => v !== id)
                )
              }
              data-qqq-id={`person-${id}`}
            />
            <span className="break-words">{person.displayName || id}</span>
            {access !== true && (
              <span className="rounded bg-muted px-2 py-1 text-xs">
                {access === false ? "can't open this record" : 'unknown'}
              </span>
            )}
          </label>
        )
      })}
      {requireRead && selected.length > 0 && (
        <button
          type="button"
          className="min-h-10 text-sm underline"
          onClick={() => onChange([])}
          data-qqq-id="people-clear"
        >
          Clear selection
        </button>
      )}
      {requireRead && candidates.hasNextPage && (
        <button
          type="button"
          className="min-h-10 text-sm underline"
          disabled={candidates.isFetchingNextPage}
          onClick={() => candidates.fetchNextPage()}
          data-qqq-id="people-more"
        >
          Load more people
        </button>
      )}
      {requireRead && (
        <p className="text-xs text-muted-foreground">
          An assignee must be able to open this record.
        </p>
      )}
    </fieldset>
  )
}
