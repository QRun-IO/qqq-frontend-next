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

/** @file Follow toggle and notification preferences beside the record favorite. */
'use client'
import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Bell, ChevronDown } from 'lucide-react'
import type { CollaborationRecord } from '@/types/collaboration'
import { useFollow, useUpdateFollow, useFollowers } from '@/lib/hooks/use-collaboration-record'

/** Follow state and settings are shared and updated optimistically.
 * @param props - Parent identity.
 * @returns Bell with preference popover.
 */
export function FollowBell({ record }: { record: CollaborationRecord }) {
  const [open, setOpen] = useState(false)
  const query = useFollow(record)
  const update = useUpdateFollow(record)
  const followers = useFollowers(record, open)
  const following = query.data?.following === true
  return (
    <div className="inline-flex items-center" data-qqq-id="record-follow">
      <button
        type="button"
        aria-label={following ? 'Unfollow record' : 'Follow record'}
        aria-pressed={following}
        disabled={update.isPending || !query.isSuccess}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-primary hover:bg-accent disabled:opacity-50"
        data-qqq-id="follow-toggle"
        onClick={() =>
          update.mutate(following ? null : { notifyOnChange: true, notifyOnComment: true })
        }
      >
        <Bell className={`h-5 w-5 ${following ? 'fill-current' : ''}`} aria-hidden="true" />
      </button>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          aria-label="Follow preferences"
          data-qqq-id="follow-preferences"
          className="min-h-11 rounded px-1 hover:bg-accent"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={5}
            align="end"
            className="z-50 w-72 max-w-[90vw] space-y-3 rounded-lg border border-border bg-popover p-4 text-sm shadow-lg"
          >
            <h3 className="font-semibold">Follow preferences</h3>
            {(['notifyOnChange', 'notifyOnComment'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={following && query.data?.follow?.[key] === true}
                  disabled={update.isPending || !query.isSuccess}
                  data-qqq-id={`follow-${key}`}
                  onChange={(event) =>
                    update.mutate({
                      notifyOnChange: query.data?.follow?.notifyOnChange ?? true,
                      notifyOnComment: query.data?.follow?.notifyOnComment ?? true,
                      [key]: event.target.checked,
                    })
                  }
                />
                {key === 'notifyOnChange' ? 'Notify me about changes' : 'Notify me about comments'}
              </label>
            ))}
            <p className="text-xs text-muted-foreground">
              {followers.isPending
                ? 'Loading followers…'
                : `${followers.data?.pages.reduce((count, page) => count + page.items.length, 0) ?? 0}${followers.hasNextPage ? '+' : ''} followers`}
            </p>
            {followers.hasNextPage && (
              <button
                data-qqq-id="followers-more"
                disabled={followers.isFetchingNextPage}
                onClick={() => void followers.fetchNextPage()}
              >
                Load more followers
              </button>
            )}
            {followers.isError && <p role="alert">Could not load followers.</p>}
            <Popover.Close data-qqq-id="follow-close">Close</Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {(query.isError || update.isError) && (
        <span role="alert" className="text-xs text-destructive">
          Could not update follow.
        </span>
      )}
    </div>
  )
}
