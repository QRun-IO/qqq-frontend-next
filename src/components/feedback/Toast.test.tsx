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
import { describe, it, expect } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { toast } from 'sonner'

import { AppToaster, TOASTER_POSITION } from './Toast'

describe('AppToaster', () => {
  it('shows toasts at the top center, clear of the bottom-right primary actions (QRun-IO/qqq#708)', async () => {
    render(<AppToaster />)
    act(() => {
      toast.error('Failed to create Record Lab')
    })
    const message = await screen.findByText('Failed to create Record Lab')
    const item = message.closest('[data-sonner-toast]')
    expect(item).toHaveAttribute('data-y-position', 'top')
    expect(item).toHaveAttribute('data-x-position', 'center')
    expect(TOASTER_POSITION).toBe('top-center')
  })
})
