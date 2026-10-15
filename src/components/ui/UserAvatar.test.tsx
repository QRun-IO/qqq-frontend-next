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

import { fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { avatarSizeFor, clearAvatarMisses, isAvatarMiss, userAvatarUrl, versionedAvatarUrl } from '@/lib/api/avatars'
import { initialsOf, UserAvatar } from './UserAvatar'

const profile = vi.hoisted(() => ({ installed: false }))
vi.mock('@/lib/hooks/use-my-profile', () => ({ useMyProfile: () => profile }))

const renderAvatar = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

beforeEach(() => {
  profile.installed = false
  clearAvatarMisses()
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
    expect(userAvatarUrl('a@b.com', 64)).toBe('/qqq/v1/avatars/a%40b.com?size=64')
    expect(versionedAvatarUrl('/qqq/v1/avatars/a%40b.com?v=k1', 64)).toBe('/qqq/v1/avatars/a%40b.com?v=k1&size=64')
    expect(versionedAvatarUrl('blob:preview', 64)).toBe('blob:preview')
  })
})

describe('UserAvatar', () => {
  it('draws initials without asking the server when profiles are not installed', () => {
    const { container } = renderAvatar(<UserAvatar userId="u1" name="Avery Quinn" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('AQ')
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it("loads a user's avatar, and falls back to initials for the session after a miss", () => {
    profile.installed = true
    const { container, unmount } = renderAvatar(<UserAvatar userId="u1" name="Avery Quinn" size={24} />)
    const image = container.querySelector('img')!
    expect(image).toHaveAttribute('src', '/qqq/v1/avatars/u1?size=64')
    fireEvent.error(image)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('AQ')
    expect(isAvatarMiss('/qqq/v1/avatars/u1?size=64')).toBe(true)
    unmount()
    const again = renderAvatar(<UserAvatar userId="u1" name="Avery Quinn" size={24} />)
    expect(again.container.querySelector('img')).toBeNull()
  })

  it('shows a known URL and names itself when it stands alone', () => {
    const { container } = renderAvatar(<UserAvatar src="/qqq/v1/avatars/me?v=k" name="Me" size={36} label="Your photo" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/qqq/v1/avatars/me?v=k&size=128')
    expect(container.firstElementChild).toHaveAttribute('role', 'img')
    expect(container.firstElementChild).toHaveAttribute('aria-label', 'Your photo')
  })
})
