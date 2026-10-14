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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import * as api from '@/lib/api/collaboration'
import type { Attachment, RecordFeaturesV1 } from '@/types/collaboration'
import { CommentComposer } from './CommentComposer'
import { CollaborationMarkdown } from './CollaborationMarkdown'
import { FilesTab } from './FilesTab'
import { TagChips } from './TagChips'
import { ActivityTab } from './ActivityTab'
import { FollowBell } from './FollowBell'

vi.mock('@/lib/api/collaboration', () => ({
  mentionCandidates: vi.fn(),
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  attachmentUrl: vi.fn(),
  getRecordTags: vi.fn(),
  tagVocabulary: vi.fn(),
  createTag: vi.fn(),
  putRecordTags: vi.fn(),
  listTimeline: vi.fn(),
  getFollow: vi.fn(),
  putFollow: vi.fn(),
  deleteFollow: vi.fn(),
  listFollowers: vi.fn(),
}))
const record = { table: 'person', pk: '1' }
const features: RecordFeaturesV1 = {
  features: ['TAGS', 'COMMENTS', 'ATTACHMENTS', 'TIMELINE', 'FOLLOW'],
  capabilities: { tag: true, comment: true, attach: true },
  settings: { ATTACHMENTS: { maxBytes: 10 }, TAGS: { mode: 'FREE' } },
}
function mount(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.mentionCandidates).mockResolvedValue({
    items: [{ person: { userId: 'sam', displayName: 'Sam Parker' }, canRead: 'false' }],
    nextCursor: null,
  })
  vi.mocked(api.listAttachments).mockResolvedValue({ items: [], nextCursor: null })
  vi.mocked(api.getRecordTags).mockResolvedValue({
    items: [{ id: 1, label: 'Customer' }],
    nextCursor: null,
  })
  vi.mocked(api.tagVocabulary).mockResolvedValue({
    items: [{ id: 2, label: 'Priority', approved: true }],
    nextCursor: null,
  })
  vi.mocked(api.putRecordTags).mockResolvedValue({ items: [], nextCursor: null })
})
it('inserts a mention with the keyboard, warns and submits the literal token', async () => {
  const submit = vi.fn().mockResolvedValue(undefined)
  mount(<CommentComposer record={record} onSubmit={submit} />)
  const input = screen.getByRole('textbox', { name: 'Comment' })
  fireEvent.change(input, { target: { value: 'Hello @Sa', selectionStart: 9 } })
  expect(await screen.findByRole('option')).toHaveTextContent("can't open this record")
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(input).toHaveValue('Hello @[Sam Parker](user:sam) ')
  expect(screen.getByRole('status')).toHaveTextContent(
    "Sam Parker can't see this record and won't be notified"
  )
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  expect(document.querySelector('[data-qqq-id="mention-chip"]')).toHaveTextContent('Sam Parker')
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  await waitFor(() => expect(submit).toHaveBeenCalledWith('Hello @[Sam Parker](user:sam) '))
})
it('removes a warning when the mention is removed and preserves failed drafts', async () => {
  mount(
    <CommentComposer record={record} onSubmit={vi.fn().mockRejectedValue(new Error('Denied'))} />
  )
  const input = screen.getByRole('textbox', { name: 'Comment' })
  fireEvent.change(input, { target: { value: '@Sa', selectionStart: 3 } })
  fireEvent.click(await screen.findByRole('option'))
  fireEvent.change(input, { target: { value: 'Revised draft', selectionStart: 13 } })
  expect(document.querySelector('[data-qqq-id="mention-warning"]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Denied')
  expect(input).toHaveValue('Revised draft')
})
it('sanitizes HTML, active links and remote images in markdown preview', () => {
  const { container } = mount(
    <CollaborationMarkdown
      body={
        '<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n[bad](javascript:alert(1)) ![remote](https://other.test/image) **Safe** @[Sam](user:sam)'
      }
    />
  )
  expect(container.querySelector('script,img,iframe,[onerror],a[href^="javascript:"]')).toBeNull()
  expect(screen.getByText('Safe').tagName).toBe('STRONG')
  expect(container.querySelector('[data-qqq-id="mention-chip"]')).toHaveTextContent('Sam')
})
it('rejects oversized files before uploading', async () => {
  mount(<FilesTab record={record} features={features} />)
  await screen.findByText('No files yet.')
  fireEvent.change(document.querySelector('[data-qqq-id="files-picker"]')!, {
    target: { files: [new File(['01234567890'], 'large.txt')] },
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('large.txt is too large')
  expect(api.uploadAttachment).not.toHaveBeenCalled()
})
it('shows upload progress, then supports confirmed deletion', async () => {
  let finish!: (value: Attachment) => void
  let report!: (percent: number) => void
  const file: Attachment = { id: 9, fileName: 'small.txt', canDelete: true, sizeBytes: 4 }
  vi.mocked(api.uploadAttachment).mockImplementation((_record, _file, progress) => {
    report = progress
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  vi.mocked(api.deleteAttachment).mockImplementation(async () => {
    vi.mocked(api.listAttachments).mockResolvedValue({ items: [], nextCursor: null })
    return { success: true }
  })
  mount(<FilesTab record={record} features={features} />)
  await screen.findByText('No files yet.')
  fireEvent.change(document.querySelector('[data-qqq-id="files-picker"]')!, {
    target: { files: [new File(['tiny'], 'small.txt')] },
  })
  await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalled())
  act(() => report(50))
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '50')
  vi.mocked(api.listAttachments).mockResolvedValue({ items: [file], nextCursor: null })
  await act(async () => finish(file))
  const row = await screen.findByRole('button', { name: /small.txt/ })
  expect(row).toBeVisible()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(api.deleteAttachment).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(api.deleteAttachment).toHaveBeenCalledWith(9))
  await screen.findByText('No files yet.')
  confirm.mockRestore()
})
it('does not offer file uploads without attach permission', async () => {
  mount(<FilesTab record={record} features={{ ...features, capabilities: { attach: false } }} />)
  expect(document.querySelector('[data-qqq-id="files-picker"]')).toBeNull()
  expect(screen.getByText(/permission to attach/)).toBeVisible()
})
it('pages activity with the returned cursor and shows audit details', async () => {
  vi.mocked(api.listTimeline)
    .mockResolvedValueOnce({
      items: [
        {
          id: 1,
          kind: 'AUDIT',
          summary: 'Changed email',
          details: [{ fieldName: 'email', oldValue: 'old', newValue: 'new' }],
        },
      ],
      nextCursor: 'older',
    })
    .mockResolvedValueOnce({
      items: [{ id: 2, kind: 'ACTIVITY', summary: 'Uploaded file' }],
      nextCursor: null,
    })
  mount(<ActivityTab record={record} />)
  await screen.findByText('Changed email')
  fireEvent.click(screen.getByText('Details'))
  expect(screen.getByText('old → new')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  await screen.findByText('Uploaded file')
  expect(api.listTimeline).toHaveBeenLastCalledWith(record, 'older')
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
})
it.each(['FREE', 'APPROVED_ONLY'])(
  'handles tag mode %s without applying pending suggestions',
  async (mode) => {
    const tag = { id: 4, label: 'New tag', approved: mode === 'FREE' }
    vi.mocked(api.createTag).mockResolvedValue(tag)
    mount(<TagChips record={record} features={{ ...features, settings: { TAGS: { mode } } }} />)
    await screen.findByText('Customer')
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'New tag' } })
    fireEvent.click(
      await screen.findByRole('button', { name: mode === 'FREE' ? /Create tag/ : /Suggest tag/ })
    )
    await waitFor(() =>
      expect(api.createTag).toHaveBeenCalledWith({ table: 'person', label: 'New tag' })
    )
    if (mode === 'FREE')
      await waitFor(() =>
        expect(api.putRecordTags).toHaveBeenCalledWith(record, { add: [4], remove: undefined })
      )
    else {
      expect(await screen.findByRole('status')).toHaveTextContent('Suggested tag: New tag')
      expect(api.putRecordTags).not.toHaveBeenCalled()
    }
  }
)
it('removes chips only when tagging is allowed', async () => {
  const view = mount(
    <TagChips record={record} features={{ ...features, capabilities: { tag: false } }} />
  )
  await screen.findByText('Customer')
  expect(screen.queryByRole('button', { name: /Remove tag/ })).toBeNull()
  view.unmount()
  mount(<TagChips record={record} features={features} />)
  const remove = await screen.findByRole('button', { name: 'Remove tag Customer' })
  await waitFor(() => expect(remove).toBeEnabled())
  fireEvent.click(remove)
  await waitFor(() =>
    expect(api.putRecordTags).toHaveBeenCalledWith(record, { add: undefined, remove: [1] })
  )
})
it('follows and exposes notification preferences and follower count', async () => {
  vi.mocked(api.getFollow).mockResolvedValue({ following: false, follow: null })
  vi.mocked(api.putFollow).mockImplementation(async (_record, input) => {
    const state = {
      following: true,
      follow: { notifyOnChange: true, notifyOnComment: true, ...input },
    }
    vi.mocked(api.getFollow).mockResolvedValue(state)
    return state
  })
  vi.mocked(api.listFollowers).mockResolvedValue({ items: [{ userId: 'sam' }], nextCursor: null })
  mount(<FollowBell record={record} />)
  const bell = screen.getByRole('button', { name: 'Follow record' })
  await waitFor(() => expect(bell).toBeEnabled())
  fireEvent.click(bell)
  await waitFor(() => expect(bell).toHaveAttribute('aria-pressed', 'true'))
  fireEvent.click(screen.getByRole('button', { name: 'Follow preferences' }))
  expect(await screen.findByText('1 followers')).toBeVisible()
  expect(within(screen.getByRole('dialog')).getByLabelText('Notify me about changes')).toBeChecked()
})
