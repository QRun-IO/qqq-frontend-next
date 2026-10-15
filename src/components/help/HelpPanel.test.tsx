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

/** @file Sanitized long help, navigation and modal keyboard behavior. */
import React, { useRef, useState } from 'react'

import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { HelpPanel } from './HelpPanel'

vi.mock('./HelpSearchResults', () => ({
  HelpSearchResults: ({ search, excludeKey, requireSummary, limit }: { search: string; excludeKey?: string; requireSummary?: boolean; limit?: number }) =>
    <p data-exclude-key={excludeKey} data-require-summary={requireSummary} data-limit={limit}>Related help for {search}</p>,
}))

/** Renders a controlled help sheet. @returns A panel and its invoking button. */
function Harness() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={ref} onClick={() => setOpen(true)}>
        Open help
      </button>
      <HelpPanel
        open={open}
        onOpenChange={setOpen}
        returnFocus={ref}
        entry={{
          key: 'table:owned;field:address',
          label: 'Address',
          href: '/app/owned',
          helpContent: {
            format: 'MARKDOWN',
            content: '**Long** help',
            contentAsHtml:
              '<p><strong>Long</strong> help</p><img src="x" onerror="alert(1)"><script>alert(1)</script>',
          },
        }}
      />
    </>
  )
}

it('renders sanitized markdown, related help and Go to, then restores focus on Escape', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Open help' }))
  const dialog = screen.getByRole('dialog', { name: 'Address' })
  expect(dialog.querySelector('strong')).toHaveTextContent('Long')
  expect(dialog.querySelector('script, [onerror]')).toBeNull()
  expect(screen.getByText('Related help for Address')).toHaveAttribute('data-exclude-key', 'table:owned;field:address')
  expect(screen.getByText('Related help for Address')).toHaveAttribute('data-require-summary', 'true')
  expect(screen.getByText('Related help for Address')).toHaveAttribute('data-limit', '5')
  expect(screen.getByRole('link', { name: 'Go to Address' })).toHaveAttribute('href', '/app/owned')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Open help' })).toHaveFocus()
})

it('does not expose unsafe navigation links', () => {
  render(
    <HelpPanel
      open
      onOpenChange={vi.fn()}
      returnFocus={{ current: null }}
      entry={{ label: 'Unsafe', href: 'javascript:alert(1)', helpContent: { content: 'Help' } }}
    />
  )
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
