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
import { render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WidgetIcon, WidgetIconTile } from './WidgetIcon'

const examples = [
  ['3d_rotation', '\ue84d'], ['account_balance_wallet', '\ue850'],
  ['airline_seat_flat', '\ue630'], ['battery_6_bar', '\uebd2'],
  ['filter_9_plus', '\ue3da'], ['60fps', '\uefd4'],
]

describe('legacy widget glyphs', () => {
  it.each(examples)('renders the requested icon %s in blocks and tiles', async (name, glyph) => {
    const { container } = render(<><WidgetIcon name={name} color="#b91c1c" qqqId="block-icon" /><WidgetIconTile name={name} qqqId="tile-icon" /></>)
    await waitFor(() => expect(container.querySelectorAll('svg text')).toHaveLength(2))
    for (const text of container.querySelectorAll('svg text')) expect(text).toHaveTextContent(glyph)
    expect(container.querySelector('[data-qqq-id="block-icon"]')).toHaveStyle({ color: '#b91c1c' })
    expect(container.querySelector('[data-qqq-id="tile-icon"]')).toHaveAttribute('data-icon-name', name)
    expect(container.querySelectorAll('.lucide-circle')).toHaveLength(0)
  })

  it('retains widget-specific overrides and existing shared glyphs', () => {
    const { container } = render(<><WidgetIcon name="error" /><WidgetIconTile name="person" /></>)
    expect(container.querySelector('.lucide-triangle-alert')).not.toBeNull()
    expect(container.querySelector('.lucide-user')).not.toBeNull()
    expect(container.querySelector('text')).toBeNull()
  })

  it('keeps custom-image priority over valid font names', () => {
    const { container } = render(<WidgetIconTile name="3d_rotation" path="/custom.svg" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/custom.svg')
    expect(container.querySelector('svg')).toBeNull()
  })

  it.each(['not_a_real_icon', '__proto__', 'constructor'])('keeps a safe generic fallback for %s', async (name) => {
    const { container } = render(<><WidgetIcon name="3d_rotation" /><WidgetIcon name={name} /><WidgetIconTile name={name} /></>)
    // A known glyph proves the shared lazy resolver has loaded, beyond its circle fallback.
    await waitFor(() => expect(container.querySelector('svg text')).toHaveTextContent('\ue84d'))
    expect(container.querySelectorAll('.lucide-circle')).toHaveLength(2)
  })
})
