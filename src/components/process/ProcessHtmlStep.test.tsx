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

// Tests for ProcessHtmlStep component

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

// Mock DOMPurify before importing the component
vi.mock('dompurify', () => ({
  default: { sanitize: vi.fn() },
}))

// jsdom does not implement HTMLDialogElement.showModal / close
HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
})
HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
})

import { ProcessHtmlStep } from './ProcessHtmlStep'
import type { QFrontendStepMetaData } from '@/types'
import DOMPurify from 'dompurify'

const sanitizeMock = vi.mocked(DOMPurify.sanitize)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStep(overrides: Partial<QFrontendStepMetaData> = {}): QFrontendStepMetaData {
  return {
    name: 'htmlStep',
    label: 'HTML Step',
    components: [],
    viewFields: [],
    ...overrides,
  }
}

const defaultProps = {
  step: makeStep(),
  stepValues: { html: '<p>Hello world</p>' },
  isLoading: false,
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
  canGoBack: false,
  isLastStep: false,
}

describe('ProcessHtmlStep', () => {
  beforeEach(() => {
    sanitizeMock.mockClear()
    sanitizeMock.mockImplementation((s: string | Node) => (typeof s === 'string' ? s : ''))
    defaultProps.onSubmit.mockClear()
    defaultProps.onCancel.mockClear()
  })

  // ─── HTML rendering ──────────────────────────────────────────────────────────

  it('calls DOMPurify.sanitize with the html content and renders the result', () => {
    render(<ProcessHtmlStep {...defaultProps} />)
    expect(sanitizeMock).toHaveBeenCalledWith('<p>Hello world</p>')
    expect(document.querySelector('[data-qqq-id="process-html-content"]')).toBeInTheDocument()
  })

  it('resolves html from stepValues.htmlContent when html key is absent', () => {
    const props = {
      ...defaultProps,
      stepValues: { htmlContent: '<em>via htmlContent</em>' },
    }
    render(<ProcessHtmlStep {...props} />)
    expect(sanitizeMock).toHaveBeenCalledWith('<em>via htmlContent</em>')
  })

  it('resolves html from step HTML component values.html', () => {
    const step = makeStep({
      components: [
        {
          type: 'HTML',
          values: { html: '<span>from component</span>' },
        },
      ],
    })
    render(<ProcessHtmlStep {...defaultProps} step={step} stepValues={{}} />)
    expect(sanitizeMock).toHaveBeenCalledWith('<span>from component</span>')
  })

  it('resolves html from HTML-typed viewField value', () => {
    const step = makeStep({
      components: [],
      viewFields: [{ name: 'richText', label: 'Rich Text', type: 'HTML', isRequired: false, isEditable: false, isHeavy: false, isHidden: false, adornments: [] }],
    })
    render(<ProcessHtmlStep {...defaultProps} step={step} stepValues={{ richText: '<div>from viewField</div>' }} />)
    expect(sanitizeMock).toHaveBeenCalledWith('<div>from viewField</div>')
  })

  // ─── Null / undefined content ─────────────────────────────────────────────

  it('renders a "No content" message when htmlContent is null/undefined', () => {
    render(<ProcessHtmlStep {...defaultProps} stepValues={{}} />)
    expect(screen.getByText(/no content to display/i)).toBeInTheDocument()
    // DOMPurify should still be called but with empty string (memoized sanitize call)
    expect(sanitizeMock).toHaveBeenCalledWith('')
  })

  it('renders a "No content" message when html value is empty string', () => {
    render(<ProcessHtmlStep {...defaultProps} stepValues={{ html: '' }} />)
    expect(screen.getByText(/no content to display/i)).toBeInTheDocument()
  })

  // ─── Navigation buttons ───────────────────────────────────────────────────

  it('renders a Next button', () => {
    render(<ProcessHtmlStep {...defaultProps} />)
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('renders Submit label on the next button when isLastStep is true', () => {
    render(<ProcessHtmlStep {...defaultProps} isLastStep={true} />)
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('does not render a Back button when canGoBack is false', () => {
    render(<ProcessHtmlStep {...defaultProps} canGoBack={false} />)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('renders a Back button when canGoBack is true and onBack is provided', () => {
    const onBack = vi.fn()
    render(<ProcessHtmlStep {...defaultProps} canGoBack={true} onBack={onBack} />)
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  // ─── Callbacks ────────────────────────────────────────────────────────────

  it('calls onSubmit with stepValues when Next is clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ProcessHtmlStep {...defaultProps} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(onSubmit).toHaveBeenCalledWith(defaultProps.stepValues)
  })

  it('calls onBack when Back button is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<ProcessHtmlStep {...defaultProps} canGoBack={true} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('opens cancel dialog when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<ProcessHtmlStep {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    // The cancel dialog text should now appear
    expect(screen.getByText(/cancel process\?/i)).toBeInTheDocument()
  })

  // ─── Loading state ────────────────────────────────────────────────────────

  it('disables navigation buttons when isLoading is true', () => {
    render(<ProcessHtmlStep {...defaultProps} isLoading={true} />)
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  // ─── Help text ────────────────────────────────────────────────────────────

  it('renders HELP_TEXT component banners', () => {
    const step = makeStep({
      components: [
        { type: 'HELP_TEXT', values: { text: 'Read this carefully' } },
      ],
    })
    render(<ProcessHtmlStep {...defaultProps} step={step} />)
    expect(screen.getByText('Read this carefully')).toBeInTheDocument()
  })
})
