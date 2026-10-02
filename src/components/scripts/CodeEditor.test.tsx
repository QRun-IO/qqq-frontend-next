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

import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CodeEditor, type CodeEditorProps } from './CodeEditor'

function Editor({ initial = '', ...props }: Partial<CodeEditorProps> & { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <><CodeEditor id="code" ariaLabel="Code" value={value} onChange={setValue} language="javascript" autocomplete {...props} /><button>After editor</button></>
}

describe('script code completions', () => {
  it('replaces the full token around the caret without duplicating a following parenthesis', async () => {
    const user = userEvent.setup()
    render(<Editor initial={'const result = api.query("person");'} />)
    const editor = screen.getByRole('textbox', { name: 'Code' }) as HTMLTextAreaElement
    await user.click(editor)
    editor.setSelectionRange(21, 21)
    await user.keyboard('{Control>} {/Control}')
    await user.click(screen.getByRole('option', { name: /api.query/ }))
    expect(editor).toHaveValue('const result = api.query("person");')
    expect(editor.selectionStart).toBe(25)
    expect(editor).toHaveFocus()
  })

  it('offers file identifiers and language keywords', async () => {
    const user = userEvent.setup()
    render(<Editor initial={'const shippingTotal = 3;\n'} />)
    const editor = screen.getByRole('textbox', { name: 'Code' })
    await user.type(editor, 'shippingT')
    await user.click(screen.getByRole('option', { name: /shippingTotal/ }))
    expect(editor).toHaveValue('const shippingTotal = 3;\nshippingTotal')
    await user.clear(editor)
    await user.type(editor, 'retu')
    await user.keyboard('{Tab}')
    expect(editor).toHaveValue('return')
  })

  it('opens explicit JSON suggestions and changes neither selection nor text on dismissal', async () => {
    const user = userEvent.setup()
    render(<Editor language="json" />)
    const editor = screen.getByRole('textbox', { name: 'Code' })
    await user.click(editor)
    await user.keyboard('{Control>} {/Control}')
    expect(screen.queryByRole('option', { name: /api\./ })).not.toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(editor).toHaveValue('false')
    await user.clear(editor)
    await user.type(editor, 'nu')
    await user.keyboard('{Escape}{Tab}')
    expect(screen.getByRole('button', { name: 'After editor' })).toHaveFocus()
    expect(editor).toHaveValue('nu')
  })

  it('does not intercept composition or replace a selected range', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const editor = screen.getByRole('textbox', { name: 'Code' }) as HTMLTextAreaElement
    await user.click(editor)
    fireEvent.compositionStart(editor)
    fireEvent.change(editor, { target: { value: 'api.qu' } })
    fireEvent.keyDown(editor, { key: 'Enter', isComposing: true })
    expect(editor).toHaveValue('api.qu')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.compositionEnd(editor)
    await user.keyboard('{Escape}')
    editor.setSelectionRange(0, 6)
    await user.keyboard('{Control>} {/Control}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(editor.selectionStart).toBe(0)
    expect(editor.selectionEnd).toBe(6)
  })

  it.each(['PageUp', 'PageDown'])('dismisses suggestions before %s moves the caret', async (key) => {
    const user = userEvent.setup()
    render(<Editor />)
    const editor = screen.getByRole('textbox', { name: 'Code' })
    await user.type(editor, 'api.qu')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(editor, { key })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(editor).toHaveValue('api.qu')
  })

  it('keeps current suggestions when a delayed scroll event reports their existing position', async () => {
    const user = userEvent.setup()
    render(<Editor initial={'const result = api.query("person");'} />)
    const editor = screen.getByRole('textbox', { name: 'Code' }) as HTMLTextAreaElement
    await user.click(editor)
    editor.scrollLeft = 4
    fireEvent.scroll(editor)
    editor.scrollLeft = 0
    fireEvent.change(editor, { target: { value: 'api.bu' } })
    editor.setSelectionRange(6, 6)
    await user.keyboard('{Control>} {/Control}{ArrowDown}')
    expect(screen.getAllByRole('option')).toHaveLength(3)

    fireEvent.scroll(editor)

    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: /api.bulkUpdate/ })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Tab}')
    expect(editor).toHaveValue('api.bulkUpdate(')
    expect(editor).toHaveFocus()
  })

  it.each(['scrollLeft', 'scrollTop'] as const)('dismisses suggestions when %s changes after they open', async (direction) => {
    const user = userEvent.setup()
    render(<Editor />)
    const editor = screen.getByRole('textbox', { name: 'Code' }) as HTMLTextAreaElement
    await user.type(editor, 'api.bu')
    expect(screen.getAllByRole('option')).toHaveLength(3)

    editor[direction] = 4
    fireEvent.scroll(editor)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(editor).toHaveValue('api.bu')
  })

  it.each([[0, 0], [0, 6]])('rejects a stale suggestion after selection changes to %s–%s', async (start, end) => {
    const user = userEvent.setup()
    render(<Editor />)
    const editor = screen.getByRole('textbox', { name: 'Code' }) as HTMLTextAreaElement
    await user.type(editor, 'api.qu')
    editor.setSelectionRange(start, end)
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(editor).toHaveValue('api.qu')
    expect(editor.selectionStart).toBe(start)
    expect(editor.selectionEnd).toBe(end)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it.each([{ readOnly: true }, { autocomplete: false }])('keeps completion disabled for $readOnly/$autocomplete editors', async (props) => {
    const user = userEvent.setup()
    render(<Editor initial="api.qu" {...props} />)
    const editor = screen.getByRole('textbox', { name: 'Code' })
    await user.click(editor)
    await user.keyboard('{Control>} {/Control}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(editor).toHaveValue('api.qu')
  })
})
