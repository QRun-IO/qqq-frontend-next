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

// Tests for the process step wizard

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import type { QFrontendStepMetaData } from '@/types'
import { StepWizard } from './StepWizard'

const steps: QFrontendStepMetaData[] = [
  { name: 'first', label: 'First Step', components: [] },
  { name: 'second', label: 'A Very Long Second Step Label', components: [] },
]

describe('StepWizard', () => {
  it('marks the active step and shows a label tooltip on keyboard focus', async () => {
    render(<StepWizard steps={steps} currentStepName="first" />)
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1)
    const label = screen.getAllByText('A Very Long Second Step Label')[0]
    expect(label).toHaveAttribute('tabindex', '0')
    await act(async () => { fireEvent.focus(label) })
    expect(await screen.findByRole('tooltip')).toHaveTextContent('A Very Long Second Step Label')
    await act(async () => { fireEvent.keyDown(label, { key: 'Escape' }) })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('renders completed steps as back buttons when a click handler is given', () => {
    const onStepClick = vi.fn()
    render(<StepWizard steps={steps} currentStepName="second" onStepClick={onStepClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Go back to step: First Step' }))
    expect(onStepClick).toHaveBeenCalledWith('first')
  })
})
