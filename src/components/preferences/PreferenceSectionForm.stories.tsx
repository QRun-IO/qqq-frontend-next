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

/** @file Interactive provider actions, backed by the same development MSW handlers. */
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { preferencesFixture } from '@/mocks/fixtures/preferences'
import { resetPreferencesMock } from '@/mocks/handlers/preferences'
import { PreferenceSectionForm } from './PreferenceSectionForm'

function Example({ width = 1000 }: { width?: number }) {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <div style={{ width, maxWidth: '100%' }} className="p-6">
        <PreferenceSectionForm
          section={structuredClone(
            preferencesFixture.sections.find((section) => section.name === 'access-tokens')!
          )}
        />
      </div>
      <Toaster />
    </QueryClientProvider>
  )
}
const meta = {
  title: 'Preferences/Access tokens',
  component: Example,
  parameters: { layout: 'fullscreen' },
  loaders: [
    async () => {
      const { worker } = await import('@/mocks/browser')
      await worker.start({ quiet: true, onUnhandledRequest: 'bypass' })
      resetPreferencesMock()
      return {}
    },
  ],
} satisfies Meta<typeof Example>
export default meta
type Story = StoryObj<typeof meta>
export const Table: Story = { args: { width: 1000 } }
export const Cards: Story = { args: { width: 400 } }
