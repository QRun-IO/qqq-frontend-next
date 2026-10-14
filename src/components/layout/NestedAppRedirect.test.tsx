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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { qInstance } from '@/mocks/fixtures/q-instance'
import { queryKeys } from '@/lib/query-client'
import Layout from '@/app/(dashboard)/app/[slug]/layout'
import NotFound from '@/app/not-found'

const navigation = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => navigation,
}))
vi.mock('@/lib/auth/use-auth', () => ({ useAuth: () => ({ isAuthenticated: true }) }))
vi.mock('@/components/layout/LegacyPathRedirect', () => ({ LegacyPathRedirect: ({ children }: { children: React.ReactNode }) => children }))

function renderRoute(path: string, notFound = false, collision = false) {
  window.history.replaceState(null, '', path)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(queryKeys.metadataAll(), {
    ...qInstance,
    apps: { ...qInstance.apps, parent: { name: 'parent', label: 'Parent' } },
    tables: collision ? { ...qInstance.tables, parent: qInstance.tables.person } : qInstance.tables,
  })
  return render(<QueryClientProvider client={client}>
    {notFound ? <NotFound /> : <Layout><div>Original route content</div></Layout>}
  </QueryClientProvider>)
}

describe('nested URL route resolution', () => {
  beforeEach(() => navigation.replace.mockClear())

  it.each(['', '/42', '/42/edit', '/create'])('replaces a nested table URL with suffix %s', async (suffix) => {
    renderRoute(`/app/parent/person${suffix}?filter=a%20b&tag=1&tag=2`)
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(`/app/person${suffix}/?filter=a%20b&tag=1&tag=2`))
    expect(screen.queryByText('Original route content')).not.toBeInTheDocument()
  })

  it('recovers a deeper nested URL served by the static 404 fallback', async () => {
    renderRoute('/app/parent/person/42/edit?tab=details', true)
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/app/person/42/edit/?tab=details'))
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument()
  })

  it.each([false, true])('leaves unknown names or app/table collisions to the original route (%s)', (collision) => {
    renderRoute(collision ? '/app/parent/person' : '/app/parent/unknown', false, collision)
    expect(screen.getByText('Original route content')).toBeVisible()
    expect(navigation.replace).not.toHaveBeenCalled()
  })
})
