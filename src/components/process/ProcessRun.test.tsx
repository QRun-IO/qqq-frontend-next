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

// Tests for ProcessRun's completion callback (the record picker's upload-and-select)

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QProcessMetaData } from '@/types'

const processState = { current: { phase: 'step', values: {} as Record<string, unknown>, steps: [], screenInstance: 1 } }

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/api/metadata', () => ({ loadMetaData: vi.fn().mockResolvedValue({ apps: {}, appTree: [] }) }))
vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: () => ({ data: undefined }) }))
vi.mock('@/lib/hooks/use-process', () => ({
  useProcess: () => ({ state: processState.current, oneTimeSecrets: [], clearOneTimeSecrets: vi.fn(), start: vi.fn(), submit: vi.fn(), back: vi.fn(), cancel: vi.fn() }),
}))
vi.mock('./ProcessStepScreen', () => ({ ProcessStepScreen: () => <p>step</p> }))
vi.mock('./ProcessResultStep', () => ({ ProcessResultStep: () => <p>done</p>, ProcessSecretNotice: () => null }))

import { ProcessRun } from './ProcessRun'

const PROCESS = { name: 'uploadImage', label: 'Upload image', tableName: 'media', stepFlow: 'LINEAR', frontendSteps: [] } as unknown as QProcessMetaData

/**
 * Render an embedded run with a completion callback.
 * @param onComplete - The callback.
 * @returns The rerender function.
 */
function renderRun(onComplete: (values: Record<string, unknown>) => void) {
  const client = new QueryClient()
  const view = () => (
    <QueryClientProvider client={client}>
      <ProcessRun processName="uploadImage" processMetaData={PROCESS} isEmbedded onComplete={onComplete} />
    </QueryClientProvider>
  )
  const result = render(view())
  return () => result.rerender(view())
}

describe('ProcessRun onComplete', () => {
  it('reports the final values once, when the run completes', () => {
    const onComplete = vi.fn()
    processState.current = { phase: 'step', values: {}, steps: [], screenInstance: 1 }
    const rerender = renderRun(onComplete)
    expect(onComplete).not.toHaveBeenCalled()

    processState.current = { phase: 'complete', values: { mediaId: 42 }, steps: [], screenInstance: 2 }
    rerender()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith({ mediaId: 42 })

    rerender()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
