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

import { describe, expect, it } from 'vitest'

import type { QInstance } from '@/types'
import { DEFAULT_HOME_PATH, homeAppName, homePath } from './home-app'

const apps = { home: { name: 'home', label: 'Home' }, 'my app': { name: 'my app', label: 'Mine' } } as unknown as QInstance['apps']

describe('home app', () => {
  it('is the designated app when the user may open it', () => {
    expect(homeAppName({ apps, homeAppName: 'home' })).toBe('home')
    expect(homePath({ apps, homeAppName: 'home' })).toBe('/app/home')
    expect(homePath({ apps, homeAppName: 'my app' })).toBe('/app/my%20app')
  })

  it('falls back to the overview without a usable home app', () => {
    expect(DEFAULT_HOME_PATH).toBe('/app')
    expect(homePath(undefined)).toBe('/app')
    expect(homePath({ apps })).toBe('/app')
    expect(homePath({ apps, homeAppName: '' })).toBe('/app')
    expect(homePath({ apps, homeAppName: 'notThere' })).toBe('/app')
    expect(homeAppName({ apps: undefined as unknown as QInstance['apps'], homeAppName: 'home' })).toBeUndefined()
  })
})
