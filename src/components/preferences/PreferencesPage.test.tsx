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

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import { server } from '@/mocks/node'
import { ThemeProvider } from '@/lib/theme/theme-provider'
import { PreferencesPage } from './PreferencesPage'

const state = vi.hoisted(() => ({
  search: '',
  wide: true,
  replace: vi.fn(),
  setPageHeader: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => new URLSearchParams(state.search),
}))
vi.mock('@/lib/context/q-context', () => ({
  useQContext: () => ({ setPageHeader: state.setPageHeader }),
}))
vi.mock('@/lib/hooks/use-media-query', () => ({ useMediaQuery: () => state.wide }))
beforeEach(() => {
  state.search = ''
  state.wide = true
  vi.clearAllMocks()
})

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ThemeProvider>
        <PreferencesPage />
      </ThemeProvider>
    </QueryClientProvider>
  )

it('lists Display first, then every registered section with descriptions, and navigates via URL', async () => {
  const { container } = renderPage()
  await screen.findByRole('button', { name: /Regional settings/ })
  const nav = screen.getByRole('navigation', { name: 'Preference sections' })
  expect(nav.querySelectorAll('button')[0]).toHaveTextContent('Display')
  expect(screen.getByText('Saved on this device', { exact: true })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Notifications What reaches/ })).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: /Regional settings/ }))
  expect(state.replace).toHaveBeenCalledWith('/app/preferences?section=regional', { scroll: false })
  expect(await axe(container)).toHaveNoViolations()
})

it('opens a deep-linked section and renders a compact select on narrow screens', async () => {
  state.search = 'section=regional'
  state.wide = false
  renderPage()
  await screen.findByRole('heading', { name: 'Regional settings' })
  expect(screen.getByRole('combobox', { name: 'Section' })).toHaveValue('regional')
  expect(screen.getByRole('option', { name: 'Display' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Week starts on' })).toHaveValue('SUNDAY')
  await userEvent
    .setup()
    .selectOptions(screen.getByRole('combobox', { name: 'Section' }), '__display')
  expect(state.replace).toHaveBeenCalledWith('/app/preferences', { scroll: false })
})

it('explains an unavailable deep link', async () => {
  state.search = 'section=missing'
  renderPage()
  await screen.findByText('This preference section is not available.')
})

it('keeps Display available when there are no provider sections', async () => {
  server.use(http.get('/qqq/v1/preferences', () => HttpResponse.json({ sections: [] })))
  renderPage()
  await screen.findByText('No additional preferences are available.')
  expect(screen.getByRole('heading', { name: 'Display' })).toBeInTheDocument()
})

it('offers retry on errors and keeps local display settings accessible', async () => {
  server.use(
    http.get('/qqq/v1/preferences', () =>
      HttpResponse.json({ error: 'Unavailable' }, { status: 503 })
    )
  )
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load preferences.')
  expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument()
  server.use(http.get('/qqq/v1/preferences', () => HttpResponse.json({ sections: [] })))
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
})
