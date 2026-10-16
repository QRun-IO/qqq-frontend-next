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

/**
 * @file The signed-in user's profile (photo and display name) from the core `profile` preferences
 * section, read from the shared preferences index. Saving any section invalidates that index, so
 * the header follows a new photo or name at once. `installed` is false on servers without the `avatars` feature or without
 * the section; then no avatar is requested for anyone.
 */
'use client'

import { useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPreferences } from '@/lib/api/preferences'
import { useUiApiFeatureSupported } from '@/lib/api/ui-api-extensions'
import { AuthContext } from '@/lib/auth/auth-provider'
import { queryKeys } from '@/lib/query-client'

/** The core profile section's name. */
export const PROFILE_SECTION = 'profile'

/** What the app shows of the signed-in user. */
export interface MyProfile {
  /** True when the server stores profiles (avatars can be requested). */
  installed: boolean
  /** The server URL of the user's own avatar (photo or chosen Gravatar), if any. */
  avatarUrl?: string
  /** The name the user chose, if any. */
  displayName?: string
}

/**
 * Reads the signed-in user's profile.
 *
 * @returns The profile; `installed: false` until loaded or when unsupported.
 */
export function useMyProfile(): MyProfile {
  // tolerant of no provider (stories, isolated tests): then nothing is requested
  const isAuthenticated = useContext(AuthContext)?.isAuthenticated ?? false
  const supported = useUiApiFeatureSupported('avatars')
  // the shared preferences index (the user menu reads it too): an app without profiles simply has
  // no `profile` section there, so nothing is requested that could 404
  const { data: index } = useQuery({
    queryKey: queryKeys.preferencesIndex(),
    queryFn: getPreferences,
    enabled: supported && isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  const data = index?.sections.find((section) => section.name === PROFILE_SECTION)
  if (!data) return { installed: false }
  // avatarUrl is the effective avatar (photo, or the user's chosen Gravatar); avatar is the photo alone
  const avatar = data.values?.avatarUrl ?? data.values?.avatar
  const displayName = data.values?.displayName
  return {
    installed: true,
    avatarUrl: typeof avatar === 'string' && avatar ? avatar : undefined,
    displayName: typeof displayName === 'string' && displayName.trim() ? displayName : undefined,
  }
}
