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
import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/lib/theme/theme-provider'
import { UserPreferencesDialog } from './UserPreferencesDialog'

beforeEach(() => localStorage.clear())

it('applies the selected appearance immediately, restores it on remount, and resets to light', async () => {
  const user = userEvent.setup()
  const dialog = <ThemeProvider><UserPreferencesDialog open onOpenChange={vi.fn()} /></ThemeProvider>
  const first = render(dialog)
  expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'Dark' }))
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(localStorage.getItem('qqq-dark-mode')).toBe('true')
  first.unmount()
  render(dialog)
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Reset to Defaults' }))
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(localStorage.getItem('qqq-dark-mode')).toBe('false')
})

it('explains an application theme restriction and can reset a saved dark preference', async () => {
  localStorage.setItem('qqq-dark-mode', 'true')
  const user = userEvent.setup()
  render(<ThemeProvider initialTheme={{ primaryColor: '#0f766e' }}>
    <UserPreferencesDialog open onOpenChange={vi.fn()} />
  </ThemeProvider>)
  expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeDisabled()
  expect(screen.getByText(/application theme requires light mode/i)).toBeVisible()
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  await user.click(screen.getByRole('button', { name: 'Reset to Defaults' }))
  expect(localStorage.getItem('qqq-dark-mode')).toBe('false')
})
