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

/** @file The author affordance requires both mode and core-table insert permission. */
import React from 'react'

import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'

import type { QInstance } from '@/types'

import { HelpPanelProvider, useHelpPanel } from './HelpPanelProvider'

const state = vi.hoisted(() => ({ active: true }))
vi.mock('@/lib/context/q-context', () => ({ useHelpHelpActive: () => state.active }))
vi.mock('@/lib/api/ui-api-version', () => ({
  getUiApiVersion: vi.fn(async () => ({ features: [] })),
}))

/** Reads the computed author capability. @returns The capability output. */
function Probe() {
  return <output>{String(useHelpPanel().canAuthor)}</output>
}

it.each([
  [true, undefined, false],
  [true, false, false],
  [false, true, false],
  [true, true, true],
])('mode %s and insert permission %s yield authorship %s', (active, insertPermission, expected) => {
  state.active = active
  const instance = {
    tables: insertPermission === undefined ? {} : { helpContent: { insertPermission } },
  } as unknown as QInstance
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <HelpPanelProvider instance={instance}>
        <Probe />
      </HelpPanelProvider>
    </QueryClientProvider>
  )
  expect(screen.getByRole('status')).toHaveTextContent(String(expected))
})
