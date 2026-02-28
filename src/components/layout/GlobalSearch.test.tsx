// Tests for GlobalSearch component

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import type { GlobalSearchResult } from '@/lib/api/tables'

// Override next/navigation for this test file — we need per-test control of push
const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

import { GlobalSearch } from './GlobalSearch'

const BASE = '/qqq/v1'

// ─── Provider helper ──────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function createWrapper() {
  const queryClient = makeQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function renderSearch(props = {}) {
  return render(<GlobalSearch {...props} />, { wrapper: createWrapper() })
}

// ─── Test data ────────────────────────────────────────────────────────────────

const mockResults: GlobalSearchResult[] = [
  { tableName: 'person', tableLabel: 'People', recordId: '1', recordLabel: 'Alice Smith' },
  { tableName: 'person', tableLabel: 'People', recordId: '2', recordLabel: 'Alice Jones' },
]

// ─── Helper: type + advance debounce ─────────────────────────────────────────
// The component debounces search by 300 ms. We use fake timers to advance past
// the debounce without waiting in real time.

async function typeAndDebounce(
  user: ReturnType<typeof userEvent.setup>,
  element: Element,
  text: string
) {
  await user.type(element, text)
  // Advance the 300 ms debounce timer
  await act(() => {
    vi.advanceTimersByTime(350)
  })
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    pushMock.mockReset()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Initial render ───────────────────────────────────────────────────────

  it('renders the search input', () => {
    renderSearch()
    expect(screen.getByRole('combobox', { name: /search records/i })).toBeInTheDocument()
  })

  it('input starts empty', () => {
    renderSearch()
    expect(screen.getByRole('combobox', { name: /search records/i })).toHaveValue('')
  })

  it('accepts typed text', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearch()
    const input = screen.getByRole('combobox', { name: /search records/i })
    await user.type(input, 'hello')
    expect(input).toHaveValue('hello')
  })

  // ─── Dropdown appearance ──────────────────────────────────────────────────

  it('does not show dropdown on first render', () => {
    renderSearch()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows a dropdown after typing 2+ characters', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    server.use(
      http.post(`${BASE}/search`, () => HttpResponse.json(mockResults))
    )

    renderSearch()
    const input = screen.getByRole('combobox', { name: /search records/i })
    await typeAndDebounce(user, input, 'Al')

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
  })

  it('shows search results after debounce', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    server.use(
      http.post(`${BASE}/search`, () => HttpResponse.json(mockResults))
    )

    renderSearch()
    const input = screen.getByRole('combobox', { name: /search records/i })
    await typeAndDebounce(user, input, 'Al')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /alice smith/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: /alice jones/i })).toBeInTheDocument()
  })

  // ─── Error state ──────────────────────────────────────────────────────────

  it('shows "Search unavailable" message when query errors', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    server.use(
      http.post(`${BASE}/search`, () => HttpResponse.json({ error: 'internal' }, { status: 500 }))
    )

    renderSearch()
    const input = screen.getByRole('combobox', { name: /search records/i })
    await typeAndDebounce(user, input, 'fail')

    await waitFor(() => {
      expect(screen.getByText(/search unavailable/i)).toBeInTheDocument()
    })
  })

  // ─── Navigation ───────────────────────────────────────────────────────────

  it('calls router.push when a result item is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    server.use(
      http.post(`${BASE}/search`, () => HttpResponse.json(mockResults))
    )

    renderSearch()
    const input = screen.getByRole('combobox', { name: /search records/i })
    await typeAndDebounce(user, input, 'Al')

    await waitFor(() => screen.getByRole('option', { name: /alice smith/i }))

    await user.click(screen.getByRole('option', { name: /alice smith/i }))

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining('/app/person/1')
    )
  })

  it('closes the dropdown after navigating to a result', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    server.use(
      http.post(`${BASE}/search`, () => HttpResponse.json(mockResults))
    )

    renderSearch()
    const input = screen.getByRole('combobox', { name: /search records/i })
    await typeAndDebounce(user, input, 'Al')

    await waitFor(() => screen.getByRole('option', { name: /alice smith/i }))
    await user.click(screen.getByRole('option', { name: /alice smith/i }))

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  // ─── Click-outside close ──────────────────────────────────────────────────

  it('closes the dropdown when clicking outside the component', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    server.use(
      http.post(`${BASE}/search`, () => HttpResponse.json(mockResults))
    )

    render(
      <div>
        <GlobalSearch />
        <div data-testid="outside-area">Outside area</div>
      </div>,
      { wrapper: createWrapper() }
    )

    const input = screen.getByRole('combobox', { name: /search records/i })
    await typeAndDebounce(user, input, 'Al')

    await waitFor(() => screen.getByRole('listbox'))

    // Click somewhere outside the search component
    await user.click(screen.getByTestId('outside-area'))

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  // ─── Focus restoration ────────────────────────────────────────────────────

  it('closes the dropdown and input remains in DOM when clicking a non-focusable area', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    server.use(
      http.post(`${BASE}/search`, () => HttpResponse.json(mockResults))
    )

    render(
      <div>
        <GlobalSearch />
        <div data-testid="outside-area">Outside area</div>
      </div>,
      { wrapper: createWrapper() }
    )

    const input = screen.getByRole('combobox', { name: /search records/i })
    await typeAndDebounce(user, input, 'Al')
    await waitFor(() => screen.getByRole('listbox'))

    // Click on a non-focusable element — dropdown should close
    await user.click(screen.getByTestId('outside-area'))

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
    // Input should still be in the document after close
    expect(screen.getByRole('combobox', { name: /search records/i })).toBeInTheDocument()
  })

  // ─── Keyboard navigation ──────────────────────────────────────────────────

  it('closes dropdown on Escape key', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    server.use(
      http.post(`${BASE}/search`, () => HttpResponse.json(mockResults))
    )

    renderSearch()
    const input = screen.getByRole('combobox', { name: /search records/i })
    await typeAndDebounce(user, input, 'Al')

    await waitFor(() => screen.getByRole('listbox'))

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('navigates to search page when Enter is pressed with text but no selection', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    server.use(
      http.post(`${BASE}/search`, () => HttpResponse.json([]))
    )

    renderSearch()
    const input = screen.getByRole('combobox', { name: /search records/i })
    await typeAndDebounce(user, input, 'he')

    // Dropdown is open (even if empty — the empty state shows)
    await waitFor(() => screen.getByRole('listbox'))

    await user.keyboard('{Enter}')

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining('/app/search?q=he')
    )
  })

  // ─── data-qqq-id ─────────────────────────────────────────────────────────

  it('container has data-qqq-id="header-search"', () => {
    renderSearch()
    expect(document.querySelector('[data-qqq-id="header-search"]')).toBeInTheDocument()
  })
})
