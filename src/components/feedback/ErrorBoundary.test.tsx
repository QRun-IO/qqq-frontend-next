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
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ErrorBoundary } from './ErrorBoundary'

describe('ErrorBoundary recovery', () => {
  it('runs the query recovery action before rendering its children again', async () => {
    let broken = true
    const onReset = vi.fn(() => { broken = false })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function Content() {
      if (broken) throw new Error('Bad saved filter')
      return <p>Recovered query</p>
    }

    try {
      render(<ErrorBoundary onReset={onReset} resetLabel="Reset saved query and reload"><Content /></ErrorBoundary>)
      await userEvent.click(screen.getByRole('button', { name: 'Reset saved query and reload' }))
      expect(onReset).toHaveBeenCalledOnce()
      expect(screen.getByText('Recovered query')).toBeVisible()
    } finally {
      consoleError.mockRestore()
    }
  })
})
