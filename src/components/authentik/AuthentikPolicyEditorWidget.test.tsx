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

// Tests for the AUTHENTIK_POLICY_EDITOR widget: matrix, select-all, search, unknowns, JSON output

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import type { QWidgetMetaData } from '@/types'
import { WidgetRenderer } from '@/components/widgets/WidgetRenderer'
import { AuthentikPolicyEditorWidget, isPolicyPermission } from './AuthentikPolicyEditorWidget'
import type { PolicyEditorPayload } from './AuthentikPolicyEditorWidget'

const widget = { name: 'authentikPolicyEditor', type: 'AUTHENTIK_POLICY_EDITOR', label: 'Policy' } as unknown as QWidgetMetaData

const payload = (overrides: Partial<PolicyEditorPayload> = {}): PolicyEditorPayload => ({
  spec: 'qqq-iam',
  version: '1.0.0',
  groupLabel: 'editors',
  catalog: [
    {
      app: 'content',
      label: 'Content',
      resources: [
        { name: 'content', label: 'Content', kind: 'APP', actions: ['hasAccess'] },
        { name: 'cms_page', label: 'Pages', kind: 'TABLE', actions: ['read', 'insert', 'edit', 'delete'] },
        { name: 'publishPage', label: 'Publish Page (Pages action)', kind: 'PROCESS', actions: ['hasAccess'] },
      ],
    },
    {
      app: null,
      label: 'Other',
      resources: [{ name: 'audit_log', label: 'Audit Log', kind: 'TABLE', actions: ['read'], note: 'Read only.' }],
    },
  ],
  document: '',
  ...overrides,
})

/**
 * Render the editor and capture what it hands the step.
 * @param data - Payload.
 * @returns The callback mock.
 */
function setup(data: PolicyEditorPayload) {
  const onWidgetData = vi.fn()
  const view = render(<AuthentikPolicyEditorWidget widgetMetaData={widget} data={data as unknown as Record<string, unknown>} onWidgetData={onWidgetData} />)
  const last = () => String(onWidgetData.mock.calls.at(-1)?.[0]?.policyDocument ?? '')
  return { onWidgetData, last, ...view }
}

describe('AuthentikPolicyEditorWidget', () => {
  it('starts from the existing document and hands the canonical JSON to the step', async () => {
    const { last } = setup(payload({ document: '{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[{"Effect":"Allow","Action":["*"],"Resource":["cms_page"]}]}' }))
    expect(screen.getByLabelText('Read: Pages')).toBeChecked()
    expect(screen.getByLabelText('Delete: Pages')).toBeChecked()
    expect(screen.getByLabelText('Access: Content')).not.toBeChecked()
    await waitFor(() => expect(last()).toContain('"Action":["read"],"Resource":["cms_page"]'))
    // the hasAccess grant on a table that does not offer it is kept, and listed as unknown
    expect(screen.getByText('cms_page.hasAccess')).toBeInTheDocument()
  })

  it('toggles a cell, a row, a column and an app', async () => {
    const user = userEvent.setup()
    const { last } = setup(payload())

    await user.click(screen.getByLabelText('Access: Content'))
    await waitFor(() => expect(last()).toContain('"Action":["hasAccess"],"Resource":["content"]'))

    await user.click(screen.getByLabelText('All actions: Pages'))
    for (const action of ['Read', 'Insert', 'Edit', 'Delete']) expect(screen.getByLabelText(`${action}: Pages`)).toBeChecked()

    await user.click(screen.getByLabelText('Access for everything in Content'))
    expect(screen.getByLabelText('Access: Publish Page (Pages action)')).toBeChecked()

    await user.click(screen.getByLabelText('Everything in Content'))
    expect(screen.getByLabelText('Access: Content')).not.toBeChecked()
    expect(screen.getByLabelText('Read: Pages')).not.toBeChecked()

    await user.click(screen.getByLabelText('Everything in Content'))
    expect(screen.getByText('6 permissions selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByText('0 permissions selected')).toBeInTheDocument()
    await waitFor(() => expect(last()).toBe('{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[]}'))
  })

  it('shows the mixed state on partial selections', async () => {
    const user = userEvent.setup()
    setup(payload())
    await user.click(screen.getByLabelText('Read: Pages'))
    expect(screen.getByLabelText('All actions: Pages')).toHaveAttribute('aria-checked', 'mixed')
    expect(screen.getByLabelText('Everything in Content')).toHaveAttribute('aria-checked', 'mixed')
  })

  it('filters by search and keeps hidden selections', async () => {
    const user = userEvent.setup()
    setup(payload({ document: '{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[{"Effect":"Allow","Action":["read"],"Resource":["audit_log"]}]}' }))
    await user.type(screen.getByLabelText('Find a resource'), 'publish')
    expect(screen.getByLabelText('Access: Publish Page (Pages action)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Read: Audit Log')).not.toBeInTheDocument()
    expect(screen.getByText('1 permission selected')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Find a resource'))
    await user.type(screen.getByLabelText('Find a resource'), 'zzz')
    expect(screen.getByText('No resource matches the search.')).toBeInTheDocument()
  })

  it('lists unknown resources and removes them', async () => {
    const user = userEvent.setup()
    const { last } = setup(payload({ document: '{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[{"Effect":"Allow","Action":["read"],"Resource":["gone_table","cms_page"]}]}' }))
    const unknown = screen.getByRole('region', { name: 'Not in this app (1)' })
    expect(within(unknown).getByText('gone_table.read')).toBeInTheDocument()
    await waitFor(() => expect(last()).toContain('"gone_table"'))
    await user.click(within(unknown).getByRole('button', { name: 'Remove gone_table.read' }))
    expect(screen.queryByRole('region', { name: /Not in this app/ })).not.toBeInTheDocument()
    await waitFor(() => expect(last()).not.toContain('gone_table'))
  })

  it('reports an invalid stored document and a change made in Authentik', () => {
    setup(payload({ document: '{"PolicySpec":"other","PolicyVersion":"1.0.0"}', changedInAuthentik: true }))
    expect(screen.getByRole('alert')).toHaveTextContent('PolicySpec must be "qqq-iam"')
    expect(screen.getByRole('status')).toHaveTextContent('changed in Authentik')
    expect(screen.getByText('0 permissions selected')).toBeInTheDocument()
  })

  it('shows the JSON preview and the check', () => {
    setup(payload())
    expect(screen.getByLabelText('Policy document JSON').textContent).toContain('"PolicySpec": "qqq-iam"')
    expect(screen.getByText('0 statements; checked')).toBeInTheDocument()
  })

  it('writes to a custom output field', async () => {
    const onWidgetData = vi.fn()
    render(<AuthentikPolicyEditorWidget widgetMetaData={widget} data={payload({ outputFieldName: 'doc' }) as unknown as Record<string, unknown>} onWidgetData={onWidgetData} />)
    await waitFor(() => expect(onWidgetData).toHaveBeenCalledWith({ doc: expect.stringContaining('qqq-iam') }))
  })

  it('reports a malformed payload', () => {
    render(<AuthentikPolicyEditorWidget widgetMetaData={widget} data={{ catalog: [] }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('not in the expected format')
  })

  it('is rendered lazily by WidgetRenderer', async () => {
    render(<WidgetRenderer widgetMetaData={widget} data={payload() as unknown as Record<string, unknown>} />)
    expect(await screen.findByLabelText('Read: Pages')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = setup(payload({ document: '{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[{"Effect":"Allow","Action":["read"],"Resource":["gone"]}]}' }))
    expect(await axe(container)).toHaveNoViolations()
  })

  it('knows a policy permission', () => {
    expect(isPolicyPermission('a.read')).toBe(true)
    expect(isPolicyPermission('a.b.read')).toBe(false)
  })
})
