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

/**
 * @file EsbMessageList — pages through the messages waiting on a queue or in a trigger's
 * dead-letter queue, with replay, move and delete for selected messages when permitted, and
 * purge and delete-older-than for the dead-letter queue itself.
 */

'use client'

import React, { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'

import type { EsbMessage, EsbPermissions } from '@/types'
import { ESB_PAGE_SIZE, getEsbDeadLetters, getEsbMessages } from '@/lib/api/esb'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { formatDateTime } from '@/lib/utils/datetime-utils'
import {
  EsbQueueActions,
  EsbSelectionActions,
  selectionActions,
  type EsbQueueRef,
} from './EsbActions'

/** What to browse: the queue behind a destination, or a trigger's dead letters. */
export type EsbMessageSource =
  | { kind: 'destination'; name: string }
  | { kind: 'deadLetters'; triggerName: string }

/** Props for {@link EsbMessageList}. */
interface EsbMessageListProps {
  source: EsbMessageSource
  /** The broker queue holding the messages, for actions on selected ones. */
  queue: EsbQueueRef
  permissions: EsbPermissions
}

/**
 * Lists one page of browsed messages at a time: id, time, delivery count, CloudEvent type and
 * subject (or the raw body when it is not a CloudEvent), and the `qqqError` a dead letter carries.
 * Each row can be selected when an action on selected messages is available. Dead letters also
 * get the queue actions, since their queue is shown nowhere else.
 *
 * @param props - See {@link EsbMessageListProps}.
 * @returns The action bars, the message table with previous and next buttons, or a loading,
 *   error or empty state.
 */
export function EsbMessageList({ source, queue, permissions }: EsbMessageListProps) {
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const name = source.kind === 'destination' ? source.name : source.triggerName
  const replayTriggerName = source.kind === 'deadLetters' ? source.triggerName : undefined
  const available = selectionActions(queue, permissions, replayTriggerName)
  const selectable = available.replay || available.move || available.delete

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.esbMessages(source.kind, name, offset),
    queryFn: () =>
      source.kind === 'destination'
        ? getEsbMessages(source.name, offset)
        : getEsbDeadLetters(source.triggerName, offset),
    meta: HANDLES_OWN_ERRORS,
  })

  const goTo = (nextOffset: number) => {
    setOffset(Math.max(0, nextOffset))
    setSelected([])
  }
  const toggle = (messageId: string) =>
    setSelected((current) =>
      current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId]
    )

  return (
    <div className="space-y-3" data-qqq-id={`esb-message-list-${name}`}>
      {source.kind === 'deadLetters' && <EsbQueueActions queue={queue} permissions={permissions} />}
      {selectable && (
        <EsbSelectionActions
          queue={queue}
          permissions={permissions}
          messageIds={selected}
          replayTriggerName={replayTriggerName}
          onDone={() => setSelected([])}
        />
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground" role="status">
          Loading messages…
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          Failed to load messages: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      )}
      {data && data.messages.length === 0 && (
        <p className="text-sm text-muted-foreground">No messages.</p>
      )}
      {data && data.messages.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Messages">
            <thead>
              <tr className="border-b border-border text-left">
                {selectable && (
                  <th scope="col" className="px-2 py-1.5">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                {['Message', 'Time', 'Deliveries', 'Event'].map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="whitespace-nowrap px-2 py-1.5 font-medium text-muted-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.messages.map((message) => (
                <MessageRow
                  key={message.messageId}
                  message={message}
                  selectable={selectable}
                  selected={selected.includes(message.messageId)}
                  onToggle={() => toggle(message.messageId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <PageButton
          label="Previous page"
          disabled={offset === 0}
          onClick={() => goTo(offset - ESB_PAGE_SIZE)}
        >
          Previous
        </PageButton>
        <PageButton
          label="Next page"
          disabled={!data?.hasMore}
          onClick={() => goTo(offset + ESB_PAGE_SIZE)}
        >
          Next
        </PageButton>
      </div>
    </div>
  )
}

/**
 * One browsed message as a table row.
 *
 * @param props - Component props.
 * @param props.message - The message.
 * @param props.selectable - Whether to show a selection checkbox.
 * @param props.selected - Whether it is selected.
 * @param props.onToggle - Toggles its selection.
 * @returns The row.
 */
function MessageRow({
  message,
  selectable,
  selected,
  onToggle,
}: {
  message: EsbMessage
  selectable: boolean
  selected: boolean
  onToggle: () => void
}) {
  const error = message.properties.qqqError
  return (
    <tr
      className="border-b border-border/50 align-top last:border-0"
      data-qqq-id={`esb-message-${message.messageId}`}
    >
      {selectable && (
        <td className="px-2 py-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${message.messageId}`}
            className="h-4 w-4 rounded border-input focus:ring-2 focus:ring-ring"
            data-qqq-id={`checkbox-esb-message-${message.messageId}`}
          />
        </td>
      )}
      <td className="px-2 py-2 font-mono text-xs text-foreground">{message.messageId}</td>
      <td className="whitespace-nowrap px-2 py-2 text-foreground">
        {formatDateTime(message.timestamp) ?? message.timestamp}
      </td>
      <td className="px-2 py-2 tabular-nums text-foreground">{message.deliveryCount}</td>
      <td className="space-y-1 px-2 py-2">
        {message.event ? (
          <p className="text-foreground">
            <span className="font-mono text-xs">{message.event.type}</span>
            {message.event.subject && (
              <span className="text-muted-foreground"> · {message.event.subject}</span>
            )}
          </p>
        ) : (
          <p className="text-muted-foreground">Not a CloudEvent</p>
        )}
        {error != null && <p className="break-words text-destructive">{String(error)}</p>}
        <details>
          <summary className="cursor-pointer text-xs text-primary focus:outline-none focus:ring-2 focus:ring-ring">
            Body
          </summary>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs text-foreground">
            {message.rawBody}
          </pre>
        </details>
      </td>
    </tr>
  )
}

/**
 * A pager button.
 *
 * @param props - Component props.
 * @param props.label - Accessible name.
 * @param props.disabled - Whether it is disabled.
 * @param props.onClick - Click handler.
 * @param props.children - Visible text.
 * @returns The button.
 */
function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      data-qqq-id={`button-esb-messages-${label.toLowerCase().replace(' ', '-')}`}
      className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/** Props for {@link EsbBrowseButton}. */
interface EsbBrowseButtonProps extends EsbMessageListProps {
  /** Visible button text. */
  label: string
  /** Accessible name when the visible text needs context; it starts with `label`. */
  ariaLabel?: string
  /** Dialog heading. */
  title: string
}

/**
 * A button that opens an {@link EsbMessageList} in a dialog. The list, and its requests, exist
 * only while the dialog is open.
 *
 * @param props - See {@link EsbBrowseButtonProps}.
 * @returns The button and its dialog.
 */
export function EsbBrowseButton({ label, ariaLabel, title, ...listProps }: EsbBrowseButtonProps) {
  const name =
    listProps.source.kind === 'destination' ? listProps.source.name : listProps.source.triggerName
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger
        aria-label={ariaLabel}
        data-qqq-id={`button-esb-browse-${listProps.source.kind}-${name}`}
        className="inline-flex items-center rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {label}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-qqq-id={`esb-browse-dialog-${name}`}
          className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg focus:outline-none"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              data-qqq-id="button-esb-browse-close"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <EsbMessageList {...listProps} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
