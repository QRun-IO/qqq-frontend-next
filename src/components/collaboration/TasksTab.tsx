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

/** @file Record task list and editor with directory access checks. */
'use client'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type {
  CollaborationRecord,
  CollaborationTaskV1,
  CollaborationTaskCreateRequestV1,
  RecordFeaturesV1,
} from '@/types/collaboration'
import { useTasks, useTaskActions } from '@/lib/hooks/use-collaboration-record'
import { CollaborationDialog, collaborationButton, collaborationInput } from './CollaborationDialog'
import { PeoplePicker } from './PeoplePicker'
/** Uses local datetime controls while sending ISO instants.
 * @param value - Stored timestamp.
 * @returns Local datetime input string.
 */
function localDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
/** Task form shared by create and edit.
 * @param props - Task and parent.
 * @returns Editor dialog.
 */
function TaskEditor({
  record,
  task,
  onClose,
}: {
  record: CollaborationRecord
  task?: CollaborationTaskV1
  onClose: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [assignee, setAssignee] = useState(task?.assigneeUserId ? [task.assigneeUserId] : [])
  const [due, setDue] = useState(localDate(task?.dueAt))
  const [remind, setRemind] = useState(localDate(task?.remindAt))
  const actions = useTaskActions(record)
  const pending = actions.create.isPending || actions.patch.isPending
  const error = actions.create.error ?? actions.patch.error
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const dueAt = due ? new Date(due).toISOString() : null
    const input: CollaborationTaskCreateRequestV1 = {
      title: title.trim(),
      notes,
      assigneeUserId: assignee[0] ?? null,
      dueAt,
      remindAt: remind
        ? new Date(remind).toISOString()
        : dueAt
          ? new Date(
              new Date(dueAt).getTime() -
                (new Date(dueAt).getTime() - Date.now() > 86400000 ? 86400000 : 0)
            ).toISOString()
          : null,
    }
    if (task?.id != null) actions.patch.mutate({ id: task.id, input }, { onSuccess: onClose })
    else actions.create.mutate(input, { onSuccess: onClose })
  }
  return (
    <CollaborationDialog
      title={task ? 'Edit task' : 'Create task'}
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <form onSubmit={save} className="space-y-3">
        <label className="block text-sm">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={collaborationInput}
            data-qqq-id="task-title"
          />
        </label>
        <label className="block text-sm">
          Notes (Markdown)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={collaborationInput}
            data-qqq-id="task-notes"
          />
        </label>
        <PeoplePicker
          record={record}
          label="Assignee"
          requireRead
          selected={assignee}
          onChange={setAssignee}
        />
        <label className="block text-sm">
          Due
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={collaborationInput}
            data-qqq-id="task-due"
          />
        </label>
        <label className="block text-sm">
          Remind
          <input
            type="datetime-local"
            value={remind}
            onChange={(e) => setRemind(e.target.value)}
            className={collaborationInput}
            data-qqq-id="task-remind"
          />
        </label>
        <button
          disabled={pending || !title.trim()}
          className={collaborationButton}
          data-qqq-id="task-save"
        >
          Save task
        </button>
        {error && <p role="alert">{error.message}</p>}
      </form>
    </CollaborationDialog>
  )
}
/** Open-first tasks with completion and editing actions.
 * @param props - Parent and capabilities.
 * @returns Tasks panel.
 */
export function TasksTab({
  record,
  features,
}: {
  record: CollaborationRecord
  features: RecordFeaturesV1
}) {
  const query = useTasks(record)
  const actions = useTaskActions(record)
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState<CollaborationTaskV1 | 'new' | null>(null)
  const tasks = (query.data?.pages.flatMap((p) => p.items) ?? [])
    .filter((t) => showDone || t.status === 'OPEN')
    .sort((a, b) => Number(a.status !== 'OPEN') - Number(b.status !== 'OPEN'))
  const canTask = features.capabilities?.task === true
  return (
    <div className="space-y-3" data-qqq-id="tasks-tab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
            data-qqq-id="tasks-show-done"
          />
          Show done
        </label>
        {canTask && (
          <button
            className={collaborationButton}
            onClick={() => setEditing('new')}
            data-qqq-id="task-create"
          >
            Create task
          </button>
        )}
      </div>
      {query.isPending && <p role="status">Loading tasks…</p>}
      {query.isError && <p role="alert">Could not load tasks.</p>}
      {!query.isPending && !tasks.length && (
        <p className="text-sm text-muted-foreground">No tasks to show.</p>
      )}
      <ul className="space-y-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="min-w-0 space-y-2 rounded-lg border border-border p-3"
            data-qqq-id={`task-${task.id}`}
          >
            <div className="flex items-start gap-2">
              <input
                aria-label={`${task.status === 'OPEN' ? 'Complete' : 'Reopen'} ${task.title}`}
                type="checkbox"
                checked={task.status === 'DONE'}
                disabled={!canTask || actions.patch.isPending}
                onChange={() =>
                  actions.patch.mutate({
                    id: task.id,
                    input: { status: task.status === 'OPEN' ? 'DONE' : 'OPEN' },
                  })
                }
                data-qqq-id={`task-toggle-${task.id}`}
              />
              <span className="min-w-0 break-words text-sm font-medium">{task.title}</span>
            </div>
            {task.notes && (
              <div className="break-words text-sm">
                <ReactMarkdown>{task.notes}</ReactMarkdown>
              </div>
            )}
            {task.assigneeUserId && (
              <p className="text-xs text-muted-foreground">Assigned to {task.assigneeUserId}</p>
            )}
            {task.dueAt && (
              <p className="text-xs">
                {task.status === 'OPEN' && Date.parse(task.dueAt) < Date.now()
                  ? 'Overdue: '
                  : 'Due: '}
                {new Date(task.dueAt).toLocaleString()}
              </p>
            )}
            {canTask && (
              <button
                className={collaborationButton}
                onClick={() => setEditing(task)}
                data-qqq-id={`task-edit-${task.id}`}
              >
                Edit
              </button>
            )}
          </li>
        ))}
      </ul>
      {actions.patch.isError && <p role="alert">{actions.patch.error.message}</p>}
      {query.hasNextPage && (
        <button
          className={collaborationButton}
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
          data-qqq-id="tasks-more"
        >
          Load more tasks
        </button>
      )}
      {editing && (
        <TaskEditor
          record={record}
          task={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
