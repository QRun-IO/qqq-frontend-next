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
// #/createChild= dialog on a phone (QRun-IO/qqq#708): it keeps a margin at the screen edges.

import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { CreateChildFromLinkDialog } from './CreateChildFromLinkDialog'

vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: () => ({ data: undefined, isError: false, isLoading: true }) }))
vi.mock('@/lib/api/metadata', () => ({ loadMetaData: () => new Promise(() => undefined) }))

describe('CreateChildFromLinkDialog layout', () => {
  it('keeps a margin at the screen edges and scrolls inside on a phone', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CreateChildFromLinkDialog tableName="pet" presets={{ defaultValues: {}, disabledFields: [] }} onClose={vi.fn()} onCreated={vi.fn()} />
      </QueryClientProvider>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-qqq-id', 'dialog-create-child-pet')
    expect(dialog).toHaveClass('w-[calc(100%-2rem)]', 'max-w-xl', 'max-h-[85vh]')
    expect(dialog).not.toHaveClass('w-full')
  })
})
