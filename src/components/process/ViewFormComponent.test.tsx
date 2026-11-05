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
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { QFieldMetaData } from '@/types'
import { ViewFormComponent } from './ViewFormComponent'
import { useProcessStep } from './ProcessStepContext'

vi.mock('./ProcessStepContext', () => ({ useProcessStep: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function field(name: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label: name, type: 'STRING', isRequired: false, isEditable: false, isHeavy: false, isHidden: false, adornments: [], ...extra }
}

function show(fields: QFieldMetaData[], values: Record<string, unknown>) {
  vi.mocked(useProcessStep).mockReturnValue({ step: { viewFields: fields }, values, processName: 'nativeAction' } as unknown as ReturnType<typeof useProcessStep>)
  return render(<QueryClientProvider client={new QueryClient()}><ViewFormComponent index={0} /></QueryClientProvider>)
}

describe('native process result adornments', () => {
  it('opens actual record links and hides absent navigation fields', () => {
    show([field('request', { adornments: [{ type: 'LINK', values: { toRecordFromTable: 'request' } }] }),
      field('absent', { adornments: [{ type: 'LINK', values: { toRecordFromTable: 'other' } }] }), field('state')], { request: 42, state: 'RETAINED' })
    expect(screen.getByRole('link', { name: '42' })).toHaveAttribute('href', '/app/request/42')
    expect(screen.queryByText('absent:')).not.toBeInTheDocument()
    expect(screen.getByText('RETAINED')).toBeVisible()
  })

  it('uses hidden companion metadata without showing capability URLs as links', () => {
    const result = show([field('file', { adornments: [{ type: 'LINK', values: { toRecordFromTableField: 'table' } }] }),
      field('table', { isHidden: true }), field('url', { adornments: [{ type: 'FILE_DOWNLOAD', values: { deliveryModeField: 'mode', fileNameField: 'name' } }] }),
      field('mode', { isHidden: true }), field('name', { isHidden: true })],
    { file: '7', table: 'retained', url: 'https://api.example/private-transfer', mode: 'AUTHENTICATED_FETCH', name: 'Packing.pdf' })
    expect(screen.getByRole('link', { name: '7' })).toHaveAttribute('href', '/app/retained/7')
    expect(screen.getByRole('button', { name: 'Download file' })).toBeEnabled()
    expect(result.container.innerHTML).not.toContain('https://api.example/private-transfer')
    expect(screen.queryByText('mode:')).not.toBeInTheDocument()
  })

  it('does not downgrade an unknown or missing delivery mode to a link', () => {
    const result = show([field('url', { adornments: [{ type: 'FILE_DOWNLOAD', values: { deliveryModeField: 'mode' } }, { type: 'FILE_PREVIEW' }] }),
      field('mode', { isHidden: true })], { url: 'https://api.example/private-transfer', mode: 'UNKNOWN' })
    expect(result.container.querySelector('a, img, iframe, button')).toBeNull()
  })
})
