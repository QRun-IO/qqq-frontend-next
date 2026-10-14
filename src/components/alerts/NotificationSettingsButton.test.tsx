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

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import { server } from '@/mocks/node'
import { NotificationSettingsButton } from './NotificationSettingsButton'
import AlertsBellPopover from './AlertsBellPopover'
import { AlertsBell } from './AlertsBell'
import type { QInstance } from '@/types/metadata'

// The drawer and form are lazy chunks; give the first import time on a busy runner.
vi.setConfig({ testTimeout: 15_000 })

const summary = {
  unreadCount: 0,
  highestUnreadSeverity: null,
  notificationsHref: '/app/notifications',
  preferencesSection: 'notifications',
  pollSeconds: 60,
  items: [],
  banners: [],
}
const renderQuery = (element: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {element}
    </QueryClientProvider>
  )

it('does not fetch preferences or show a gear without a summary section', () => {
  const request = vi.fn()
  server.use(
    http.get('/qqq/v1/preferences', () => {
      request()
      return HttpResponse.json({ sections: [] })
    })
  )
  renderQuery(<NotificationSettingsButton />)
  expect(screen.queryByRole('button', { name: 'Notification settings' })).not.toBeInTheDocument()
  expect(request).not.toHaveBeenCalled()
})

it('hides the gear when the advertised section is absent', async () => {
  const request = vi.fn()
  server.use(
    http.get('/qqq/v1/preferences', () => {
      request()
      return HttpResponse.json({ sections: [] })
    })
  )
  renderQuery(<NotificationSettingsButton sectionName="notifications" />)
  await waitFor(() => expect(request).toHaveBeenCalled())
  expect(screen.queryByRole('button', { name: 'Notification settings' })).not.toBeInTheDocument()
})

it('opens an accessible drawer, traps focus, links to all preferences and returns focus to its gear', async () => {
  renderQuery(<NotificationSettingsButton sectionName="notifications" />)
  const user = userEvent.setup()
  const gear = await screen.findByRole('button', { name: 'Notification settings' })
  await user.click(gear)
  const drawer = await screen.findByRole('dialog', { name: 'Notifications' }, { timeout: 5000 })
  await within(drawer).findByRole('checkbox', { name: 'Email alerts' })
  const manage = within(drawer).getByRole('link', { name: 'Manage all preferences' })
  expect(manage).toHaveAttribute('href', '/app/preferences?section=notifications')
  manage.focus()
  await user.tab()
  expect(within(drawer).getByRole('button', { name: 'Close settings' })).toHaveFocus()
  expect(await axe(drawer)).toHaveNoViolations()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(gear).toHaveFocus())
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('closes the popover before showing the drawer and restores its gear on close', async () => {
  renderQuery(<AlertsBellPopover summary={summary} onClose={vi.fn()} />)
  const user = userEvent.setup()
  const gear = await screen.findByRole('button', { name: 'Notification settings' })
  await user.click(gear)
  await waitFor(() =>
    expect(document.querySelector('[data-qqq-id="alerts-popover"]')).not.toBeVisible()
  )
  const drawer = await screen.findByRole('dialog', { name: 'Notifications' }, { timeout: 5000 })
  await within(drawer).findByRole('checkbox', { name: 'Email alerts' })
  await user.click(within(drawer).getByRole('button', { name: 'Close settings' }))
  await waitFor(() => expect(gear).toHaveFocus())
  expect(document.querySelector('[data-qqq-id="alerts-popover"]')).toBeVisible()
})

it('fetches preferences lazily when the bell popover opens', async () => {
  const request = vi.fn()
  server.use(
    http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(summary)),
    http.get('/qqq/v1/preferences', () => {
      request()
      return HttpResponse.json({ sections: [] })
    })
  )
  renderQuery(
    <AlertsBell metaData={{ apps: { alerts: { name: 'alerts' } } } as unknown as QInstance} />
  )
  const bell = await screen.findByRole('button', { name: 'Notifications, none unread' })
  expect(request).not.toHaveBeenCalled()
  await userEvent.setup().click(bell)
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
})
