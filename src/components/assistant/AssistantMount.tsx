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
 * @file AssistantMount — the panel's place in the dashboard shell. The panel code (markdown,
 * streaming, record renders) loads on first open, so the shell's first load stays small; once
 * loaded it stays mounted, so a running reply keeps streaming while the panel is closed.
 */

'use client'

import React, { Suspense, lazy, useEffect, useState } from 'react'

import { useAssistant } from './assistant-context'

const AssistantPanel = lazy(() => import('./AssistantPanel'))

/**
 * Mounts the lazily loaded assistant panel once it has been opened.
 *
 * @returns The panel, or null until the assistant is available and first opened.
 */
export function AssistantMount() {
  const assistant = useAssistant()
  const [loaded, setLoaded] = useState(false)
  const open = Boolean(assistant?.open)
  useEffect(() => {
    if (open) setLoaded(true)
  }, [open])
  if (!assistant?.enabled || (!loaded && !open)) return null
  return (
    <Suspense fallback={null}>
      <AssistantPanel />
    </Suspense>
  )
}
