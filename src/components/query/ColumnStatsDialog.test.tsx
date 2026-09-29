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

/** @file Column statistics stay within the selected backend variant. */
import React from 'react'
import { expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { emptyFilter } from '@/lib/utils/filter-utils'
import { ColumnStatsDialog } from './ColumnStatsDialog'

vi.mock('@/lib/api/processes', () => ({ processInit: async (_name: string, request: { tableVariant?: string }) => {
  const variant = request.tableVariant ? JSON.parse(request.tableVariant) : null
  if (!variant) return { error: 'Missing backend variant' }
  return { values: { statsFields: [{ name: 'count', label: 'Count' }], statsRecord: { values: { count: variant.id === '1' ? 2 : 1 } }, valueCounts: [] } }
} }))

it('passes the variant to the process and separates statistics when the variant changes', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = (id: string) => <QueryClientProvider client={client}><ColumnStatsDialog tableName="stock" fieldName="sku" fieldLabel="SKU"
    filter={emptyFilter()} tableVariant={{ type: 'store', id }} onClose={() => {}} /></QueryClientProvider>
  const { rerender } = render(view('1'))
  await waitFor(() => expect(document.querySelector('[data-qqq-id="column-stats-stat-count"]')).toHaveTextContent('2'))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  rerender(view('2'))
  await waitFor(() => expect(document.querySelector('[data-qqq-id="column-stats-stat-count"]')).toHaveTextContent('1'))
})
