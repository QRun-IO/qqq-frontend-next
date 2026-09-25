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

// Tests for PossibleValueSelect component

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useForm } from 'react-hook-form'

import { PossibleValueSelect } from './PossibleValueSelect'
import type { QPossibleValue } from '@/types'

// Mock the API modules so we control option loading
vi.mock('@/lib/api/possible-values', () => ({
  fetchTablePossibleValues: vi.fn(),
  fetchProcessPossibleValues: vi.fn(),
  fetchPossibleValues: vi.fn(),
}))

import {
  fetchTablePossibleValues,
  fetchProcessPossibleValues,
  fetchPossibleValues,
} from '@/lib/api/possible-values'

const mockFetchTable = vi.mocked(fetchTablePossibleValues)
const mockFetchProcess = vi.mocked(fetchProcessPossibleValues)
const mockFetchStandalone = vi.mocked(fetchPossibleValues)

const OPTIONS: QPossibleValue[] = [
  { id: 1, label: 'Alice' },
  { id: 2, label: 'Bob' },
  { id: 3, label: 'Charlie' },
]

/**
 * Test harness: wraps PossibleValueSelect in a React Hook Form context
 * so the Controller can attach to a real form.
 */
function Wrapper({
  context = { type: 'table' as const, tableName: 'person' },
  defaultValue,
  required = false,
  disabled = false,
}: {
  context?: { type: 'table'; tableName: string } | { type: 'process'; processName: string } | { type: 'standalone' }
  defaultValue?: unknown
  required?: boolean
  disabled?: boolean
}) {
  const { control } = useForm<Record<string, unknown>>({
    defaultValues: { testField: defaultValue ?? null },
  })

  return (
    <PossibleValueSelect
      id="test-pvs"
      label="Person"
      name="testField"
      control={control}
      fieldName="person"
      context={context}
      required={required}
      disabled={disabled}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchTable.mockResolvedValue(OPTIONS)
  mockFetchProcess.mockResolvedValue(OPTIONS)
  mockFetchStandalone.mockResolvedValue(OPTIONS)
})

describe('PossibleValueSelect — initial value label', () => {
  it('looks up and shows the label of a value it did not select (e.g. after process Back)', async () => {
    mockFetchProcess.mockResolvedValue([{ id: 2, label: 'Bob' }])
    render(<Wrapper context={{ type: 'process', processName: 'prcWizard' }} defaultValue={2} />)
    expect(await screen.findByText('Bob')).toBeInTheDocument()
    expect(mockFetchProcess).toHaveBeenCalledWith('prcWizard', 'person', { ids: '2' })
    expect(screen.getByRole('combobox', { name: 'Person' })).not.toHaveTextContent(/^2$/)
  })
})

describe('PossibleValueSelect — rendering', () => {
  it('renders the label', () => {
    render(<Wrapper />)
    expect(screen.getByText('Person')).toBeInTheDocument()
  })

  it('names the combobox from its field label', () => {
    render(<Wrapper />)
    expect(screen.getByRole('combobox', { name: 'Person' })).toBeInTheDocument()
  })

  it('shows default placeholder when no value is selected', () => {
    render(<Wrapper />)
    expect(screen.getByText(/-- Select Person --/i)).toBeInTheDocument()
  })

  it('shows asterisk when required=true', () => {
    render(<Wrapper required={true} />)
    // The asterisk span is aria-hidden but still present in DOM
    const label = screen.getByText('Person').closest('label')
    expect(label?.textContent).toContain('*')
  })

  it('does not show asterisk when required=false', () => {
    render(<Wrapper required={false} />)
    const label = screen.getByText('Person').closest('label')
    expect(label?.textContent).not.toContain('*')
  })

  it('has aria-required on the combobox when required=true', () => {
    render(<Wrapper required={true} />)
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-required', 'true')
  })

  it('combobox is visually dimmed / has opacity style when disabled=true', () => {
    render(<Wrapper disabled={true} />)
    const combobox = screen.getByRole('combobox')
    // The disabled class includes "opacity-50"
    expect(combobox.className).toContain('opacity-50')
  })
})

describe('PossibleValueSelect — open / close', () => {
  it('starts closed (dropdown not visible)', () => {
    render(<Wrapper />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens dropdown when combobox trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
  })

  it('sets aria-expanded=true when open', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true')
    })
  })

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <Wrapper />
        <div data-testid="outside">Outside</div>
      </div>
    )

    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    await user.click(screen.getByTestId('outside'))
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })

  it('does not open when disabled=true', async () => {
    const user = userEvent.setup()
    render(<Wrapper disabled={true} />)

    await user.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('PossibleValueSelect — loading state', () => {
  it('shows loading indicator while fetching', async () => {
    const user = userEvent.setup()
    // Never resolves — stays loading
    mockFetchTable.mockImplementation(() => new Promise(() => {}))

    render(<Wrapper />)
    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })
  })

  it('calls fetchTablePossibleValues for table context', async () => {
    const user = userEvent.setup()
    render(<Wrapper context={{ type: 'table', tableName: 'person' }} />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(mockFetchTable).toHaveBeenCalledWith('person', 'person', expect.any(Object))
    })
  })

  it('calls fetchProcessPossibleValues for process context', async () => {
    const user = userEvent.setup()
    render(<Wrapper context={{ type: 'process', processName: 'myProcess' }} />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(mockFetchProcess).toHaveBeenCalledWith('myProcess', 'person', expect.any(Object))
    })
  })

  it('calls fetchPossibleValues for standalone context', async () => {
    const user = userEvent.setup()
    render(<Wrapper context={{ type: 'standalone' }} />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(mockFetchStandalone).toHaveBeenCalledWith('person', expect.any(Object))
    })
  })
})

describe('PossibleValueSelect — options list', () => {
  it('renders options as listbox items after loading', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(OPTIONS.length)
    })
  })

  it('shows option labels', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
    })
  })

  it('shows "No options found" when the fetch returns empty array', async () => {
    const user = userEvent.setup()
    mockFetchTable.mockResolvedValue([])

    render(<Wrapper />)
    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByText(/no options found/i)).toBeInTheDocument()
    })
  })
})

describe('PossibleValueSelect — option selection', () => {
  it('closes dropdown and shows selected label after clicking an option', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))

    await user.click(screen.getByText('Alice'))

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
  })

  it('marks selected option as aria-selected=true', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))

    await user.click(screen.getByText('Bob'))

    // Re-open to check aria-selected
    await user.click(screen.getByRole('combobox'))
    await waitFor(() => {
      const bobOption = screen.getByRole('option', { name: /bob/i })
      expect(bobOption).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('shows a clear button once a value is selected', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))
    await user.click(screen.getByText('Alice'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear person/i })).toBeInTheDocument()
    })
  })

  it('clears the selected value when the clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))
    await user.click(screen.getByText('Alice'))
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /clear person/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /clear person/i })).not.toBeInTheDocument()
      expect(screen.getByText(/-- Select Person --/i)).toBeInTheDocument()
    })
  })
})

describe('PossibleValueSelect — search', () => {
  it('renders a search input when the dropdown is open', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /search person options/i })).toBeInTheDocument()
    })
  })

  it('triggers a fetch with the search term after typing in the search input', async () => {
    // Use real timers — just wait for the 300ms debounce to fire naturally.
    // This avoids the interaction issues between vi.useFakeTimers and userEvent.
    const user = userEvent.setup()

    render(<Wrapper />)
    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument())

    const searchInput = screen.getByRole('textbox', { name: /search/i })
    await user.type(searchInput, 'Al')

    await waitFor(
      () => {
        // Should have been called with the search term after the debounce fires
        expect(mockFetchTable).toHaveBeenCalledWith('person', 'person', { searchTerm: 'Al' })
      },
      { timeout: 2000 }
    )
  }, 10000)
})

describe('PossibleValueSelect — error state', () => {
  it.each(['success', 'failure'])('keeps newer search results after an older request settles with %s', async (outcome) => {
    const user = userEvent.setup()
    let resolveOld!: (values: QPossibleValue[]) => void
    let rejectOld!: (error: Error) => void
    const older = new Promise<QPossibleValue[]>((resolve, reject) => { resolveOld = resolve; rejectOld = reject })
    mockFetchTable.mockReturnValueOnce(older).mockResolvedValueOnce([{ id: 2, label: 'Bob' }])
    render(<Wrapper />)
    await user.click(screen.getByRole('combobox', { name: 'Person' }))
    await user.type(screen.getByRole('textbox', { name: 'Search Person options' }), 'Bo')
    expect(await screen.findByRole('option', { name: 'Bob' })).toBeVisible()
    await act(async () => {
      if (outcome === 'success') resolveOld([{ id: 1, label: 'Alice' }])
      else rejectOld(new Error('Older request failed'))
    })
    expect(screen.getByRole('option', { name: 'Bob' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Alice' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockFetchTable).toHaveBeenLastCalledWith('person', 'person', { searchTerm: 'Bo' })
  })

  it('distinguishes a failed request from empty choices and retries on reopen', async () => {
    const user = userEvent.setup()
    mockFetchTable.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce(OPTIONS)
    render(<Wrapper />)
    await user.click(screen.getByRole('combobox', { name: 'Person' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Options could not be loaded.')
    expect(screen.queryByText('No options found')).not.toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Person' }))
    await user.click(screen.getByRole('combobox', { name: 'Person' }))
    expect(await screen.findByRole('option', { name: 'Alice' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })


  it('renders error message when error prop is provided', () => {
    const { control } = (() => {
      let capturedControl: ReturnType<typeof useForm<Record<string, unknown>>>['control'] | undefined
      function Inner() {
        const form = useForm<Record<string, unknown>>()
        capturedControl = form.control
        return null
      }
      render(<Inner />)
      return { control: capturedControl! }
    })()

    const error = { type: 'required', message: 'This field is required' }

    render(
      <PossibleValueSelect
        id="err-pvs"
        label="Person"
        name="testField"
        control={control}
        fieldName="person"
        context={{ type: 'table', tableName: 'person' }}
        error={error}
      />
    )

    expect(screen.getByText('This field is required')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('sets aria-invalid on combobox when error is present', () => {
    const { control } = (() => {
      let capturedControl: ReturnType<typeof useForm<Record<string, unknown>>>['control'] | undefined
      function Inner() {
        const form = useForm<Record<string, unknown>>()
        capturedControl = form.control
        return null
      }
      render(<Inner />)
      return { control: capturedControl! }
    })()

    const error = { type: 'required', message: 'Required' }

    render(
      <PossibleValueSelect
        id="err-pvs2"
        label="Person"
        name="testField"
        control={control}
        fieldName="person"
        context={{ type: 'table', tableName: 'person' }}
        error={error}
      />
    )

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true')
  })
})
