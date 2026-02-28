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

// Tests for the ScriptEditor component

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { ScriptEditor } from './ScriptEditor'

describe('ScriptEditor — rendering', () => {
  it('renders the label text', () => {
    render(
      <ScriptEditor
        id="test-script"
        label="My Script"
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('My Script')).toBeInTheDocument()
  })

  it('renders a textarea element', () => {
    render(
      <ScriptEditor
        id="test-script"
        label="My Script"
        value="console.log('hello')"
        onChange={vi.fn()}
      />
    )
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue("console.log('hello')")
  })

  it('associates the label with the textarea via htmlFor/id', () => {
    render(
      <ScriptEditor
        id="my-editor"
        label="Editor Label"
        value=""
        onChange={vi.fn()}
      />
    )
    const textarea = screen.getByLabelText('Editor Label')
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('renders the language badge when language prop is provided', () => {
    render(
      <ScriptEditor
        id="groovy-script"
        label="Groovy Script"
        value=""
        onChange={vi.fn()}
        language="groovy"
      />
    )
    expect(screen.getByText('Groovy')).toBeInTheDocument()
  })

  it('renders "Text" badge when language is not specified', () => {
    render(
      <ScriptEditor
        id="text-script"
        label="Script"
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Text')).toBeInTheDocument()
  })

  it('renders the line count in the toolbar', () => {
    render(
      <ScriptEditor
        id="multi-line"
        label="Script"
        value={'line1\nline2\nline3'}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/3 lines/)).toBeInTheDocument()
  })

  it('sets data-qqq-id on the wrapper', () => {
    render(
      <ScriptEditor
        id="my-script"
        label="Script"
        value=""
        onChange={vi.fn()}
      />
    )
    expect(
      document.querySelector('[data-qqq-id="script-editor-my-script"]')
    ).toBeInTheDocument()
  })
})

describe('ScriptEditor — onChange', () => {
  it('calls onChange when the user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ScriptEditor
        id="typing-test"
        label="Script"
        value=""
        onChange={onChange}
      />
    )

    await user.type(screen.getByRole('textbox'), 'hello')
    expect(onChange).toHaveBeenCalled()
  })
})

describe('ScriptEditor — Tab key', () => {
  it('inserts two spaces when Tab is pressed instead of moving focus', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ScriptEditor
        id="tab-test"
        label="Script"
        value=""
        onChange={onChange}
      />
    )

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.keyboard('{Tab}')

    // onChange should have been called with two spaces
    const calls = onChange.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    // The last call should include two spaces
    const lastCallValue = calls[calls.length - 1][0] as string
    expect(lastCallValue).toBe('  ')
  })
})

describe('ScriptEditor — readOnly', () => {
  it('renders the textarea as readonly when readOnly=true', () => {
    render(
      <ScriptEditor
        id="readonly-test"
        label="Script"
        value="const x = 1"
        onChange={vi.fn()}
        readOnly={true}
      />
    )
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('readonly')
  })

  it('does not render readonly attribute when readOnly=false', () => {
    render(
      <ScriptEditor
        id="editable-test"
        label="Script"
        value=""
        onChange={vi.fn()}
        readOnly={false}
      />
    )
    const textarea = screen.getByRole('textbox')
    expect(textarea).not.toHaveAttribute('readonly')
  })
})

describe('ScriptEditor — error display', () => {
  it('shows the error message when error prop is provided', () => {
    render(
      <ScriptEditor
        id="error-test"
        label="Script"
        value=""
        onChange={vi.fn()}
        error={{ message: 'Script is required' }}
      />
    )
    expect(screen.getByText('Script is required')).toBeInTheDocument()
  })

  it('does not show an error message when error is undefined', () => {
    render(
      <ScriptEditor
        id="no-error-test"
        label="Script"
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sets aria-invalid on the textarea when error is present', () => {
    render(
      <ScriptEditor
        id="aria-invalid-test"
        label="Script"
        value=""
        onChange={vi.fn()}
        error={{ message: 'Required' }}
      />
    )
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
  })
})
