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

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { resetClientErrorsForTesting, setClientErrorSink } from '@/lib/errors/client-errors'
import PageError from './error'

describe('page error boundary', () => {
  afterEach(() => {
    resetClientErrorsForTesting()
    vi.restoreAllMocks()
  })

  it('reports the failure and offers Try again inside the shell', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const sink = vi.fn().mockResolvedValue(undefined)
    setClientErrorSink(sink)
    const reset = vi.fn()
    render(<PageError error={new Error("Cannot read properties of undefined (reading 'length')")} reset={reset} />)
    expect(screen.getByText('This page hit a problem')).toBeVisible()
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ scope: 'page' }))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
