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

// Tests for the canonical QQQ composite block renderer.

import React from 'react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import type { QWidgetMetaData } from '@/types'
import type { QqqCompositeData } from '../widget-types'
import { QqqComposite } from './QqqComposite'
import { blockColor } from './block-utils'

const meta = (name: string): QWidgetMetaData => ({ name, label: name, type: 'composite', hasPermission: true })

/** SampleBigNumberBlocksWidget payload, as served by the sample backend. */
const SAMPLE_BIG_NUMBERS = {
  blocks: [
    { tooltip: { title: 'You can have the same tooltip for all parts', placement: 'BOTTOM' }, link: { href: '/same-link-for-all-parts' }, values: { heading: 'Big Number with Simple Context', number: '123', context: 'context' }, styles: { width: '300px' }, blockTypeName: 'BIG_NUMBER' },
    {
      blocks: [
        { tooltip: { title: 'You can have a default tooltip...', placement: 'BOTTOM' }, link: { href: '/default-link' }, values: { heading: 'Number with Up/Down Context', number: '1,234' }, styles: { width: '300px' }, blockTypeName: 'BIG_NUMBER' },
        { tooltipMap: { CONTEXT: { title: 'You can do a custom tooltip for each slot', placement: 'BOTTOM' }, NUMBER: { title: 'This number has a customized color', placement: 'BOTTOM' } }, linkMap: { NUMBER: { href: '/custom-link-per-slot' } }, values: { isUp: false, isGood: false, number: '12,345', context: 'context' }, styles: { colorOverride: 'blue', isStacked: false }, blockTypeName: 'UP_OR_DOWN_NUMBER' },
      ],
      layout: 'FLEX_ROW_SPACE_BETWEEN', blockTypeName: 'COMPOSITE',
    },
    {
      blocks: [
        { values: { heading: 'Number with Stacked Up/Down Context', number: '1,234' }, styles: { width: '300px' }, blockTypeName: 'BIG_NUMBER' },
        { values: { isUp: true, isGood: true, number: '123', context: 'context' }, styles: { isStacked: true }, blockTypeName: 'UP_OR_DOWN_NUMBER' },
      ],
      layout: 'FLEX_ROW_SPACE_BETWEEN', blockTypeName: 'COMPOSITE',
    },
  ],
  layout: 'FLEX_ROW_WRAPPED', blockTypeName: 'COMPOSITE',
} as QqqCompositeData

/** The owned acceptance fixture's accBlocks payload (WidgetsFixtures.allBlocks()). */
const ALL_BLOCKS = {
  layout: 'FLEX_COLUMN', blockTypeName: 'COMPOSITE',
  blocks: [
    { blockId: 'ownedText', blockTypeName: 'TEXT', values: { text: 'Owned text line one\nOwned text line two' }, styles: { color: 'SUCCESS', format: 'alert', size: 'title', weight: 'bold' } },
    {
      blockTypeName: 'COMPOSITE', layout: 'FLEX_ROW',
      blocks: [
        { blockTypeName: 'BIG_NUMBER', link: { href: '/app/person' }, tooltip: { title: 'Owned big number tooltip' }, values: { heading: 'Owned heading', number: '4,321', context: 'owned context' }, styles: { numberColor: '#8F00D8' } },
        { blockTypeName: 'UP_OR_DOWN_NUMBER', values: { isUp: true, isGood: false, number: '17%', context: 'owned change' } },
      ],
    },
    {
      blockTypeName: 'COMPOSITE', layout: 'BADGES_WRAPPER',
      blocks: [
        { blockTypeName: 'NUMBER_ICON_BADGE', values: { number: 12, iconName: 'inventory' }, styles: { color: '#2BA83F' } },
        { blockTypeName: 'ICON', values: { name: 'star' }, styles: { color: '#FF8000', fontSize: '24px' } },
      ],
    },
    {
      blockTypeName: 'COMPOSITE', layout: 'TABLE_SUB_ROW_DETAILS',
      blocks: [{ blockTypeName: 'TABLE_SUB_ROW_DETAIL_ROW', values: { label: 'Owned detail label', value: 'Owned detail value' }, styles: { labelColor: '#546E7A', valueColor: '#0062FF' } }],
    },
    { blockTypeName: 'PROGRESS_BAR', values: { heading: 'Owned progress', percent: 62.5 }, styles: { barColor: '#10B8A6' } },
    { blockTypeName: 'DIVIDER' },
    {
      blockTypeName: 'COMPOSITE', layout: 'FLEX_ROW_SPACE_BETWEEN',
      blocks: [{ blockTypeName: 'TEXT', values: { text: 'Owned left' } }, { blockTypeName: 'TEXT', values: { text: 'Owned right' } }],
    },
    {
      blockTypeName: 'COMPOSITE', layout: 'FLEX_ROW_CENTER',
      blocks: [
        { blockTypeName: 'IMAGE', values: { path: 'http://127.0.0.1:9/owned-image.png', alt: 'Owned image' }, styles: { width: '32px', height: '32px' } },
        { blockTypeName: 'AUDIO', values: { path: 'http://127.0.0.1:9/owned-audio.wav', showControls: true, autoPlay: false } },
      ],
    },
    {
      blockTypeName: 'COMPOSITE', layout: 'FLEX_ROW_WRAPPED',
      blocks: [
        { blockTypeName: 'INPUT_FIELD', values: { fieldMetaData: { name: 'ownedMessage', label: 'Owned message', type: 'STRING', isRequired: true }, placeholder: 'Type an owned message' } },
        { blockTypeName: 'BUTTON', values: { label: 'Submit owned', actionCode: 'owned-submit' }, styles: { format: 'outlined' } },
      ],
    },
  ],
} as QqqCompositeData

/** Renders a composite for widget `name`. */
function renderComposite(data: QqqCompositeData, name = 'accBlocks', actionCallback = vi.fn()) {
  const utils = render(<QqqComposite widgetMetaData={meta(name)} data={data} actionCallback={actionCallback} />)
  return { ...utils, actionCallback }
}

beforeAll(() => {
  // Radix tooltips measure their trigger; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

describe('QqqComposite', () => {
  const consoleError = vi.spyOn(console, 'error')
  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockClear()
  })

  it('renders the sample big number blocks with values, layouts and per-slot links', () => {
    const { container } = renderComposite(SAMPLE_BIG_NUMBERS, 'SampleBigNumberBlocksWidget')
    expect(screen.getByText('Big Number with Simple Context')).toBeInTheDocument()
    expect(screen.getByText('123', { selector: '[data-block-type="BIG_NUMBER"] *' })).toBeInTheDocument()
    expect(screen.getByText('12,345')).toBeInTheDocument()
    expect(screen.getByText('Number with Stacked Up/Down Context')).toBeInTheDocument()

    const layouts = [...container.querySelectorAll('[data-layout]')].map((el) => el.getAttribute('data-layout'))
    expect(layouts).toEqual(['FLEX_ROW_WRAPPED', 'FLEX_ROW_SPACE_BETWEEN', 'FLEX_ROW_SPACE_BETWEEN'])
    expect(container.querySelector('[data-layout="FLEX_ROW_WRAPPED"]')).toHaveClass('flex', 'flex-row', 'flex-wrap')
    expect(container.querySelector('[data-layout="FLEX_ROW_SPACE_BETWEEN"]')).toHaveClass('justify-between')

    // block-level link applies to every slot of the first big number
    const firstBig = container.querySelectorAll('[data-block-type="BIG_NUMBER"]')[0]
    for (const link of within(firstBig as HTMLElement).getAllByRole('link')) {
      expect(link).toHaveAttribute('href', '/same-link-for-all-parts')
    }
    // per-slot link on the up/down number; its context slot has no link
    const upDown = container.querySelectorAll('[data-block-type="UP_OR_DOWN_NUMBER"]')[0] as HTMLElement
    expect(within(upDown).getByRole('link')).toHaveAttribute('href', '/custom-link-per-slot')
    expect(within(upDown).getByRole('link')).toHaveTextContent('12,345')
    expect(upDown).toHaveAttribute('data-direction', 'down')
    expect(within(upDown).getByText('12,345').parentElement).toHaveStyle({ color: 'rgb(0, 0, 255)' })

    // stacked up/down number is green and in a column
    const stacked = container.querySelectorAll('[data-block-type="UP_OR_DOWN_NUMBER"]')[1] as HTMLElement
    expect(stacked).toHaveClass('flex-col')
    expect(stacked).toHaveAttribute('data-direction', 'up')
    expect(within(stacked).getByText('123').parentElement).toHaveStyle({ color: '#2BA83F' })
  })

  it('exposes block and per-slot tooltips as accessible descriptions and shows them on focus', async () => {
    renderComposite(SAMPLE_BIG_NUMBERS, 'SampleBigNumberBlocksWidget')
    const numberLink = screen.getByRole('link', { name: /12,345/ })
    expect(numberLink).toHaveAccessibleDescription('This number has a customized color')
    const context = screen.getAllByText('context')[1].closest('[data-block-slot]') as HTMLElement
    expect(context).toHaveAccessibleDescription('You can do a custom tooltip for each slot')
    const headingLink = screen.getByRole('link', { name: 'Big Number with Simple Context' })
    expect(headingLink).toHaveAccessibleDescription('You can have the same tooltip for all parts')

    fireEvent.focus(numberLink)
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('This number has a customized color')
  })

  it('renders every block type from the owned fixture payload', () => {
    const { container, actionCallback } = renderComposite(ALL_BLOCKS)
    const types = new Set([...container.querySelectorAll('[data-block-type]')].map((el) => el.getAttribute('data-block-type')))
    expect([...types].sort()).toEqual(['AUDIO', 'BIG_NUMBER', 'BUTTON', 'COMPOSITE', 'DIVIDER', 'ICON', 'IMAGE', 'INPUT_FIELD',
      'NUMBER_ICON_BADGE', 'PROGRESS_BAR', 'TABLE_SUB_ROW_DETAIL_ROW', 'TEXT', 'UP_OR_DOWN_NUMBER'])
    expect(container.querySelector('[data-qqq-id="block-big_number-accBlocks"]')).toBeInTheDocument()

    // TEXT: two lines, alert format, standard color, title size, bold
    const textBlock = container.querySelector('[data-block-id="ownedText"]') as HTMLElement
    expect(within(textBlock).getByText('Owned text line one')).toBeInTheDocument()
    expect(within(textBlock).getByText('Owned text line two')).toBeInTheDocument()
    expect(textBlock).toHaveAttribute('data-format', 'alert')
    expect(textBlock).toHaveStyle({ border: '1px solid #2BA83F', borderRadius: '0.5rem' })
    const textSpan = within(textBlock).getByText('Owned text line one').closest('span[style]') as HTMLElement
    expect(textSpan).toHaveStyle({ fontSize: '1.5rem', fontWeight: '700', color: '#2BA83F' })

    // BIG_NUMBER with block link + tooltip, colored number
    expect(screen.getByText('4,321')).toHaveStyle({ color: '#8F00D8' })
    expect(screen.getByRole('link', { name: '4,321' })).toHaveAttribute('href', '/app/person')

    // UP_OR_DOWN_NUMBER: up but not good -> red
    expect(screen.getByText('17%').parentElement).toHaveStyle({ color: '#FB4141' })

    // NUMBER_ICON_BADGE and ICON inside a badges wrapper
    const badges = container.querySelector('[data-layout="BADGES_WRAPPER"]') as HTMLElement
    expect(badges).toHaveClass('rounded-lg', 'border')
    expect(within(badges).getByText('12')).toHaveStyle({ color: '#2BA83F' })
    expect(badges.querySelector('[data-icon-name="inventory"]')).toBeInTheDocument()
    expect(badges.querySelector('[data-icon-name="star"]')).toHaveStyle({ color: '#FF8000', fontSize: '24px' })

    // TABLE_SUB_ROW_DETAIL_ROW
    expect(screen.getByText('Owned detail label')).toHaveStyle({ color: '#546E7A' })
    expect(screen.getByText('Owned detail value')).toHaveStyle({ color: '#0062FF' })
    expect(container.querySelector('[data-layout="TABLE_SUB_ROW_DETAILS"]')).toHaveClass('flex-col', 'border-r')

    // PROGRESS_BAR
    const bar = screen.getByRole('progressbar', { name: 'Owned progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '62.5')
    expect(bar.querySelector('[data-block-part="bar-fill"]')).toHaveStyle({ width: '62.5%', background: '#10B8A6' })
    expect(screen.getByText('62.5%')).toBeInTheDocument()

    // DIVIDER
    expect(container.querySelector('hr[data-block-type="DIVIDER"]')).toBeInTheDocument()

    // FLEX_ROW_SPACE_BETWEEN / FLEX_ROW_CENTER / FLEX_ROW / FLEX_COLUMN
    expect(screen.getByText('Owned left')).toBeInTheDocument()
    expect(screen.getByText('Owned right')).toBeInTheDocument()
    expect(container.querySelector('[data-layout="FLEX_ROW_CENTER"]')).toHaveClass('justify-center', 'flex-wrap')
    expect(container.querySelector('[data-layout="FLEX_ROW"]')).toHaveClass('flex-row')
    expect(container.querySelector('[data-layout="FLEX_COLUMN"]')).toHaveClass('flex-col')

    // IMAGE and AUDIO
    const image = screen.getByRole('img', { name: 'Owned image' })
    expect(image).toHaveAttribute('src', 'http://127.0.0.1:9/owned-image.png')
    expect(image).toHaveStyle({ width: '32px', height: '32px' })
    const audio = container.querySelector('audio') as HTMLAudioElement
    expect(audio).toHaveAttribute('src', 'http://127.0.0.1:9/owned-audio.wav')
    expect(audio.controls).toBe(true)
    expect(audio.autoplay).toBe(false)

    // INPUT_FIELD and BUTTON
    const input = screen.getByLabelText('Owned message')
    expect(input).toHaveAttribute('placeholder', 'Type an owned message')
    expect(input).toHaveAttribute('aria-required', 'true')
    const button = screen.getByRole('button', { name: 'Submit owned' })
    expect(button).toHaveAttribute('data-format', 'outlined')
    fireEvent.click(button)
    expect(actionCallback).toHaveBeenCalledWith(
      expect.objectContaining({ blockTypeName: 'BUTTON' }),
      { label: 'Submit owned', actionCode: 'owned-submit' },
    )
  })

  it('submits an input block on Enter, skips a blank required value, and routes ->actionCode', () => {
    const data: QqqCompositeData = {
      blocks: [{ blockTypeName: 'INPUT_FIELD', values: { fieldMetaData: { name: 'ownedMessage', label: 'Owned message', isRequired: true }, submitOnEnter: true } }],
    }
    const { actionCallback } = renderComposite(data)
    const input = screen.getByLabelText('Owned message')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(actionCallback).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '  By enter  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(actionCallback).toHaveBeenLastCalledWith(expect.objectContaining({ blockTypeName: 'INPUT_FIELD' }), { ownedMessage: 'By enter' })

    fireEvent.change(input, { target: { value: '->owned-code' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(actionCallback).toHaveBeenLastCalledWith(expect.anything(), { actionCode: 'owned-code', _fieldToClearIfError: 'ownedMessage' })
    expect(actionCallback).toHaveBeenCalledTimes(2)
  })

  it('does not submit on Enter unless submitOnEnter is set', () => {
    const data: QqqCompositeData = { blocks: [{ blockTypeName: 'INPUT_FIELD', values: { fieldMetaData: { name: 'note', label: 'Note' } } }] }
    const { actionCallback } = renderComposite(data)
    const input = screen.getByLabelText('Note')
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(actionCallback).not.toHaveBeenCalled()
  })

  it('renders a default button label and text/filled formats', () => {
    const data: QqqCompositeData = {
      blocks: [
        { blockTypeName: 'BUTTON', values: {} },
        { blockTypeName: 'BUTTON', values: { label: 'Text owned' }, styles: { format: 'text' } },
      ],
    }
    renderComposite(data)
    expect(screen.getByRole('button', { name: 'Button' })).toHaveAttribute('data-format', 'filled')
    expect(screen.getByRole('button', { name: 'Text owned' })).toHaveAttribute('data-format', 'text')
  })

  it('shows a contained warning for an unsupported block type beside its neighbors', () => {
    const data: QqqCompositeData = {
      blocks: [{ blockTypeName: 'OWNED_UNKNOWN', values: { number: '9' } }, { blockTypeName: 'TEXT', values: { text: 'Still here' } }],
      blockTypeName: 'COMPOSITE',
    }
    renderComposite(data, 'accBlocksUnknown')
    expect(screen.getByRole('alert')).toHaveTextContent('Unsupported block type: OWNED_UNKNOWN')
    expect(screen.getByText('Still here')).toBeInTheDocument()
  })

  it('renders a single leaf block payload as that block (Material block widget and table cell)', () => {
    const { container } = renderComposite({ blockTypeName: 'TEXT', values: { text: 'Leaf only' } } as unknown as QqqCompositeData, 'accLeafBlock')
    expect(screen.getByText('Leaf only')).toBeInTheDocument()
    expect(container.querySelector('[data-block-type="COMPOSITE"]')).toBeNull()
    expect(container.querySelector('[data-block-type="TEXT"]')).toBeInTheDocument()
  })

  it('renders a payload notice instead of throwing for malformed blocks', () => {
    renderComposite({ blocks: { invalidShape: true } as unknown as QqqCompositeData['blocks'] }, 'accMalformedComposite')
    expect(screen.getByRole('alert')).toHaveTextContent('The composite widget data is not in the expected format (blocks).')
  })

  it('renders a notice for a non-object entry and an empty container for no blocks', () => {
    const { container, unmount } = renderComposite({ blocks: ['junk' as unknown as QqqCompositeData] })
    expect(screen.getByRole('alert')).toHaveTextContent('(blocks[0])')
    unmount()
    const empty = renderComposite({ blockTypeName: 'COMPOSITE' }, 'accEmptyComposite')
    const root = empty.container.querySelector('[data-qqq-id="block-composite-accEmptyComposite"]')
    expect(root).toBeInTheDocument()
    expect(root?.childElementCount).toBe(0)
    expect(container).toBeTruthy()
  })

  it('applies style overrides, background, padding and overlay html', () => {
    const data: QqqCompositeData = {
      blocks: [{ blockTypeName: 'TEXT', values: { text: 'Styled' } }],
      styleOverrides: { 'border-radius': '4px', gap: '3px' },
      styles: { backgroundColor: 'INFO', padding: { top: 1, bottom: 2, left: 3, right: 4 } },
      overlayHtml: '<b>Owned overlay</b>',
    }
    const { container } = renderComposite(data)
    const root = container.querySelector('[data-block-type="COMPOSITE"]') as HTMLElement
    expect(root).toHaveStyle({ borderRadius: '4px', gap: '3px', backgroundColor: '#458CFF', paddingTop: '1px', paddingBottom: '2px', paddingLeft: '3px', paddingRight: '4px' })
    expect(screen.getByText('Owned overlay').tagName).toBe('B')
  })

  it('renders a composite tooltip and text icons', async () => {
    const data: QqqCompositeData = {
      blocks: [{
        blockTypeName: 'TEXT', values: { text: 'Hover me', startIcon: { name: 'check' }, endIcon: { name: 'star' } },
        tooltip: { blockData: { blocks: [{ blockTypeName: 'TEXT', values: { text: 'Nested tooltip text' } }] } },
      }],
    }
    const { container } = renderComposite(data)
    expect(container.querySelector('[data-icon-name="check"]')).toBeInTheDocument()
    expect(container.querySelector('[data-icon-name="star"]')).toBeInTheDocument()
    fireEvent.focus(screen.getByText('Hover me').closest('[tabindex="0"]') as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Nested tooltip text')
  })

  it('maps standard and hex color names', () => {
    expect(blockColor('success')).toBe('#2BA83F')
    expect(blockColor('WARNING')).toBe('#FBA132')
    expect(blockColor('ERROR')).toBe('#FB4141')
    expect(blockColor('INFO')).toBe('#458CFF')
    expect(blockColor('MUTED')).toBe('#7b809a')
    expect(blockColor('A1B2C3')).toBe('#A1B2C3')
    expect(blockColor('rebeccapurple')).toBe('rebeccapurple')
    expect(blockColor(undefined)).toBeUndefined()
  })
})
