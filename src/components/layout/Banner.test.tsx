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

// Tests for Banner component (v1 branding banner shape, keyed by slot)

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import BannerComponent from './Banner'
import type { Banner } from '@/types'

const banners: Record<string, Banner> = {
  QFMD_TOP_OF_SITE: { severity: 'INFO', messageText: 'Site notice' },
  QFMD_TOP_OF_BODY: { severity: 'WARNING', messageHTML: 'Body <b>bold</b><img src=x onerror="alert(1)">' },
  QFMD_SIDE_NAV_UNDER_LOGO: {
    severity: 'SUCCESS',
    textColor: '#ffffff',
    backgroundColor: '#14532d',
    additionalStyles: { fontWeight: '700' },
    messageText: 'NAV',
  },
  SOMETHING_ELSE: { severity: 'ERROR', messageText: 'Unknown slot' },
}

describe('Banner', () => {
  it('renders the plain-text message of the requested slot in a labelled region', () => {
    render(<BannerComponent banners={banners} slot="QFMD_TOP_OF_SITE" />)
    const region = screen.getByRole('region', { name: 'Site banner' })
    expect(region).toHaveTextContent('Site notice')
    expect(region).toHaveAttribute('data-qqq-id', 'banner-QFMD_TOP_OF_SITE')
    expect(region).toHaveAttribute('data-severity', 'info')
    expect(screen.queryByText('Unknown slot')).not.toBeInTheDocument()
  })

  it('renders sanitized HTML in preference to text', () => {
    render(<BannerComponent banners={banners} slot="QFMD_TOP_OF_BODY" />)
    const region = screen.getByRole('region', { name: 'Page banner' })
    expect(region.querySelector('b')).toHaveTextContent('bold')
    expect(region.querySelector('img')?.getAttribute('onerror')).toBeFalsy()
    expect(region).toHaveAttribute('data-severity', 'warning')
  })

  it('applies text color, background color and additional styles from metadata', () => {
    render(<BannerComponent banners={banners} slot="QFMD_SIDE_NAV_UNDER_LOGO" />)
    const region = screen.getByRole('region', { name: 'Navigation banner' })
    expect(region.style.color).toBe('rgb(255, 255, 255)')
    expect(region.style.background).toContain('rgb(20, 83, 45)')
    expect(region.style.fontWeight).toBe('700')
  })

  it('renders nothing for an empty slot, missing banners, or a banner without a message', () => {
    const { container, rerender } = render(<BannerComponent banners={{}} slot="QFMD_TOP_OF_SITE" />)
    expect(container.firstChild).toBeNull()
    rerender(<BannerComponent slot="QFMD_TOP_OF_SITE" />)
    expect(container.firstChild).toBeNull()
    rerender(<BannerComponent banners={{ QFMD_TOP_OF_SITE: { severity: 'INFO' } }} slot="QFMD_TOP_OF_SITE" />)
    expect(container.firstChild).toBeNull()
  })

  it('defaults to info severity', () => {
    render(<BannerComponent banners={{ QFMD_TOP_OF_SITE: { messageText: 'Plain' } }} slot="QFMD_TOP_OF_SITE" />)
    expect(screen.getByRole('region', { name: 'Site banner' })).toHaveAttribute('data-severity', 'info')
  })
})
