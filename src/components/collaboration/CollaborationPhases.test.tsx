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

import React from 'react'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import * as api from '@/lib/api/collaboration'
import { getRecord } from '@/lib/api/tables'
import type { RealtimeEvent } from '@/lib/realtime/client'
import { ShareDialog } from './ShareDialog'
import { RequestAccess } from './RequestAccess'
import { TasksTab } from './TasksTab'
import { CollaborationEdit } from './CollaborationEdit'
import { MyWork } from './MyWork'
import { qInstance } from '@/mocks/fixtures/q-instance'
let receive: ((event: RealtimeEvent) => void) | undefined
vi.mock('@/lib/hooks/use-realtime-channel', () => ({
  useRealtimeChannel: (_channel: string, callback?: typeof receive) => {
    receive = callback
  },
}))
vi.mock('@/lib/hooks/use-collaboration-presence', () => ({
  useCollaborationPresence: () => ({ viewers: [] }),
}))
vi.mock('@/lib/context/q-context', async () => {
  const { createContext } = await import('react')
  return { useQContext: () => ({ userId: 'me' }), QContext: createContext({ userId: 'me' }) }
})
vi.mock('@/lib/hooks/use-collaboration-core', () => ({
  useCollaborationAvailable: () => ({ data: true }),
}))
vi.mock('@/lib/hooks/use-metadata', () => ({
  useMetaData: () => ({ data: qInstance }),
  useTableMetaData: () => ({ data: qInstance.tables.person }),
}))
vi.mock('@/lib/api/tables', () => ({
  getRecord: vi.fn(),
  queryRecords: vi.fn().mockResolvedValue({
    records: [{ tableName: 'person', values: { id: 1 }, recordLabel: 'Alice' }],
  }),
}))
vi.mock('@/lib/api/collaboration', () => ({
  searchPeople: vi.fn(),
  mentionCandidates: vi.fn(),
  getRecordLink: vi.fn(),
  previewShares: vi.fn(),
  shareRecord: vi.fn(),
  requestAccess: vi.fn(),
  listTasks: vi.fn(),
  createTask: vi.fn(),
  patchTask: vi.fn(),
  getMyWork: vi.fn(),
  markMentionsRead: vi.fn().mockResolvedValue({ success: true }),
  listMyTasks: vi.fn(),
}))
const record = { table: 'person', pk: '1' }
function mount(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.searchPeople).mockResolvedValue({
    items: [
      { userId: 'sam', displayName: 'Sam Parker', email: null },
      { userId: 'alex', displayName: 'Alex Rivera', email: null },
      { userId: 'unknown', displayName: 'Taylor', email: null },
    ],
    nextCursor: null,
  })
  vi.mocked(api.previewShares).mockImplementation(async (_record, ids) => ({
    recipients: ids.map((id) => ({
      userId: id,
      displayName: id === 'sam' ? 'Sam Parker' : id,
      canRead: id === 'unknown' ? null : id === 'alex',
    })),
  }))
  vi.mocked(api.mentionCandidates).mockResolvedValue({
    items: [
      { person: { userId: 'sam', displayName: 'Sam Parker' }, canRead: 'false' },
      { person: { userId: 'alex', displayName: 'Alex Rivera' }, canRead: 'true' },
    ],
    nextCursor: null,
  })
  vi.mocked(api.getRecordLink).mockResolvedValue({ url: 'https://example.test/app/person/1' })
  vi.mocked(api.shareRecord).mockResolvedValue({
    items: [
      { id: 1, toUserId: 'sam', recipientCouldRead: false },
      { id: 2, toUserId: 'alex', recipientCouldRead: true },
    ],
  })
  vi.mocked(api.listTasks).mockResolvedValue({
    items: [{ id: 1, title: 'Review order', status: 'OPEN' }],
    nextCursor: null,
  })
  vi.mocked(api.listMyTasks).mockResolvedValue({ items: [], nextCursor: null })
  vi.mocked(api.createTask).mockResolvedValue({ id: 2 })
  vi.mocked(api.patchTask).mockResolvedValue({ id: 1 })
  vi.mocked(getRecord).mockResolvedValue({
    tableName: 'person',
    values: { id: 1, firstName: 'Their value', modifyDate: 'v2' },
  })
})
it('previews inaccessible and unknown recipients, then reports notified and offered access', async () => {
  mount(<ShareDialog record={record} canShare onClose={vi.fn()} />)
  expect(await screen.findByText("can't open this record")).toBeVisible()
  expect(screen.getByText('unknown')).toBeVisible()
  fireEvent.click(screen.getByLabelText(/Sam Parker/))
  fireEvent.click(screen.getByLabelText(/Alex Rivera/))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByText('Sam Parker: Offered access')).toBeVisible()
  expect(screen.getByText('alex: Notified')).toBeVisible()
})
it('leaves the signed-in user out of share recipients even when the service returns them', async () => {
  vi.mocked(api.searchPeople).mockResolvedValueOnce({
    items: [
      { userId: 'ME', displayName: 'Me Myself', email: null },
      { userId: 'x9', displayName: 'Mail Match', email: 'Me' },
      { userId: 'alex', displayName: 'Alex Rivera', email: null },
    ],
    nextCursor: null,
  })
  mount(<ShareDialog record={record} canShare onClose={vi.fn()} />)
  expect(await screen.findByLabelText(/Alex Rivera/)).toBeVisible()
  expect(screen.queryByLabelText(/Me Myself/)).toBeNull()
  expect(screen.queryByLabelText(/Mail Match/)).toBeNull()
})
it('uses identical non-disclosing access copy even when the server reports missing record', async () => {
  vi.mocked(api.requestAccess).mockRejectedValue(
    new Error('Record does not exist: sensitive detail')
  )
  mount(<RequestAccess tableName="person" recordId="missing" shareId={12} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
    target: { value: 'Please review' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Request access' }))
  expect(await screen.findByRole('alert')).not.toHaveTextContent('sensitive detail')
  expect(document.body).not.toHaveTextContent('does not exist')
  expect(api.requestAccess).toHaveBeenCalledWith({
    tableName: 'person',
    recordId: 'missing',
    shareId: 12,
    message: 'Please review',
  })
})
it('shows a stream warning, compares theirs and mine, and uses the same dialog on 409', async () => {
  const props = {
    table: qInstance.tables.person,
    pk: '1',
    available: true,
    realtime: true,
    error: null,
    getValues: () => ({ firstName: 'My value' }),
    onViewers: vi.fn(),
    onOverwrite: vi.fn(),
    onReload: vi.fn(),
    pending: false,
  }
  mount(<CollaborationEdit {...props} />)
  act(() =>
    receive?.({
      event: 'record.changed',
      data: { table: 'person', pk: '1', changedBy: 'sam', fields: ['firstName'] },
    })
  )
  expect(await screen.findByText(/Sam Parker saved changes/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
  expect(await screen.findByText('Their value')).toBeVisible()
  expect(screen.getByText('My value')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Keep mine (overwrite)' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Use theirs' }))
  expect(props.onReload).toHaveBeenCalled()
})
it('opens 409 review automatically and overwrites only with the refreshed version', async () => {
  const overwrite = vi.fn()
  const error = Object.assign(new Error('Conflict'), {
    status: 409,
    response: {
      status: 409,
      data: { currentVersion: 'v2', changedFields: ['firstName'], modifiedByUserId: 'sam' },
    },
  })
  mount(
    <CollaborationEdit
      table={qInstance.tables.person}
      pk="1"
      available
      realtime
      error={error}
      getValues={() => ({ firstName: 'Mine' })}
      onViewers={vi.fn()}
      onOverwrite={overwrite}
      onReload={vi.fn()}
      pending={false}
    />
  )
  expect(await screen.findByText('Their value')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Keep mine (overwrite)' }))
  expect(overwrite).toHaveBeenCalledWith('v2')
})
it('refuses unreadable assignees, creates and toggles a task', async () => {
  mount(<TasksTab record={record} features={{ capabilities: { task: true } }} />)
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Complete Review order' }))
  await waitFor(() => expect(api.patchTask).toHaveBeenCalledWith(1, { status: 'DONE' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }))
  await waitFor(() => expect(screen.getByLabelText(/Sam Parker/)).toBeDisabled())
  await waitFor(() => expect(screen.getByLabelText(/Alex Rivera/)).toBeEnabled())
  expect(api.previewShares).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: 'New task' },
  })
  fireEvent.click(screen.getByLabelText(/Alex Rivera/))
  fireEvent.click(screen.getByRole('button', { name: 'Save task' }))
  await waitFor(() =>
    expect(api.createTask).toHaveBeenCalledWith(
      record,
      expect.objectContaining({ title: 'New task', assigneeUserId: 'alex' })
    )
  )
})
it('names task people by display name and falls back to the user id', async () => {
  vi.mocked(api.listTasks).mockResolvedValue({
    items: [
      {
        id: 1,
        title: 'Named',
        status: 'DONE',
        assigneeUserId: 'alex',
        assigneeDisplayName: 'Alex Rivera',
        createdByUserId: 'morgan',
        createdByDisplayName: 'Morgan Lee',
        completedByUserId: 'sam',
        completedByDisplayName: 'Sam Parker',
      },
      { id: 2, title: 'Unnamed', status: 'OPEN', assigneeUserId: 'u7', createdByUserId: 'u8' },
    ],
    nextCursor: null,
  })
  mount(<TasksTab record={record} features={{ capabilities: { task: true } }} />)
  expect(await screen.findByText('Assigned to u7')).toBeVisible()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show done' }))
  expect(await screen.findByText('Assigned to Alex Rivera')).toBeVisible()
  expect(screen.getByText('Created by Morgan Lee · Completed by Sam Parker')).toBeVisible()
  expect(screen.getByText('Assigned to u7')).toBeVisible()
  expect(screen.getByText('Created by u8')).toBeVisible()
})
it('renders My work with overdue task, assigned table and unread mentions links', async () => {
  vi.mocked(api.getMyWork).mockResolvedValue({
    openTaskCount: 1,
    tasks: [
      {
        id: 1,
        title: 'Review order',
        status: 'OPEN',
        tableName: 'person',
        recordId: '1',
        dueAt: '2020-01-01T00:00:00Z',
      },
    ],
    assignedRecordsByTable: { person: 1 },
    unreadMentionCount: 3,
  })
  vi.mocked(api.listMyTasks).mockResolvedValue({
    items: [
      {
        id: 1,
        title: 'Review order',
        status: 'OPEN',
        tableName: 'person',
        recordId: '1',
        dueAt: '2020-01-01T00:00:00Z',
      },
    ],
    nextCursor: null,
  })
  mount(<MyWork />)
  expect(await screen.findByRole('link', { name: 'Review order' })).toHaveAttribute(
    'href',
    '/app/person/1'
  )
  expect(await screen.findByRole('link', { name: 'Alice' })).toHaveAttribute(
    'href',
    '/app/person/1'
  )
  expect(screen.getByText(/Overdue:/)).toBeVisible()
  expect(screen.getByRole('link', { name: '3 unread mentions' })).toBeVisible()
  vi.mocked(api.getMyWork).mockResolvedValue({
    openTaskCount: 1,
    tasks: [],
    assignedRecordsByTable: { person: 1 },
    unreadMentionCount: 0,
  })
  fireEvent.click(screen.getByRole('button', { name: 'Mark all mentions read' }))
  await waitFor(() => expect(api.markMentionsRead).toHaveBeenCalledTimes(1))
  expect(await screen.findByRole('link', { name: '0 unread mentions' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Mark all mentions read' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /People \(1\)|Person \(1\)/ })).toHaveAttribute(
    'href',
    expect.stringContaining('CurrentUser')
  )
})
