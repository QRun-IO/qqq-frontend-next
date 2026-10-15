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

import { fireEvent, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/mocks/node'
import { avatarSizeFor, clearAvatarCache, isAvatarMiss, lookupAvatarUrl, versionedAvatarUrl } from '@/lib/api/avatars'
import { initialsOf, UserAvatar } from './UserAvatar'

const profile = vi.hoisted(() => ({ installed: false }))
vi.mock('@/lib/hooks/use-my-profile', () => ({ useMyProfile: () => profile }))

const AVERY = '/qqq/v1/avatars/0123456789abcdef0123456789abcdef?v=k1'

const renderAvatar = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

/** Answers lookups from a fixed map and records each call's ids. */
function mockLookup(avatars: Record<string, string>): string[][] {
  const calls: string[][] = []
  server.use(
    http.post('/qqq/v1/avatars/lookup', async ({ request }) => {
      const { userIds } = (await request.json()) as { userIds: string[] }
      calls.push(userIds)
      return HttpResponse.json({ avatars: Object.fromEntries(userIds.filter((id) => avatars[id]).map((id) => [id, avatars[id]])) })
    })
  )
  return calls
}

beforeEach(() => {
  profile.installed = false
  clearAvatarCache()
})

describe('initialsOf', () => {
  it('takes the first and last word, ignoring an email domain', () => {
    expect(initialsOf('Avery Quinn')).toBe('AQ')
    expect(initialsOf('Mary Ann de la Cruz')).toBe('MC')
    expect(initialsOf('ann@example.com')).toBe('A')
    expect(initialsOf('first.last@example.com')).toBe('FL')
    expect(initialsOf(undefined)).toBe('?')
  })
})

describe('avatar URLs', () => {
  it('picks a sharp server size and resolves server URLs under the API base', () => {
    expect(avatarSizeFor(16)).toBe(32)
    expect(avatarSizeFor(36)).toBe(128)
    expect(avatarSizeFor(200)).toBe(256)
    expect(versionedAvatarUrl(AVERY, 64)).toBe(`${AVERY}&size=64`)
    expect(versionedAvatarUrl('blob:preview', 64)).toBe('blob:preview')
  })

  it('batches lookups made together into one call and keeps answers for the session', async () => {
    const calls = mockLookup({ 'avery@example.com': AVERY })
    const [avery, ann] = await Promise.all([lookupAvatarUrl('avery@example.com'), lookupAvatarUrl('ann@example.com')])
    expect(avery).toBe(AVERY)
    expect(ann).toBeNull()
    expect(await lookupAvatarUrl('avery@example.com')).toBe(AVERY)
    expect(calls).toEqual([['avery@example.com', 'ann@example.com']])
  })
})

describe('UserAvatar', () => {
  it('draws initials without asking the server when profiles are not installed', () => {
    const calls = mockLookup({})
    const { container } = renderAvatar(<UserAvatar userId="u1" name="Avery Quinn" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('AQ')
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(calls).toEqual([])
  })

  it("loads a user's avatar from the lookup, and falls back to initials for the session after a miss", async () => {
    profile.installed = true
    mockLookup({ u1: AVERY })
    const { container, unmount } = renderAvatar(<UserAvatar userId="u1" name="Avery Quinn" size={24} />)
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', `${AVERY}&size=64`))
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('AQ')
    expect(isAvatarMiss(`${AVERY}&size=64`)).toBe(true)
    unmount()
    const again = renderAvatar(<UserAvatar userId="u1" name="Avery Quinn" size={24} />)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(again.container.querySelector('img')).toBeNull()
  })

  it('shows initials for a user without an avatar', async () => {
    profile.installed = true
    const calls = mockLookup({})
    const { container } = renderAvatar(<UserAvatar userId="ann@example.com" name="Ann" />)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('A')
  })

  it('shows a known URL and names itself when it stands alone', () => {
    const { container } = renderAvatar(<UserAvatar src={AVERY} name="Me" size={36} label="Your photo" />)
    expect(container.querySelector('img')).toHaveAttribute('src', `${AVERY}&size=128`)
    expect(container.firstElementChild).toHaveAttribute('role', 'img')
    expect(container.firstElementChild).toHaveAttribute('aria-label', 'Your photo')
  })
})
