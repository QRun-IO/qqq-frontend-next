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

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { QTableSection } from '@/types'
import { RecordViewSidebar } from './RecordViewSidebar'

describe('RecordViewSidebar', () => {
  it('lists visible section labels in metadata order and selects the matching section', async () => {
    const sections = [
      { name: 'identity', label: 'Identity', fieldNames: [], isHidden: false },
      { name: 'timeline', label: 'Timeline', fieldNames: [], isHidden: false },
    ] as QTableSection[]
    const navigate = vi.fn()
    render(<RecordViewSidebar sections={sections} onNavigate={navigate} />)
    expect(screen.getByRole('navigation', { name: 'Record sections', hidden: true })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { hidden: true }).map((button) => button.textContent)).toEqual(['Identity', 'Timeline'])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Timeline', hidden: true }))
    expect(navigate).toHaveBeenCalledWith(sections[1])
  })
})
