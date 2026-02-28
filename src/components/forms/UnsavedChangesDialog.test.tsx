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

// Tests for UnsavedChangesDialog component

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { UnsavedChangesDialog } from './UnsavedChangesDialog'

describe('UnsavedChangesDialog — visibility', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <UnsavedChangesDialog open={false} onStay={vi.fn()} onLeave={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the dialog when open=true', () => {
    render(
      <UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />
    )
    // The dialog renders two nodes with this text: an sr-only Radix title and the visible h2.
    // Use getAllByText and assert at least one is present.
    expect(screen.getAllByText('Unsaved Changes').length).toBeGreaterThanOrEqual(1)
  })
})

describe('UnsavedChangesDialog — content', () => {
  it('displays the warning message body', () => {
    render(
      <UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />
    )
    expect(
      screen.getByText(/you have unsaved changes/i)
    ).toBeInTheDocument()
  })

  it('shows both "Stay" and "Leave" buttons', () => {
    render(
      <UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /^stay$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^leave$/i })).toBeInTheDocument()
  })

  it('has data-qqq-id="unsaved-changes-dialog" on the content element', () => {
    render(
      <UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />
    )
    expect(document.querySelector('[data-qqq-id="unsaved-changes-dialog"]')).toBeInTheDocument()
  })
})

describe('UnsavedChangesDialog — callbacks', () => {
  it('calls onStay when "Stay" button is clicked', async () => {
    const user = userEvent.setup()
    const onStay = vi.fn()

    render(
      <UnsavedChangesDialog open={true} onStay={onStay} onLeave={vi.fn()} />
    )

    await user.click(screen.getByRole('button', { name: /^stay$/i }))
    expect(onStay).toHaveBeenCalledOnce()
  })

  it('calls onLeave when "Leave" button is clicked', async () => {
    const user = userEvent.setup()
    const onLeave = vi.fn()

    render(
      <UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={onLeave} />
    )

    await user.click(screen.getByRole('button', { name: /^leave$/i }))
    expect(onLeave).toHaveBeenCalledOnce()
  })

  it('does not call onLeave when "Stay" is clicked', async () => {
    const user = userEvent.setup()
    const onLeave = vi.fn()
    const onStay = vi.fn()

    render(
      <UnsavedChangesDialog open={true} onStay={onStay} onLeave={onLeave} />
    )

    await user.click(screen.getByRole('button', { name: /^stay$/i }))
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('does not call onStay when "Leave" is clicked', async () => {
    const user = userEvent.setup()
    const onStay = vi.fn()
    const onLeave = vi.fn()

    render(
      <UnsavedChangesDialog open={true} onStay={onStay} onLeave={onLeave} />
    )

    await user.click(screen.getByRole('button', { name: /^leave$/i }))
    expect(onStay).not.toHaveBeenCalled()
  })
})

describe('UnsavedChangesDialog — accessibility', () => {
  it('has an accessible title via sr-only element', () => {
    render(
      <UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />
    )
    // The Radix AlertDialog.Title is sr-only but still in the DOM
    expect(screen.getAllByText('Unsaved Changes').length).toBeGreaterThanOrEqual(1)
  })

  it('has the description paragraph with its id for aria-describedby', () => {
    render(
      <UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />
    )
    const desc = document.getElementById('unsaved-changes-description')
    expect(desc).toBeInTheDocument()
  })

  it('has data-qqq-id on Stay button', () => {
    render(
      <UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />
    )
    expect(document.querySelector('[data-qqq-id="unsaved-changes-stay"]')).toBeInTheDocument()
  })

  it('has data-qqq-id on Leave button', () => {
    render(
      <UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />
    )
    expect(document.querySelector('[data-qqq-id="unsaved-changes-leave"]')).toBeInTheDocument()
  })
})
