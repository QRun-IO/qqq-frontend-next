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

import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { resetClientErrorsForTesting, setClientErrorSink } from '@/lib/errors/client-errors'
import { ErrorBoundary } from './ErrorBoundary'
import { InlineFailure } from './InlineFailure'
import { WidgetErrorBoundary } from '@/components/widgets/WidgetErrorBoundary'

function Boom({ when = true }: { when?: boolean }): React.ReactElement {
  if (when) throw new Error('render failed')
  return <p>fine</p>
}

describe('layered error boundaries', () => {
  beforeEach(() => {
    resetClientErrorsForTesting()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('reports a scoped failure with its ids and shows the fallback with details', async () => {
    const sink = vi.fn().mockResolvedValue(undefined)
    setClientErrorSink(sink)
    render(
      <div>
        <p>sibling</p>
        <ErrorBoundary scope="assistant-part" reportContext={{ conversationId: 3, partType: 'tool' }}
          fallbackRender={({ report }) => <InlineFailure message="This part couldn't be displayed." report={report} />}>
          <Boom />
        </ErrorBoundary>
      </div>
    )
    expect(screen.getByText('sibling')).toBeVisible()
    expect(screen.getByText("This part couldn't be displayed.")).toBeVisible()
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ scope: 'assistant-part', conversationId: 3, partType: 'tool', message: 'render failed' }))
    await userEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText(/What: assistant-part/)).toBeVisible()
  })

  it('renders again when a reset key changes', () => {
    const { rerender } = render(<ErrorBoundary scope="widget" resetKeys={[1]} fallback={<p>failed</p>}><Boom /></ErrorBoundary>)
    expect(screen.getByText('failed')).toBeVisible()
    rerender(<ErrorBoundary scope="widget" resetKeys={[2]} fallback={<p>failed</p>}><Boom when={false} /></ErrorBoundary>)
    expect(screen.getByText('fine')).toBeVisible()
  })

  it('keeps sibling widgets when one widget throws, and retries it', async () => {
    const sink = vi.fn().mockResolvedValue(undefined)
    setClientErrorSink(sink)
    function Dashboard() {
      const [broken, setBroken] = useState(true)
      return (
        <>
          <WidgetErrorBoundary widgetName="bad" onRetry={() => setBroken(false)}><Boom when={broken} /></WidgetErrorBoundary>
          <WidgetErrorBoundary widgetName="good"><p>good widget</p></WidgetErrorBoundary>
        </>
      )
    }
    render(<Dashboard />)
    expect(screen.getByText('good widget')).toBeVisible()
    expect(screen.getByText('Widget failed to render')).toBeVisible()
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ scope: 'widget', renderType: 'bad' }))
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('fine')).toBeVisible()
  })

  it('reports record sections under their own scope', () => {
    const sink = vi.fn().mockResolvedValue(undefined)
    setClientErrorSink(sink)
    render(<WidgetErrorBoundary widgetName="address" scope="record-section"><Boom /></WidgetErrorBoundary>)
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ scope: 'record-section' }))
  })
})
