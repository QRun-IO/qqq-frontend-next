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

/** @file Isolated and unknown modes never mount legacy script actions. */

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptViewer } from './ScriptViewer'

vi.mock('./IsolatedScriptEditor', () => ({ IsolatedScriptEditor: ({ scriptId }: { scriptId: number }) => <div>Isolated project {scriptId}</div> }))

/**
 * Render without a QueryClient; any legacy viewer mount would try to use it.
 * @param mode - Stored server-controlled execution mode.
 */
function mount(mode: string) {
  render(<ScriptViewer idKey="example" label="Script" scriptId={7} script={{ tableName: 'script', values: { id: 7, executionMode: mode } }}
    canEdit canTest logs={{ queryKey: () => [], load: async () => [] }} onChanged={async () => undefined} />)
}

describe('script execution mode routing', () => {
  it('routes isolated source directly to the isolated editor', () => {
    mount('ISOLATED')
    expect(screen.getByText('Isolated project 7')).toBeVisible()
    expect(screen.queryByText('Edit and Activate')).not.toBeInTheDocument()
  })
  it('fails closed on unknown execution modes', () => {
    mount('FUTURE_MODE')
    expect(screen.getByRole('alert')).toHaveTextContent('not supported')
  })
})
