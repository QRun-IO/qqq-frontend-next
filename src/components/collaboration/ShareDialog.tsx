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

/** @file Copy links and share in-app, with access preview and per-recipient results. */
'use client'
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CollaborationRecord } from '@/types/collaboration'
import { getRecordLink, previewShares, shareRecord } from '@/lib/api/collaboration'
import { queryKeys } from '@/lib/query-client'
import { CollaborationDialog, collaborationButton, collaborationInput } from './CollaborationDialog'
import { PeoplePicker } from './PeoplePicker'
/** Sharing never grants record access.
 * @param props - Parent and dialog lifecycle.
 * @returns Share dialog.
 */
export function ShareDialog({
  record,
  onClose,
  canShare,
}: {
  record: CollaborationRecord
  onClose: () => void
  canShare: boolean
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const link = useQuery({
    queryKey: queryKeys.collaborationResource(record.table, record.pk, 'link'),
    queryFn: () => getRecordLink(record),
  })
  const preview = useQuery({
    queryKey: [
      ...queryKeys.collaborationResource(record.table, record.pk, 'share-preview'),
      selected,
    ],
    queryFn: () => previewShares(record, selected),
    enabled: selected.length > 0,
  })
  const send = useMutation({
    mutationFn: () => shareRecord(record, { toUserIds: selected, message }),
  })
  return (
    <CollaborationDialog
      title="Share record"
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <label className="block text-sm">
        Copy link
        <input
          readOnly
          value={link.data?.url ?? ''}
          className={collaborationInput}
          data-qqq-id="share-link"
        />
      </label>
      <button
        type="button"
        className={collaborationButton}
        disabled={!link.data?.url}
        data-qqq-id="share-copy"
        onClick={() => {
          void navigator.clipboard
            .writeText(link.data!.url!)
            .then(() => toast.success('Link copied'))
            .catch(() => toast.error('Could not copy link'))
        }}
      >
        Copy link
      </button>
      {link.isError && <p role="alert">Could not load the link.</p>}
      {canShare && !send.isSuccess && (
        <>
          <PeoplePicker record={record} selected={selected} onChange={setSelected} />
          <label className="block text-sm">
            Message
            <textarea
              className={collaborationInput}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              data-qqq-id="share-message"
            />
          </label>
          <ul className="space-y-2 text-sm" data-qqq-id="share-preview">
            {preview.data?.recipients?.map((person) => (
              <li key={person.userId}>
                {person.displayName || person.userId}:{' '}
                {person.canRead === true
                  ? 'will be notified'
                  : person.canRead === false
                    ? "can't open this record — will be offered access"
                    : 'unknown — access is checked when sent'}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Sharing does not grant access.</p>
          <button
            type="button"
            className={collaborationButton}
            disabled={!selected.length || !preview.isSuccess || send.isPending}
            onClick={() => send.mutate()}
            data-qqq-id="share-send"
          >
            Send
          </button>
          {send.isError && <p role="alert">{send.error.message}</p>}
        </>
      )}
      {send.isSuccess && (
        <div role="status" data-qqq-id="share-result">
          <h3 className="font-semibold">Share results</h3>
          <ul className="space-y-2 text-sm">
            {send.data.items?.map((item) => (
              <li key={item.id ?? item.toUserId}>
                {preview.data?.recipients?.find((p) => p.userId === item.toUserId)?.displayName ||
                  item.toUserId}
                : {item.recipientCouldRead ? 'Notified' : 'Offered access'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </CollaborationDialog>
  )
}
