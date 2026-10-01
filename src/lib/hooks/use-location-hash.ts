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
 * @file useLocationHash — the current URL hash, following in-page hash links
 * (Material Dashboard hash actions such as `#audit` or `#/launchProcess=...`).
 */

'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Tracks `window.location.hash` across `hashchange` events.
 *
 * @returns The hash (with its leading `#`, or `''`) and a function that removes it from
 *   the URL without a navigation, so a handled action does not reopen on refresh.
 */
export function useLocationHash(): [string, () => void] {
  const [hash, setHash] = useState('')

  useEffect(() => {
    const update = () => setHash(window.location.hash)
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  const clearHash = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    }
    setHash('')
  }, [])

  return [hash, clearHash]
}
