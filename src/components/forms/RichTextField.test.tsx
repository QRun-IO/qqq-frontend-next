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

// Rich-text editor: engine-neutral values without disturbing the user's editing (#649)

import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RichTextField } from './RichTextField'

function Harness({ onValue }: { onValue: (value: string) => void }) {
  const [value, setValue] = useState('')
  return <RichTextField aria-label="Html Value" value={value} onChange={(next) => { setValue(next); onValue(next) }} />
}

describe('RichTextField', () => {
  it('reports editing-only non-breaking spaces as plain spaces and leaves the editor DOM alone', () => {
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    const editor = screen.getByRole('textbox', { name: 'Html Value' })
    // what Firefox leaves after typing "Plain ", Bold, "Strong"
    editor.innerHTML = 'Plain&nbsp;<b>Strong</b>'
    const bold = editor.querySelector('b')
    fireEvent.input(editor)
    expect(onValue).toHaveBeenLastCalledWith('Plain <b>Strong</b>')
    // the editor keeps its own nodes (rewriting them would move the caret)
    expect(editor.querySelector('b')).toBe(bold)
    expect(editor.innerHTML).toBe('Plain&nbsp;<b>Strong</b>')
  })

  it('still writes values that change from outside into the editor', () => {
    const { rerender } = render(<RichTextField aria-label="Html Value" value="<i>first</i>" onChange={vi.fn()} />)
    const editor = screen.getByRole('textbox', { name: 'Html Value' })
    expect(editor.innerHTML).toBe('<i>first</i>')
    rerender(<RichTextField aria-label="Html Value" value="second" onChange={vi.fn()} />)
    expect(editor.innerHTML).toBe('second')
  })
})
