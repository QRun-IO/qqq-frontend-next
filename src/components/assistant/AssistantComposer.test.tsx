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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'

import { AssistantComposer } from './AssistantComposer'

/** Composer props with no page context. */
const BASE = {
  pageInfo: null,
  contextDismissed: false,
  onDismissContext: () => {},
  onRefreshContext: () => {},
  streaming: false,
  stopping: false,
  onSend: () => {},
  onStop: () => {},
}

describe('AssistantComposer attachments', () => {
  it('hides the attach button unless attaching is offered', () => {
    render(<AssistantComposer {...BASE} />)
    expect(screen.queryByRole('button', { name: 'Attach a file' })).toBeNull()
  })

  it('attaches a picked file, lists attachments and removes one', async () => {
    const onAttach = vi.fn()
    const onRemove = vi.fn()
    const { container } = render(
      <AssistantComposer {...BASE} onAttach={onAttach} onRemoveAttachment={onRemove}
        attachments={[{ uploadRef: 'up_1', fileName: 'posts.csv' }]} />
    )
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeEnabled()
    expect(screen.getByRole('list', { name: 'Attached files' })).toHaveTextContent('posts.csv')

    const input = container.querySelector('[data-qqq-id="assistant-attach-input"]') as HTMLInputElement
    const file = new File(['Title\nHello\n'], 'more.csv', { type: 'text/csv' })
    await userEvent.upload(input, file)
    expect(onAttach).toHaveBeenCalledWith(file)
    expect(input.accept).toContain('.csv')

    await userEvent.click(screen.getByRole('button', { name: 'Remove posts.csv' }))
    expect(onRemove).toHaveBeenCalledWith('up_1')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows the upload in progress and disables attaching', () => {
    render(<AssistantComposer {...BASE} onAttach={() => {}} attaching />)
    expect(screen.getByRole('status')).toHaveTextContent('Uploading')
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeDisabled()
  })
})
