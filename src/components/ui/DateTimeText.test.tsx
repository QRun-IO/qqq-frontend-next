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
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DateTimeText } from './DateTimeText'

afterEach(() => {
  vi.useRealTimers()
})

describe('DateTimeText', () => {
  it('renders one compact, unwrapped line with the full timestamp as its tooltip', () => {
    render(<DateTimeText type="DATE_TIME" value="2024-03-10T08:30:00Z" dataQqqId="when" />)
    const time = screen.getByText(/2024/)
    expect(time.tagName).toBe('TIME')
    expect(time.textContent).toMatch(/^Mar (9|10), 2024$/)
    expect(time).toHaveAttribute('dateTime', '2024-03-10T08:30:00.000Z')
    expect(time.getAttribute('title')).toMatch(/^2024-03-(09|10) \d{2}:30:00 [AP]M \S+$/)
    expect(time).toHaveClass('whitespace-nowrap')
    expect(time).toHaveAttribute('data-qqq-id', 'when')
  })

  it('shows recent activity as relative time when asked', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-11T16:20:00Z'))
    render(<DateTimeText type="DATE_TIME" value="2026-10-11T13:20:00Z" relative />)
    expect(screen.getByText('3h ago')).toBeInTheDocument()
  })

  it('never shows a time for a DATE and shows a dash for an empty value', () => {
    const { container } = render(<><DateTimeText type="DATE" value="2024-06-15" /><DateTimeText type="DATE" value={null} /></>)
    expect(screen.getByText('Jun 15, 2024')).toHaveAttribute('dateTime', '2024-06-15')
    expect(container).toHaveTextContent('—')
  })
})
