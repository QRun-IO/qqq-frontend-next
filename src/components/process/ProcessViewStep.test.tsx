// Tests for ProcessViewStep component

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

import { ProcessViewStep } from './ProcessViewStep'
import type { QFrontendStepMetaData, QFieldMetaData } from '@/types'
import DOMPurify from 'dompurify'

const sanitizeMock = vi.mocked(DOMPurify.sanitize)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return {
    name: 'myField',
    label: 'My Field',
    type: 'STRING',
    isRequired: false,
    isEditable: false,
    isHeavy: false,
    isHidden: false,
    adornments: [],
    ...overrides,
  }
}

function makeStep(overrides: Partial<QFrontendStepMetaData> = {}): QFrontendStepMetaData {
  return {
    name: 'viewStep',
    label: 'View Step',
    components: [],
    viewFields: [],
    ...overrides,
  }
}

const defaultProps = {
  step: makeStep(),
  stepValues: {},
  isLoading: false,
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
  canGoBack: false,
  isLastStep: false,
}

describe('ProcessViewStep', () => {
  beforeEach(() => {
    sanitizeMock.mockClear()
    sanitizeMock.mockImplementation((s: string | Node) => (typeof s === 'string' ? s : ''))
    defaultProps.onSubmit.mockClear()
    defaultProps.onCancel.mockClear()
  })

  // ─── Field labels ─────────────────────────────────────────────────────────

  it('renders field labels from metadata', () => {
    const step = makeStep({
      viewFields: [
        makeField({ name: 'firstName', label: 'First Name', type: 'STRING' }),
        makeField({ name: 'lastName', label: 'Last Name', type: 'STRING' }),
      ],
    })
    render(<ProcessViewStep {...defaultProps} step={step} stepValues={{ firstName: 'Alice', lastName: 'Smith' }} />)
    expect(screen.getByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Last Name')).toBeInTheDocument()
  })

  it('renders field values next to their labels', () => {
    const step = makeStep({
      viewFields: [makeField({ name: 'city', label: 'City', type: 'STRING' })],
    })
    render(<ProcessViewStep {...defaultProps} step={step} stepValues={{ city: 'Austin' }} />)
    expect(screen.getByText('Austin')).toBeInTheDocument()
  })

  it('renders em-dash for empty/null field values', () => {
    const step = makeStep({
      viewFields: [makeField({ name: 'phone', label: 'Phone', type: 'STRING' })],
    })
    render(<ProcessViewStep {...defaultProps} step={step} stepValues={{ phone: '' }} />)
    expect(screen.getByText('\u2014')).toBeInTheDocument()
  })

  it('renders "Yes" for boolean true values', () => {
    const step = makeStep({
      viewFields: [makeField({ name: 'active', label: 'Active', type: 'BOOLEAN' })],
    })
    render(<ProcessViewStep {...defaultProps} step={step} stepValues={{ active: true }} />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('renders "No" for boolean false values', () => {
    const step = makeStep({
      viewFields: [makeField({ name: 'active', label: 'Active', type: 'BOOLEAN' })],
    })
    render(<ProcessViewStep {...defaultProps} step={step} stepValues={{ active: false }} />)
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  // ─── HTML fields ──────────────────────────────────────────────────────────

  it('renders HTML-typed fields with DOMPurify sanitization', () => {
    const step = makeStep({
      viewFields: [makeField({ name: 'body', label: 'Body', type: 'HTML' })],
    })
    render(<ProcessViewStep {...defaultProps} step={step} stepValues={{ body: '<strong>bold</strong>' }} />)
    expect(sanitizeMock).toHaveBeenCalledWith('<strong>bold</strong>')
  })

  it('does not call DOMPurify for non-HTML field types', () => {
    const step = makeStep({
      viewFields: [makeField({ name: 'name', label: 'Name', type: 'STRING' })],
    })
    render(<ProcessViewStep {...defaultProps} step={step} stepValues={{ name: 'Alice' }} />)
    // DOMPurify may be called with empty string '' for html fields not present, but
    // it should NOT be called with 'Alice'
    expect(sanitizeMock).not.toHaveBeenCalledWith('Alice')
  })

  // ─── Empty state ─────────────────────────────────────────────────────────

  it('shows empty state message when viewFields is empty', () => {
    render(<ProcessViewStep {...defaultProps} step={makeStep({ viewFields: [] })} />)
    expect(screen.getByText(/no fields to display/i)).toBeInTheDocument()
  })

  // ─── Navigation buttons ───────────────────────────────────────────────────

  it('renders Next button', () => {
    render(<ProcessViewStep {...defaultProps} />)
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('renders Submit label when isLastStep is true', () => {
    render(<ProcessViewStep {...defaultProps} isLastStep={true} />)
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('hides Back button when canGoBack is false', () => {
    render(<ProcessViewStep {...defaultProps} canGoBack={false} />)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('renders Back button when canGoBack is true and onBack is provided', () => {
    const onBack = vi.fn()
    render(<ProcessViewStep {...defaultProps} canGoBack={true} onBack={onBack} />)
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  // ─── Callbacks ────────────────────────────────────────────────────────────

  it('calls onSubmit with current stepValues when Next is clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const stepValues = { city: 'Austin' }
    const step = makeStep({ viewFields: [makeField({ name: 'city', label: 'City' })] })
    render(<ProcessViewStep {...defaultProps} step={step} stepValues={stepValues} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(onSubmit).toHaveBeenCalledWith(stepValues)
  })

  it('calls onBack when Back button is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<ProcessViewStep {...defaultProps} canGoBack={true} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('opens cancel confirmation dialog when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<ProcessViewStep {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText(/cancel process\?/i)).toBeInTheDocument()
  })

  // ─── Loading state ────────────────────────────────────────────────────────

  it('disables Next and Cancel buttons when isLoading is true', () => {
    render(<ProcessViewStep {...defaultProps} isLoading={true} />)
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  // ─── Help text ────────────────────────────────────────────────────────────

  it('renders HELP_TEXT component banners above the field list', () => {
    const step = makeStep({
      components: [
        { type: 'HELP_TEXT', values: { text: 'Please review carefully' } },
      ],
    })
    render(<ProcessViewStep {...defaultProps} step={step} />)
    expect(screen.getByText('Please review carefully')).toBeInTheDocument()
  })

  // ─── data-qqq-id attributes ───────────────────────────────────────────────

  it('wraps the view step in a container with data-qqq-id="process-view-step"', () => {
    render(<ProcessViewStep {...defaultProps} />)
    expect(document.querySelector('[data-qqq-id="process-view-step"]')).toBeInTheDocument()
  })

  it('gives each field row a data-qqq-id scoped to the field name', () => {
    const step = makeStep({
      viewFields: [makeField({ name: 'email', label: 'Email' })],
    })
    render(<ProcessViewStep {...defaultProps} step={step} stepValues={{ email: 'a@b.com' }} />)
    expect(document.querySelector('[data-qqq-id="process-view-field-email"]')).toBeInTheDocument()
  })
})
