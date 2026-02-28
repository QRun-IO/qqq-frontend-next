/**
 * Accessibility tests using axe-core (via jest-axe) for key QQQ UI components.
 *
 * These tests verify that components have no detectable WCAG 2.1 violations in
 * their baseline rendered state. Color-contrast checking is disabled globally in
 * `tests/setup.ts` because jsdom cannot compute CSS-derived contrast ratios
 * accurately; contrast is validated manually during design review.
 */

import React from 'react'
import { describe, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { checkA11y } from '../helpers/axe'

// ---------------------------------------------------------------------------
// Module mocks — must come before component imports
// ---------------------------------------------------------------------------

// DOMPurify is not available in jsdom — mock it with a pass-through
vi.mock('dompurify', () => ({
  default: { sanitize: (s: string) => s },
}))

// next/link renders an <a> in tests — no-op router is provided by setup.ts
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// RecordHoverCard adds a Radix Tooltip portal which can cause noise in axe
vi.mock('@/components/records/RecordHoverCard', () => ({
  RecordHoverCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ---------------------------------------------------------------------------
// Component imports (after mocks)
// ---------------------------------------------------------------------------

import { TextField } from '@/components/forms/field-types/TextField'
import { FieldValue } from '@/components/records/FieldValue'

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** A minimal UseFormRegisterReturn compatible stub for use with TextField. */
const fakeRegistration = {
  name: 'firstName' as const,
  ref: vi.fn(),
  onChange: vi.fn(),
  onBlur: vi.fn(),
}

/** Builds a minimal QFieldMetaData fixture for FieldValue tests. */
function makeField(overrides: {
  name?: string
  label?: string
  type?: 'STRING' | 'INTEGER' | 'BOOLEAN' | 'TEXT' | 'PASSWORD'
  adornments?: []
} = {}) {
  return {
    name: overrides.name ?? 'firstName',
    label: overrides.label ?? 'First Name',
    type: overrides.type ?? 'STRING',
    isRequired: false,
    isEditable: true,
    isHeavy: false,
    isHidden: false,
    adornments: overrides.adornments ?? [],
  } as const
}

/** Builds a minimal QRecord fixture for FieldValue tests. */
function makeRecord(fieldName: string, rawValue: unknown, displayValue?: string) {
  return {
    tableName: 'person',
    recordLabel: 'Test Record',
    values: { [fieldName]: rawValue },
    displayValues: displayValue != null ? { [fieldName]: displayValue } : {},
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE 1 — TextField (simple label + input)
// ---------------------------------------------------------------------------

describe('a11y: TextField', () => {
  it('basic text input with label has no accessibility violations', async () => {
    const result = render(
      <TextField
        id="field-firstName"
        label="First Name"
        registration={fakeRegistration}
      />
    )
    await checkA11y(result)
  })

  it('required text input with asterisk indicator has no violations', async () => {
    const result = render(
      <TextField
        id="field-email"
        label="Email Address"
        registration={{ ...fakeRegistration, name: 'email' }}
        required
      />
    )
    await checkA11y(result)
  })

  it('disabled text input has no violations', async () => {
    const result = render(
      <TextField
        id="field-username"
        label="Username"
        registration={{ ...fakeRegistration, name: 'username' }}
        disabled
      />
    )
    await checkA11y(result)
  })

  it('text input with validation error has no violations', async () => {
    const result = render(
      <TextField
        id="field-name"
        label="Full Name"
        registration={{ ...fakeRegistration, name: 'name' }}
        error={{ type: 'required', message: 'Name is required' }}
      />
    )
    await checkA11y(result)
  })
})

// ---------------------------------------------------------------------------
// TEST SUITE 2 — FieldValue (read-only display)
// ---------------------------------------------------------------------------

describe('a11y: FieldValue', () => {
  beforeEach(() => {
    // Clear any mocks that may accumulate state across tests
    vi.clearAllMocks()
  })

  it('plain string field value has no violations', async () => {
    const field = makeField({ name: 'firstName', label: 'First Name', type: 'STRING' })
    const record = makeRecord('firstName', 'Alice')
    const result = render(<FieldValue field={field} record={record} />)
    await checkA11y(result)
  })

  it('empty field value (em-dash placeholder) has no violations', async () => {
    const field = makeField({ name: 'lastName', label: 'Last Name', type: 'STRING' })
    const record = makeRecord('lastName', null)
    const result = render(<FieldValue field={field} record={record} />)
    await checkA11y(result)
  })

  it('boolean field value badge has no violations', async () => {
    const field = makeField({ name: 'isActive', label: 'Active', type: 'BOOLEAN' })
    const record = makeRecord('isActive', true)
    const result = render(<FieldValue field={field} record={record} />)
    await checkA11y(result)
  })

  it('boolean false field value badge has no violations', async () => {
    const field = makeField({ name: 'isActive', label: 'Active', type: 'BOOLEAN' })
    const record = makeRecord('isActive', false)
    const result = render(<FieldValue field={field} record={record} />)
    await checkA11y(result)
  })

  it('text (multiline) field value has no violations', async () => {
    const field = makeField({ name: 'notes', label: 'Notes', type: 'TEXT' })
    const record = makeRecord('notes', 'Some multiline\ncontent here')
    const result = render(<FieldValue field={field} record={record} />)
    await checkA11y(result)
  })

  it('password field with reveal button has no violations', async () => {
    const field = makeField({ name: 'password', label: 'Password', type: 'PASSWORD' })
    const record = makeRecord('password', 'secret123')
    const result = render(<FieldValue field={field} record={record} />)
    await checkA11y(result)
  })

  it('field value with CHIP adornment badge has no violations', async () => {
    const field = {
      ...makeField({ name: 'status', label: 'Status', type: 'STRING' }),
      adornments: [{ type: 'CHIP' as const, values: { colorMap: { Active: 'green' } } }],
    }
    const record = makeRecord('status', 'Active')
    const result = render(<FieldValue field={field} record={record} />)
    await checkA11y(result)
  })
})

// ---------------------------------------------------------------------------
// TEST SUITE 3 — Compound accessible patterns
// ---------------------------------------------------------------------------

describe('a11y: Compound accessible patterns', () => {
  it('label+input pair built manually satisfies axe', async () => {
    const result = render(
      <div>
        <label htmlFor="custom-input">Search Term</label>
        <input id="custom-input" type="search" aria-label="Search records" />
      </div>
    )
    await checkA11y(result)
  })

  it('button with aria-label satisfies axe', async () => {
    const result = render(
      <button type="button" aria-label="Close dialog">
        <span aria-hidden="true">×</span>
      </button>
    )
    await checkA11y(result)
  })

  it('progressbar with required aria attributes satisfies axe', async () => {
    const result = render(
      <div
        role="progressbar"
        aria-valuenow={45}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress"
      >
        <div style={{ width: '45%' }} />
      </div>
    )
    await checkA11y(result)
  })
})
