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

// Tests for Banner component

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import BannerComponent from './Banner'
import type { Banner } from '@/types'

describe('Banner', () => {
  const banners: Record<string, Banner> = {
    QFMD_TOP_OF_SITE: {
      text: 'This is a test environment',
      severity: 'warning',
      dismissible: true,
    },
  }

  it('should render banner text', () => {
    render(<BannerComponent banners={banners} />)
    expect(screen.getByText('This is a test environment')).toBeInTheDocument()
  })

  it('should have role="alert"', () => {
    render(<BannerComponent banners={banners} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('should show dismiss button for dismissible banners', () => {
    render(<BannerComponent banners={banners} />)
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('should hide banner after dismiss', async () => {
    const user = userEvent.setup()
    render(<BannerComponent banners={banners} />)

    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText('This is a test environment')).not.toBeInTheDocument()
  })

  it('should not show dismiss button for non-dismissible banners', () => {
    const nonDismissibleBanners: Record<string, Banner> = {
      QFMD_TOP_OF_SITE: {
        text: 'Persistent banner',
        severity: 'info',
        dismissible: false,
      },
    }
    render(<BannerComponent banners={nonDismissibleBanners} />)
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
  })

  it('should call onDismiss callback when dismissed', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<BannerComponent banners={banners} onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledWith('QFMD_TOP_OF_SITE')
  })

  it('should render nothing for empty banners', () => {
    const { container } = render(<BannerComponent banners={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('should have data-qqq-id on banner element', () => {
    render(<BannerComponent banners={banners} />)
    expect(screen.getByRole('alert').closest('[data-qqq-id]')).toBeTruthy()
  })

  it('should render multiple banners', () => {
    const multiBanners: Record<string, Banner> = {
      banner1: { text: 'First banner', severity: 'info', dismissible: false },
      banner2: { text: 'Second banner', severity: 'warning', dismissible: true },
    }
    render(<BannerComponent banners={multiBanners} />)
    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })
})
