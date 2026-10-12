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

// Tests for the /app home page: Next's overview, or the instance's home app (QRun-IO/qqq#1059)

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
  useRouter: () => ({ push: vi.fn(), replace }),
}))
vi.mock('@/lib/context/q-context', () => ({ useQContext: () => ({ setPageHeader: vi.fn() }) }))
vi.mock('@/lib/auth/use-auth', () => ({ useAuth: () => ({ user: { name: 'Avery Example' } }) }))
const metaData = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('@/lib/api/metadata', () => ({ loadMetaData: vi.fn(async () => metaData.value) }))

import DashboardPage from './page'

/**
 * Instance metadata with two apps, optionally designating a home app.
 *
 * @param homeAppName - The home app.
 * @returns The metadata.
 */
function instance(homeAppName?: string): Record<string, unknown> {
  return {
    apps: { home: { name: 'home', label: 'Home' }, cms: { name: 'cms', label: 'CMS' } },
    appTree: [{ name: 'home', label: 'Home', type: 'APP', children: [] }, { name: 'cms', label: 'CMS', type: 'APP', children: [] }],
    tables: {}, processes: {}, reports: {}, widgets: {},
    ...(homeAppName ? { homeAppName } : {}),
  }
}

/** Renders the page with a fresh query client. */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><DashboardPage /></QueryClientProvider>)
}

beforeEach(() => {
  replace.mockReset()
})

describe('/app home page', () => {
  it('shows the overview when the instance designates no home app', async () => {
    metaData.value = instance()
    renderPage()
    await waitFor(() => expect(screen.getByText('CMS')).toBeInTheDocument())
    expect(document.querySelector('[data-qqq-id="dashboard-home"]')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('goes to the home app dashboard instead of the overview when the instance designates one', async () => {
    metaData.value = instance('home')
    renderPage()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/app/home'))
    expect(document.querySelector('[data-qqq-id="dashboard-home"]')).not.toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="dashboard-home-redirect"]')).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps the overview when the designated home app is not one the user may open', async () => {
    metaData.value = { ...instance(), homeAppName: 'secret' }
    renderPage()
    await waitFor(() => expect(screen.getByText('CMS')).toBeInTheDocument())
    expect(replace).not.toHaveBeenCalled()
  })
})
