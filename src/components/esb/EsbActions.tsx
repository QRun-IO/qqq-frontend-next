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
 * @file EsbActions — management actions for ESB triggers and broker queues, run as the backend's
 * ESB operate processes. Each action shows only when the user holds its permission and, for broker
 * queues, when the broker adapter supports it. Purge and delete ask for confirmation first.
 */

'use client'

import React, { useId, useState } from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { EsbCapabilities, EsbDestination, EsbPermissions, EsbTrigger } from '@/types'
import { runEsbAction } from '@/lib/api/esb'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'

/** A queue on the broker that management actions address. */
export interface EsbQueueRef {
  /** ESB provider the queue lives on. */
  providerName: string
  /** Broker-side queue name. */
  brokerQueueName: string
  /** What the provider's broker adapter supports. */
  capabilities: EsbCapabilities
  /** Messages in the queue, or `null` when the broker cannot report it. */
  messageCount: number | null
  /** Whether delivery is paused, or `null` when unknown; pause and resume show only when known. */
  paused: boolean | null
}

/** Values an operate process takes. */
type EsbActionValues = Record<string, string | boolean>

/**
 * The broker queue behind a destination.
 *
 * @param destination - A queue or topic.
 * @returns The queue, or `null` for a topic (its subscriptions are the queues).
 */
export function destinationQueue(destination: EsbDestination): EsbQueueRef | null {
  if (destination.type !== 'QUEUE') return null
  return {
    providerName: destination.provider,
    brokerQueueName: destination.brokerName,
    capabilities: destination.capabilities,
    messageCount: destination.queueInfo?.messageCount ?? null,
    paused: destination.queueInfo?.paused ?? null,
  }
}

/**
 * A trigger's dead-letter queue, which lives on the same provider as its destination.
 *
 * @param trigger - The trigger.
 * @returns Its dead-letter queue.
 */
export function deadLetterQueue(trigger: EsbTrigger): EsbQueueRef {
  return {
    providerName: trigger.destination.provider,
    brokerQueueName: trigger.deadLetter.brokerName,
    capabilities: trigger.destination.capabilities,
    messageCount: trigger.deadLetter.messageCount,
    paused: null,
  }
}

/**
 * Counts messages in words.
 *
 * @param count - Number of messages.
 * @param adjective - Optional word before "message", e.g. `selected`.
 * @returns For example `7 messages` or `1 selected message`.
 */
export function messageCountText(count: number, adjective?: string): string {
  return [count, adjective, count === 1 ? 'message' : 'messages'].filter(Boolean).join(' ')
}

/**
 * Runs ESB operate processes, reporting the outcome in a toast and refreshing every ESB query.
 *
 * @param onDone - Called after an action succeeds.
 * @returns The mutation; call `mutate({ processName, values })`.
 */
export function useEsbAction(onDone?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ processName, values }: { processName: string; values: EsbActionValues }) =>
      runEsbAction(processName, values),
    meta: HANDLES_OWN_ERRORS,
    onSuccess: (result) => {
      toast.success(result.message)
      void queryClient.invalidateQueries({ queryKey: queryKeys.esb() })
      onDone?.()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'The action failed.')
    },
  })
}

/**
 * Pause or resume, restart, and replay-dead-letter buttons for a trigger. These act on QQQ's own
 * consumers on every node, so they need `esbOperate` but no broker management API.
 *
 * @param props - Component props.
 * @param props.trigger - The trigger.
 * @param props.permissions - The current user's ESB permissions.
 * @returns The buttons, or `null` without `esbOperate`.
 */
export function EsbTriggerActions({
  trigger,
  permissions,
}: {
  trigger: EsbTrigger
  permissions: EsbPermissions
}) {
  if (!permissions.canOperate) return null
  return <TriggerButtons trigger={trigger} />
}

/**
 * The trigger buttons, once the user is known to hold `esbOperate`.
 *
 * @param props - Component props.
 * @param props.trigger - The trigger.
 * @returns A group of buttons.
 */
function TriggerButtons({ trigger }: { trigger: EsbTrigger }) {
  const action = useEsbAction()
  const run = (processName: string, values: EsbActionValues = {}) =>
    action.mutate({ processName, values: { triggerName: trigger.name, ...values } })
  const paused = trigger.state === 'PAUSED'
  const id = trigger.name

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={`Actions for ${trigger.processLabel}`}>
      {paused ? (
        <ActionButton
          label="Resume"
          ariaLabel={`Resume ${trigger.processLabel}`}
          qqqId={`button-esb-resume-trigger-${id}`}
          disabled={action.isPending}
          onClick={() => run('esbResumeTrigger')}
        />
      ) : (
        <ActionButton
          label="Pause"
          ariaLabel={`Pause ${trigger.processLabel}`}
          qqqId={`button-esb-pause-trigger-${id}`}
          disabled={action.isPending}
          onClick={() => run('esbPauseTrigger')}
        />
      )}
      <ActionButton
        label="Restart"
        ariaLabel={`Restart ${trigger.processLabel}`}
        qqqId={`button-esb-restart-trigger-${id}`}
        disabled={action.isPending}
        onClick={() => run('esbRestartTrigger')}
      />
      {trigger.deadLetter.messageCount !== 0 && (
        <ActionButton
          label="Replay dead letters"
          ariaLabel={`Replay dead letters for ${trigger.processLabel}`}
          qqqId={`button-esb-replay-dead-letters-${id}`}
          disabled={action.isPending}
          onClick={() => run('esbReplayDeadLetters', { all: true })}
        />
      )}
    </div>
  )
}

/**
 * Pause or resume, purge, and delete-older-than buttons for a broker queue. Pause and resume need
 * `esbOperate`; purge and delete need `esbDelete`; each also needs the broker to support it.
 *
 * @param props - Component props.
 * @param props.queue - The broker queue.
 * @param props.permissions - The current user's ESB permissions.
 * @returns The buttons, or `null` when none is available.
 */
export function EsbQueueActions({
  queue,
  permissions,
}: {
  queue: EsbQueueRef
  permissions: EsbPermissions
}) {
  const canPause = permissions.canOperate && queue.capabilities.pauseQueue && queue.paused !== null
  const canPurge = permissions.canDelete && queue.capabilities.purge
  const canDeleteOlder = permissions.canDelete && queue.capabilities.deleteOlderThan
  if (!canPause && !canPurge && !canDeleteOlder) return null
  return (
    <QueueButtons
      queue={queue}
      canPause={canPause}
      canPurge={canPurge}
      canDeleteOlder={canDeleteOlder}
    />
  )
}

/**
 * The queue buttons and their confirmation dialogs.
 *
 * @param props - Component props.
 * @param props.queue - The broker queue.
 * @param props.canPause - Whether to offer pause or resume.
 * @param props.canPurge - Whether to offer purge.
 * @param props.canDeleteOlder - Whether to offer deleting messages older than a time.
 * @returns A group of buttons.
 */
function QueueButtons({
  queue,
  canPause,
  canPurge,
  canDeleteOlder,
}: {
  queue: EsbQueueRef
  canPause: boolean
  canPurge: boolean
  canDeleteOlder: boolean
}) {
  const [dialog, setDialog] = useState<'purge' | 'deleteOlder' | null>(null)
  const [olderThan, setOlderThan] = useState('')
  const olderThanId = useId()
  const close = () => {
    setDialog(null)
    setOlderThan('')
  }
  const action = useEsbAction(close)
  const target = { providerName: queue.providerName, brokerQueueName: queue.brokerQueueName }
  const name = queue.brokerQueueName
  const inQueue =
    queue.messageCount === null ? '' : ` (${messageCountText(queue.messageCount)} in the queue)`
  const cutoff = olderThan ? new Date(olderThan) : null
  const cutoffValid = cutoff !== null && !Number.isNaN(cutoff.getTime())

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={`Actions for queue ${name}`}>
      {canPause && (
        <ActionButton
          label={queue.paused ? 'Resume queue' : 'Pause queue'}
          ariaLabel={`${queue.paused ? 'Resume' : 'Pause'} queue ${name}`}
          qqqId={`button-esb-${queue.paused ? 'resume' : 'pause'}-queue-${name}`}
          disabled={action.isPending}
          onClick={() =>
            action.mutate({
              processName: queue.paused ? 'esbResumeQueue' : 'esbPauseQueue',
              values: target,
            })
          }
        />
      )}
      {canPurge && (
        <ActionButton
          label="Purge"
          ariaLabel={`Purge ${name}`}
          qqqId={`button-esb-purge-${name}`}
          destructive
          disabled={action.isPending}
          onClick={() => setDialog('purge')}
        />
      )}
      {canDeleteOlder && (
        <ActionButton
          label="Delete older"
          ariaLabel={`Delete older messages in ${name}`}
          qqqId={`button-esb-delete-older-${name}`}
          destructive
          disabled={action.isPending}
          onClick={() => setDialog('deleteOlder')}
        />
      )}

      <EsbConfirmDialog
        open={dialog === 'purge'}
        title="Purge queue"
        confirmLabel="Purge queue"
        pending={action.isPending}
        onCancel={close}
        onConfirm={() => action.mutate({ processName: 'esbPurgeQueue', values: target })}
      >
        {queue.messageCount === null
          ? `Delete every message in queue ${name} on ${queue.providerName}?`
          : `Delete all ${messageCountText(queue.messageCount)} in queue ${name} on ${queue.providerName}?`}{' '}
        This cannot be undone.
      </EsbConfirmDialog>

      <EsbConfirmDialog
        open={dialog === 'deleteOlder'}
        title="Delete older messages"
        confirmLabel="Delete messages"
        pending={action.isPending}
        confirmDisabled={!cutoffValid}
        onCancel={close}
        onConfirm={() => {
          if (!cutoffValid) return
          action.mutate({
            processName: 'esbDeleteMessages',
            values: { ...target, olderThan: cutoff.toISOString() },
          })
        }}
        body={
          <div className="mt-4 space-y-1">
            <label htmlFor={olderThanId} className="text-sm font-medium text-foreground">
              Older than
            </label>
            <input
              id={olderThanId}
              type="datetime-local"
              value={olderThan}
              onChange={(event) => setOlderThan(event.target.value)}
              aria-required="true"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={`input-esb-older-than-${name}`}
            />
          </div>
        }
      >
        Delete the messages older than the chosen time from queue {name} on {queue.providerName}
        {inQueue}? This cannot be undone.
      </EsbConfirmDialog>
    </div>
  )
}

/**
 * Replay, move and delete buttons for messages selected in a browsed queue. Replay needs
 * `esbOperate` and a trigger (dead letters only); move needs `esbOperate`; delete needs
 * `esbDelete`; move and delete also need the broker to support them.
 *
 * @param props - Component props.
 * @param props.queue - The broker queue the messages are in.
 * @param props.permissions - The current user's ESB permissions.
 * @param props.messageIds - The selected messages.
 * @param props.replayTriggerName - For dead letters, the trigger whose process replays them.
 * @param props.onDone - Called after an action succeeds, e.g. to clear the selection.
 * @returns The buttons, or `null` when none is available.
 */
export function EsbSelectionActions({
  queue,
  permissions,
  messageIds,
  replayTriggerName,
  onDone,
}: {
  queue: EsbQueueRef
  permissions: EsbPermissions
  messageIds: string[]
  replayTriggerName?: string
  onDone?: () => void
}) {
  const available = selectionActions(queue, permissions, replayTriggerName)
  if (!available.replay && !available.move && !available.delete) return null
  return (
    <SelectionButtons
      queue={queue}
      messageIds={messageIds}
      replayTriggerName={replayTriggerName}
      available={available}
      onDone={onDone}
    />
  )
}

/**
 * Which actions on selected messages the user may take.
 *
 * @param queue - The broker queue the messages are in.
 * @param permissions - The current user's ESB permissions.
 * @param replayTriggerName - For dead letters, the trigger whose process replays them.
 * @returns A flag per action.
 */
export function selectionActions(
  queue: EsbQueueRef,
  permissions: EsbPermissions,
  replayTriggerName?: string
): { replay: boolean; move: boolean; delete: boolean } {
  return {
    replay: permissions.canOperate && Boolean(replayTriggerName),
    move: permissions.canOperate && queue.capabilities.move,
    delete: permissions.canDelete && queue.capabilities.deleteSelected,
  }
}

/**
 * The selection buttons and their dialogs.
 *
 * @param props - Component props.
 * @param props.queue - The broker queue the messages are in.
 * @param props.messageIds - The selected messages.
 * @param props.replayTriggerName - For dead letters, the trigger whose process replays them.
 * @param props.available - Which actions to offer.
 * @param props.onDone - Called after an action succeeds.
 * @returns A group of buttons.
 */
function SelectionButtons({
  queue,
  messageIds,
  replayTriggerName,
  available,
  onDone,
}: {
  queue: EsbQueueRef
  messageIds: string[]
  replayTriggerName?: string
  available: { replay: boolean; move: boolean; delete: boolean }
  onDone?: () => void
}) {
  const [dialog, setDialog] = useState<'move' | 'delete' | null>(null)
  const [toQueue, setToQueue] = useState('')
  const toQueueId = useId()
  const close = () => {
    setDialog(null)
    setToQueue('')
  }
  const action = useEsbAction(() => {
    close()
    onDone?.()
  })
  const name = queue.brokerQueueName
  const ids = messageIds.join(',')
  const selected = messageCountText(messageIds.length, 'selected')
  const target = { providerName: queue.providerName, brokerQueueName: name, messageIds: ids }
  const none = messageIds.length === 0 || action.isPending

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Actions for selected messages">
      {available.replay && replayTriggerName && (
        <ActionButton
          label="Replay selected"
          qqqId={`button-esb-replay-selected-${name}`}
          disabled={none}
          onClick={() =>
            action.mutate({
              processName: 'esbReplayDeadLetters',
              values: { triggerName: replayTriggerName, messageIds: ids },
            })
          }
        />
      )}
      {available.move && (
        <ActionButton
          label="Move selected"
          qqqId={`button-esb-move-selected-${name}`}
          disabled={none}
          onClick={() => setDialog('move')}
        />
      )}
      {available.delete && (
        <ActionButton
          label="Delete selected"
          qqqId={`button-esb-delete-selected-${name}`}
          destructive
          disabled={none}
          onClick={() => setDialog('delete')}
        />
      )}

      <EsbConfirmDialog
        open={dialog === 'move'}
        title="Move messages"
        confirmLabel="Move messages"
        destructive={false}
        pending={action.isPending}
        confirmDisabled={!toQueue.trim()}
        onCancel={close}
        onConfirm={() =>
          action.mutate({
            processName: 'esbMoveMessages',
            values: { ...target, toBrokerQueueName: toQueue.trim() },
          })
        }
        body={
          <div className="mt-4 space-y-1">
            <label htmlFor={toQueueId} className="text-sm font-medium text-foreground">
              Target queue
            </label>
            <input
              id={toQueueId}
              type="text"
              value={toQueue}
              onChange={(event) => setToQueue(event.target.value)}
              aria-required="true"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={`input-esb-move-target-${name}`}
            />
          </div>
        }
      >
        Move {selected} from queue {name} on {queue.providerName} to another queue on the same
        broker.
      </EsbConfirmDialog>

      <EsbConfirmDialog
        open={dialog === 'delete'}
        title="Delete messages"
        confirmLabel="Delete messages"
        pending={action.isPending}
        onCancel={close}
        onConfirm={() => action.mutate({ processName: 'esbDeleteMessages', values: target })}
      >
        Delete {selected} from queue {name} on {queue.providerName}? This cannot be undone.
      </EsbConfirmDialog>
    </div>
  )
}

/**
 * A small outlined action button.
 *
 * @param props - Component props.
 * @param props.label - Visible text.
 * @param props.ariaLabel - Accessible name when the visible text needs context; it starts with `label`.
 * @param props.qqqId - `data-qqq-id` value.
 * @param props.destructive - Whether to style it as destructive.
 * @param props.disabled - Whether it is disabled.
 * @param props.onClick - Click handler.
 * @returns The button.
 */
function ActionButton({
  label,
  ariaLabel,
  qqqId,
  destructive = false,
  disabled = false,
  onClick,
}: {
  label: string
  ariaLabel?: string
  qqqId: string
  destructive?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-qqq-id={qqqId}
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        destructive
          ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
          : 'border-input bg-background text-foreground hover:bg-accent'
      )}
    >
      {label}
    </button>
  )
}

/**
 * A confirmation dialog: nothing runs until the confirm button is pressed.
 *
 * @param props - Component props.
 * @param props.open - Whether the dialog is shown.
 * @param props.title - Heading, also the dialog's accessible name.
 * @param props.children - The question, naming what the action affects.
 * @param props.body - Optional inputs shown under the question.
 * @param props.confirmLabel - Text of the confirm button.
 * @param props.destructive - Whether to style the confirm button as destructive (default true).
 * @param props.confirmDisabled - Whether the confirm button is disabled, e.g. until an input is valid.
 * @param props.pending - Whether the action is running.
 * @param props.onConfirm - Runs the action.
 * @param props.onCancel - Closes the dialog without running anything.
 * @returns The dialog.
 */
export function EsbConfirmDialog({
  open,
  title,
  children,
  body,
  confirmLabel,
  destructive = true,
  confirmDisabled = false,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  body?: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  confirmDisabled?: boolean
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialogPrimitive.Content
          data-qqq-id="esb-confirm-dialog"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-lg focus:outline-none"
        >
          <div className="p-6">
            <AlertDialogPrimitive.Title className="text-lg font-semibold text-foreground">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
              {children}
            </AlertDialogPrimitive.Description>
            {body}
          </div>
          <div className="flex items-center justify-end gap-3 rounded-b-xl bg-muted px-6 py-4">
            <AlertDialogPrimitive.Cancel
              data-qqq-id="button-esb-confirm-cancel"
              className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Cancel
            </AlertDialogPrimitive.Cancel>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled || pending}
              data-qqq-id="button-esb-confirm"
              className={cn(
                'inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                destructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring'
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
