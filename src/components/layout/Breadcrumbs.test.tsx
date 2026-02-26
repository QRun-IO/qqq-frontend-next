// Tests for Breadcrumbs component

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/myApp/myTable'),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

import Breadcrumbs from './Breadcrumbs'

describe('Breadcrumbs', () => {
  const pathToLabelMap: Record<string, string> = {
    '/myApp': 'My Application',
    '/myApp/myTable': 'My Table',
  }

  it('should render breadcrumb navigation', () => {
    render(<Breadcrumbs pathToLabelMap={pathToLabelMap} />)
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
  })

  it('should render home link', () => {
    render(<Breadcrumbs pathToLabelMap={pathToLabelMap} />)
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
  })

  it('should mark current page with aria-current="page"', () => {
    render(<Breadcrumbs pathToLabelMap={pathToLabelMap} />)
    const currentElement = screen.getByText('My Table')
    expect(currentElement).toHaveAttribute('aria-current', 'page')
  })

  it('should render intermediate paths as links', () => {
    render(<Breadcrumbs pathToLabelMap={pathToLabelMap} />)
    const link = screen.getByRole('link', { name: 'My Application' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/myApp')
  })

  it('should have data-qqq-id="breadcrumbs"', () => {
    render(<Breadcrumbs pathToLabelMap={pathToLabelMap} />)
    expect(document.querySelector('[data-qqq-id="breadcrumbs"]')).toBeInTheDocument()
  })

  it('should use raw segment name when label not found in map', async () => {
    const { usePathname } = await import('next/navigation')
    vi.mocked(usePathname).mockReturnValue('/unknownApp/unknownTable')

    render(<Breadcrumbs pathToLabelMap={{}} />)
    // Falls back to segment name
    expect(screen.getByText('unknownTable')).toHaveAttribute('aria-current', 'page')
  })
})
