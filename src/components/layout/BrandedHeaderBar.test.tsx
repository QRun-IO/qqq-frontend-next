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
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import BrandedHeaderBar from './BrandedHeaderBar'
import CompanyFooter, { isSafeCompanyUrl } from './CompanyFooter'

describe('BrandedHeaderBar', () => {
  it('renders nothing unless the theme enables it', () => {
    const { container, rerender } = render(<BrandedHeaderBar theme={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<BrandedHeaderBar theme={{ brandedHeaderTagline: 'Hidden' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the logo with its alt text and the tagline, styled by the Material variables', () => {
    const { container } = render(<BrandedHeaderBar theme={{ brandedHeaderEnabled: true, brandedHeaderLogoPath: '/brand.png', brandedHeaderLogoAltText: 'Acme', brandedHeaderTagline: 'Owned and operated' }} />)
    const bar = container.querySelector('.qqq-branded-header-bar') as HTMLElement
    expect(bar).toHaveAttribute('data-qqq-id', 'branded-header-bar')
    expect(bar.style.height).toBe('var(--qqq-branded-header-height, 48px)')
    expect(bar.style.backgroundColor).toBe('var(--qqq-branded-header-background-color, #1a2035)')
    expect(screen.getByRole('img', { name: 'Acme' })).toHaveAttribute('src', '/brand.png')
    expect(screen.getByText('Owned and operated')).toBeInTheDocument()
  })

  it('defaults the alt text and hides a logo that fails to load', () => {
    render(<BrandedHeaderBar theme={{ brandedHeaderEnabled: true, brandedHeaderLogoPath: '/missing.png' }} />)
    const logo = screen.getByRole('img', { name: 'Logo' })
    fireEvent.error(logo)
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('CompanyFooter', () => {
  it('shows "© year, company" linking to the company site in a new tab', () => {
    render(<CompanyFooter branding={{ companyName: 'QRun Acceptance', companyUrl: 'https://qrun.io/' }} year={2026} />)
    const footer = screen.getByText(/© 2026,/).closest('footer')
    expect(footer).toHaveAttribute('data-qqq-id', 'footer-company')
    const link = screen.getByRole('link', { name: 'QRun Acceptance (opens in a new tab)' })
    expect(link).toHaveAttribute('href', 'https://qrun.io/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('needs both the name and an http(s) URL, as Material does', () => {
    for (const branding of [undefined, { companyName: 'X' }, { companyUrl: 'https://x' }, { companyName: 'X', companyUrl: 'javascript:alert(1)' }]) {
      const { container, unmount } = render(<CompanyFooter branding={branding} />)
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
    expect(isSafeCompanyUrl('http://x')).toBe(true)
    expect(isSafeCompanyUrl('/relative')).toBe(false)
  })
})
