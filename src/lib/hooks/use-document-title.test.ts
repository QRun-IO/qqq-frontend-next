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

// The metadata-derived title survives a later static title update (QRun-IO/qqq#649)

import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useDocumentTitle } from './use-document-title'

describe('useDocumentTitle', () => {
  it('sets the title and restores it when something else replaces it', async () => {
    const { rerender, unmount } = renderHook(({ title }) => useDocumentTitle(title), { initialProps: { title: 'Tide Chart | Nav Deep Item | QQQ Sample' } })
    expect(document.title).toBe('Tide Chart | Nav Deep Item | QQQ Sample')

    // what Next.js does when it re-applies the route's static metadata after a navigation
    document.title = 'QQQ Admin'
    await waitFor(() => expect(document.title).toBe('Tide Chart | Nav Deep Item | QQQ Sample'))

    rerender({ title: 'Person | QQQ Sample' })
    expect(document.title).toBe('Person | QQQ Sample')

    unmount()
    document.title = 'Elsewhere'
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(document.title).toBe('Elsewhere')
  })
})
