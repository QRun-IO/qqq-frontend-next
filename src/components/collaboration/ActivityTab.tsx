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

/** @file Paged audit and collaboration activity with expandable permitted details. */
'use client'
import { Activity, History } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { CollaborationRecord, CollaborationTimelineDetailV1 } from '@/types/collaboration'
import { useTimeline } from '@/lib/hooks/use-collaboration-record'
import { UserAvatar } from '@/components/ui/UserAvatar'

/** Older core audits summarize as "Record was Edited"; newer services send friendlier text.
 * @param summary - Summary as sent.
 * @returns The friendly summary unchanged, or the old audit verb in sentence case.
 */
export function activitySummary(summary?: string | null): string {
  const verb = summary?.trim().match(/^record was (\w+)\.?$/i)?.[1].toLowerCase()
  if (!verb) return summary ?? ''
  if (verb === 'inserted' || verb === 'created') return 'Created'
  if (verb === 'edited' || verb === 'updated') return 'Edited'
  return verb.charAt(0).toUpperCase() + verb.slice(1)
}
/** A detail is worth a row only when it says something: a message or a value change.
 * @param detail - Permitted audit detail.
 * @returns Whether to show it.
 */
function hasContent(detail: CollaborationTimelineDetailV1) {
  return !!detail.message?.trim() || detail.oldValue != null || detail.newValue != null
}

/** Renders the unified timeline without a nested scrolling container.
 * @param props - Parent identity.
 * @returns Activity list.
 */
export function ActivityTab({ record }: { record: CollaborationRecord }) {
  const query = useTimeline(record)
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <div className="space-y-4" data-qqq-id="collaboration-activity">
      {query.isPending && <p role="status">Loading activity…</p>}
      {query.isError && (
        <p role="alert">
          Could not load activity.{' '}
          <button data-qqq-id="activity-retry" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      )}
      {query.isSuccess && !items.length && (
        <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
      )}
      {items.map((item, index) => {
        const Icon = item.kind === 'AUDIT' ? History : Activity
        const validTime = item.at && Number.isFinite(Date.parse(item.at))
        const details = item.details?.filter(hasContent) ?? []
        return (
          <article
            key={`${item.kind}-${item.id ?? index}`}
            className="flex min-w-0 gap-3 border-b border-border pb-4 text-sm"
          >
            <Icon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 break-words">
              <p className="flex min-w-0 items-center gap-2 font-medium">
                {item.actorUserId && <UserAvatar userId={item.actorUserId} name={item.actorName ?? item.actorUserId} size={20} />}
                <span className="min-w-0 break-words">{item.actorName ?? item.actorUserId ?? 'System'}</span>
              </p>
              <p>{activitySummary(item.summary)}</p>
              <time
                className="text-xs text-muted-foreground"
                dateTime={item.at ?? undefined}
                title={item.at ?? undefined}
              >
                {validTime
                  ? formatDistanceToNow(new Date(item.at!), { addSuffix: true })
                  : 'Time unknown'}
              </time>
              {details.length > 0 && (
                <details className="mt-2">
                  <summary
                    data-qqq-id={`activity-details-${item.kind}-${item.id}`}
                    className="cursor-pointer text-xs text-primary"
                  >
                    Details
                  </summary>
                  <dl className="mt-2 space-y-2 text-xs">
                    {details.map((detail, i) => (
                      <div key={i}>
                        <dt className="font-medium">{detail.fieldName ?? 'Change'}</dt>
                        <dd>
                          {detail.message ??
                            `${detail.oldValue ?? 'Empty'} → ${detail.newValue ?? 'Empty'}`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </div>
          </article>
        )
      })}
      {query.hasNextPage && (
        <button
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          className="w-full rounded border border-border py-2 text-sm"
          data-qqq-id="activity-more"
        >
          Load more
        </button>
      )}
    </div>
  )
}
