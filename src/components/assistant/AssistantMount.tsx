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

import React, { Suspense, lazy } from 'react'

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { useAssistant } from './assistant-context'
import { AssistantPanelFailure } from './AssistantPanelFailure'

const AssistantPanel = lazy(() => import('./AssistantPanel'))

/**
 * Mounts the lazily loaded assistant panel when the assistant is available. The panel sits
 * behind its own error boundary: if it (or its code chunk) fails, a small card offers Retry,
 * Copy details and Report a bug, and the page keeps working. Reopening the panel retries.
 *
 * @returns The panel, or null until the assistant is available.
 */
export function AssistantMount() {
  const assistant = useAssistant()
  if (!assistant?.enabled) return null
  return (
    <ErrorBoundary
      scope="assistant-panel"
      reportContext={{ conversationId: assistant.activeConversationId }}
      resetKeys={[assistant.open]}
      fallbackRender={({ report, error, reset }) => <AssistantPanelFailure report={report} error={error} onRetry={reset} />}
    >
      <Suspense fallback={null}>
        <AssistantPanel />
      </Suspense>
    </ErrorBoundary>
  )
}
