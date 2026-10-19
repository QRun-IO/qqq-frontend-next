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
 * streaming, record renders) loads when the assistant becomes available. It stays mounted
 * while closed so refresh discovery and the header's busy indicator keep working.
 */

'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { assistantKeys, useAssistant } from './assistant-context'
import { AssistantPanelFailure } from './AssistantPanelFailure'

/** The panel module. */
type PanelModule = { default: React.ComponentType }

/** First wait before a crashed panel is tried again on its own; doubles up to the cap. */
export const RECOVERY_FIRST_DELAY_MS = 5_000
/** Longest wait between two recovery checks. */
export const RECOVERY_MAX_DELAY_MS = 60_000

const importPanel = (): Promise<PanelModule> => import('./AssistantPanel')
let panelLoader: () => Promise<PanelModule> = importPanel
let loadedPanel: Promise<PanelModule> | null = null
let panelModule: PanelModule | null = null

/**
 * Loads the panel code once; a failed load (a chunk missing after a deploy, a network error) is
 * forgotten so the next attempt fetches it again.
 *
 * @returns The panel module.
 */
function loadPanel(): Promise<PanelModule> {
  if (!loadedPanel) {
    loadedPanel = panelLoader().then((module) => {
      panelModule = module
      return module
    }, (error: unknown) => {
      loadedPanel = null
      throw error
    })
  }
  return loadedPanel
}

/**
 * Replaces how the panel code is loaded (tests: a chunk that fails to load).
 *
 * @param loader - The loader, or null for the real import.
 */
export function setAssistantPanelLoaderForTesting(loader: (() => Promise<PanelModule>) | null): void {
  panelLoader = loader ?? importPanel
  loadedPanel = null
  panelModule = null
}

/**
 * Mounts the lazily loaded assistant panel when the assistant is available. The panel sits
 * behind its own error boundary: if it (or its code chunk) fails, a small card offers Retry,
 * Copy details and Report a bug, and the page keeps working. The panel comes back on Retry, on
 * reopening, and by itself once an assistant request succeeds again (checked with a backoff).
 *
 * @returns The panel, or null until the assistant is available.
 */
export function AssistantMount() {
  const assistant = useAssistant()
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(false)
  const [recovery, setRecovery] = useState(0)
  const onError = useCallback(() => setFailed(true), [])
  const onLoaded = useCallback(() => setFailed(false), [])

  // While crashed: try the assistant again with a backoff; the panel renders again as soon as an
  // assistant request (this check, a focus refetch, the badge) succeeds.
  useEffect(() => {
    if (!failed) return
    const cache = queryClient.getQueryCache()
    const root = assistantKeys.all()
    const unsubscribe = cache.subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return
      const key = event.query.queryKey
      if (root.every((part, index) => key[index] === part)) setRecovery((value) => value + 1)
    })
    let delay = RECOVERY_FIRST_DELAY_MS
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      void queryClient.refetchQueries({ queryKey: assistantKeys.conversations(), type: 'all' }).catch(() => undefined)
      delay = Math.min(delay * 2, RECOVERY_MAX_DELAY_MS)
      timer = setTimeout(check, delay)
    }
    timer = setTimeout(check, delay)
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [failed, queryClient])

  if (!assistant?.enabled) return null
  return (
    <ErrorBoundary
      scope="assistant-panel"
      reportContext={{ conversationId: assistant.activeConversationId }}
      resetKeys={[assistant.open, recovery]}
      onError={onError}
      onReset={() => setFailed(false)}
      fallbackRender={({ report, error, reset }) => <AssistantPanelFailure report={report} error={error} onRetry={reset} />}
    >
      <PanelLoader onLoaded={failed ? onLoaded : undefined} />
    </ErrorBoundary>
  )
}

/**
 * Loads the panel code and renders the panel. Unlike React.lazy, which keeps a failed load
 * forever, a remount (Retry, reopening, recovery) loads it again. A load failure is thrown to
 * the panel's error boundary like a render error.
 *
 * @param props - Component properties.
 * @param props.onLoaded - Called once the panel rendered, when set (the mount was showing a failure).
 * @returns The panel, or nothing while its code loads.
 */
function PanelLoader({ onLoaded }: { onLoaded?: () => void }) {
  const [module, setModule] = useState<PanelModule | null>(panelModule)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    if (module) return
    let active = true
    loadPanel().then((loaded) => {
      if (active) setModule(loaded)
    }, (failure: unknown) => {
      if (active) setError(failure ?? new Error('The assistant could not be loaded.'))
    })
    return () => {
      active = false
    }
  }, [module])
  useEffect(() => {
    if (module) onLoaded?.()
  }, [module, onLoaded])
  if (error) throw error
  if (!module) return null
  const Panel = module.default
  return <Panel />
}
