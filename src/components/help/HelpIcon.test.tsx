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

/** @file Shared help control keyboard, summary, and author permissions. */
import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { HelpIcon } from './HelpIcon'

const state = vi.hoisted(() => ({ author: false, canAuthor: false, openHelp: vi.fn() }))
vi.mock('@/lib/context/q-context', () => ({ useHelpHelpActive: () => state.author }))
vi.mock('./HelpPanelProvider', () => ({
  HELP_CONTENT_TABLE: 'helpContent',
  useHelpPanel: () => state,
}))
beforeEach(() => {
  state.author = false
  state.canAuthor = false
  state.openHelp.mockReset()
})

it('hides inapplicable help', () => {
  render(
    <HelpIcon label="Address" helpContents={[{ content: 'Edit only', roles: ['EDIT_SCREEN'] }]} />
  )
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('describes the button with the short summary and opens long help using Enter and Space', async () => {
  const helpContent = {
    summary: 'Postal address.',
    content: 'Full instructions for entering an address.',
  }
  const user = userEvent.setup()
  render(<HelpIcon label="Address" helpKey="table:owned;field:address" helpContent={helpContent} />)
  const button = screen.getByRole('button', { name: 'Help for Address' })
  await user.tab()
  expect(button).toHaveAccessibleDescription('Postal address.')
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Postal address.')
  expect(screen.getByRole('tooltip')).not.toHaveTextContent(helpContent.content)
  await user.keyboard('{Enter}')
  expect(state.openHelp).toHaveBeenCalledWith({ key: 'table:owned;field:address', label: 'Address', helpContent })
  await user.keyboard(' ')
  expect(state.openHelp).toHaveBeenCalledTimes(2)
})

it('closes the tooltip on Escape and does not invoke the adjacent action', async () => {
  const action = vi.fn()
  render(
    <div onClick={action}>
      <HelpIcon label="Address" helpContent={{ content: 'Address instructions.' }} />
    </div>
  )
  const button = screen.getByRole('button')
  fireEvent.focus(button)
  expect(await screen.findByRole('tooltip')).toBeInTheDocument()
  fireEvent.keyDown(button, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  fireEvent.click(button)
  expect(action).not.toHaveBeenCalled()
})

it('preserves key suffixes without granting authorship, then prefills the specific key and role', () => {
  state.author = true
  const props = {
    label: 'Address',
    helpKey: 'table:owned;field:address',
    roles: ['INSERT_SCREEN', 'WRITE_SCREENS', 'ALL_SCREENS'],
  }
  const { rerender } = render(<HelpIcon {...props} />)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByRole('button')).toHaveAccessibleDescription('[table:owned;field:address]')
  state.canAuthor = true
  rerender(<HelpIcon {...props} />)
  const href = screen.getByRole('link', { name: 'Add help' }).getAttribute('href')!
  expect(href.split('#')[0]).toBe('/app/helpContent/create')
  expect(JSON.parse(decodeURIComponent(href.split('defaultValues=')[1]))).toEqual({
    key: props.helpKey,
    role: 'INSERT_SCREEN',
  })
  rerender(<HelpIcon {...props} helpContent={{ content: 'Existing' }} />)
  const editHref = screen.getByRole('link', { name: 'Edit help' }).getAttribute('href')!
  expect(editHref.split('?')[0]).toBe('/app/helpContent')
  expect(atob(decodeURIComponent(editHref.split('filter=')[1]))).toContain(props.helpKey)
})
