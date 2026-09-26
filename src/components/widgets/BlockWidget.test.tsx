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

// Tests for BlockWidget component

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the shared sanitizer (DOMPurify-based) before importing the component
vi.mock('@/lib/utils/sanitize-html', () => ({
  sanitizeHtml: vi.fn(),
}))

import { BlockWidget } from './BlockWidget'
import type { BlockData } from '@/types'
import { sanitizeHtml } from '@/lib/utils/sanitize-html'

const sanitizeMock = vi.mocked(sanitizeHtml)

describe('BlockWidget', () => {
  beforeEach(() => {
    sanitizeMock.mockClear()
    sanitizeMock.mockImplementation((s) => s ?? '')
  })

  // ─── Empty / fallback states ────────────────────────────────────────────────

  it('renders a fallback message when blocks array is empty', () => {
    render(<BlockWidget data={{ blocks: [] }} widgetName="test" />)
    expect(screen.getByText(/no block content available/i)).toBeInTheDocument()
  })

  it('renders a fallback message when blocks are undefined', () => {
    render(<BlockWidget data={{}} widgetName="test" />)
    expect(screen.getByText(/no block content available/i)).toBeInTheDocument()
  })

  it('renders legacy html when there are no blocks but html string is present', () => {
    sanitizeMock.mockReturnValue('<p>legacy</p>')
    const { container } = render(
      <BlockWidget data={{ html: '<p>legacy</p>' }} widgetName="test" />
    )
    expect(sanitizeMock).toHaveBeenCalledWith('<p>legacy</p>')
    expect(container.querySelector('[data-qqq-id="block-widget-test"]')).toBeInTheDocument()
  })

  // ─── Layout classes ──────────────────────────────────────────────────────────

  it('applies vertical layout class by default', () => {
    const blocks: BlockData[] = [{ type: 'text', text: 'hello' }]
    const { container } = render(
      <BlockWidget data={{ blocks }} widgetName="myWidget" />
    )
    const wrapper = container.querySelector('[data-qqq-id="block-widget-myWidget"]')
    expect(wrapper).toHaveClass('flex', 'flex-col')
  })

  it('applies horizontal layout class when layout is horizontal', () => {
    const blocks: BlockData[] = [{ type: 'text', text: 'hello' }]
    const { container } = render(
      <BlockWidget data={{ blocks, layout: 'horizontal' }} widgetName="myWidget" />
    )
    const wrapper = container.querySelector('[data-qqq-id="block-widget-myWidget"]')
    expect(wrapper).toHaveClass('flex', 'flex-row')
  })

  it('applies grid layout class when layout is grid', () => {
    const blocks: BlockData[] = [{ type: 'text', text: 'hello' }]
    const { container } = render(
      <BlockWidget data={{ blocks, layout: 'grid' }} widgetName="myWidget" />
    )
    const wrapper = container.querySelector('[data-qqq-id="block-widget-myWidget"]')
    expect(wrapper).toHaveClass('grid', 'grid-cols-2')
  })

  // ─── List of blocks ──────────────────────────────────────────────────────────

  it('renders all blocks in the list', () => {
    const blocks: BlockData[] = [
      { type: 'text', text: 'First block' },
      { type: 'text', text: 'Second block' },
      { type: 'divider' },
    ]
    render(<BlockWidget data={{ blocks }} widgetName="multi" />)
    expect(screen.getByText('First block')).toBeInTheDocument()
    expect(screen.getByText('Second block')).toBeInTheDocument()
  })

  // ─── Composite key assertion ─────────────────────────────────────────────────
  // The component uses `${block.type}-${index}` as the key, which surfaces as
  // the data-qqq-id pattern `block-{type}-{widgetName}-{index}`.

  it('renders text blocks with composite data-qqq-id using type and index', () => {
    const blocks: BlockData[] = [
      { type: 'text', text: 'Alpha' },
      { type: 'text', text: 'Beta' },
    ]
    const { container } = render(
      <BlockWidget data={{ blocks }} widgetName="keys" />
    )
    // block-text-keys-0 and block-text-keys-1 prove type+index composite, not plain index
    expect(container.querySelector('[data-qqq-id="block-text-keys-0"]')).toBeInTheDocument()
    expect(container.querySelector('[data-qqq-id="block-text-keys-1"]')).toBeInTheDocument()
  })

  it('renders big_number blocks with type-prefixed data-qqq-id', () => {
    const blocks: BlockData[] = [{ type: 'big_number', value: 42, label: 'Count' }]
    const { container } = render(
      <BlockWidget data={{ blocks }} widgetName="nums" />
    )
    expect(container.querySelector('[data-qqq-id="block-big-number-nums-0"]')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Count')).toBeInTheDocument()
  })

  // ─── Block type renderers ────────────────────────────────────────────────────

  it('renders progress bar with correct aria attributes', () => {
    const blocks: BlockData[] = [{ type: 'progress', value: 30, max: 100, label: 'Loading' }]
    render(<BlockWidget data={{ blocks }} widgetName="prog" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '30')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('renders up_or_down block with ArrowUp when value >= baseValue', () => {
    const blocks: BlockData[] = [{ type: 'up_or_down', value: 10, baseValue: 5 }]
    render(<BlockWidget data={{ blocks }} widgetName="updown" />)
    expect(screen.getByLabelText('Up')).toBeInTheDocument()
  })

  it('renders up_or_down block with ArrowDown when value < baseValue', () => {
    const blocks: BlockData[] = [{ type: 'up_or_down', value: 3, baseValue: 10 }]
    render(<BlockWidget data={{ blocks }} widgetName="updown" />)
    expect(screen.getByLabelText('Down')).toBeInTheDocument()
  })

  it('renders button block with correct label', () => {
    const blocks: BlockData[] = [{ type: 'button', label: 'Click Me', actionCode: 'doSomething' }]
    render(<BlockWidget data={{ blocks }} widgetName="btns" />)
    const btn = screen.getByRole('button', { name: 'Click Me' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('data-action-code', 'doSomething')
  })

  it('renders html block and sanitizes content with DOMPurify', () => {
    const blocks: BlockData[] = [{ type: 'html', html: '<b>bold</b>' }]
    render(<BlockWidget data={{ blocks }} widgetName="htmlBlk" />)
    expect(sanitizeMock).toHaveBeenCalledWith('<b>bold</b>')
  })

  it('renders image block', () => {
    const blocks: BlockData[] = [{ type: 'image', src: '/img.png', alt: 'My image' }]
    render(<BlockWidget data={{ blocks }} widgetName="imgs" />)
    const img = screen.getByRole('img', { name: 'My image' })
    expect(img).toHaveAttribute('src', '/img.png')
  })

  it('renders divider block as an hr', () => {
    const blocks: BlockData[] = [{ type: 'divider' }]
    const { container } = render(
      <BlockWidget data={{ blocks }} widgetName="divs" />
    )
    expect(container.querySelector('hr')).toBeInTheDocument()
  })

  it('renders input block with a label and input field', () => {
    const blocks: BlockData[] = [
      { type: 'input', name: 'email', label: 'Email', inputType: 'email', defaultValue: '' },
    ]
    render(<BlockWidget data={{ blocks }} widgetName="inputs" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })
})
