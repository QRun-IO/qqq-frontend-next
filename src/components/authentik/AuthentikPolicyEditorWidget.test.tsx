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

const featurePayload = (overrides: Partial<PolicyEditorPayload> = {}): PolicyEditorPayload => payload({
  catalog: [{ app: 'content', label: 'Content', resources: [
    { name: 'person', label: 'People', kind: 'TABLE', actions: ['hasAccess', 'read', 'insert', 'edit', 'delete'], features: [
      { name: 'analyze', label: 'Analyze data' }, { name: 'comment', label: 'Comment' }, { name: 'attach', label: 'Attach files' },
    ] },
    { name: 'article', label: 'Articles', kind: 'TABLE', actions: ['read'], features: [{ name: 'write', label: 'Write' }] },
  ] }],
  ...overrides,
})

const documentFor = (actions: string[], resources = ['person']) => JSON.stringify({
  PolicySpec: 'qqq-iam', PolicyVersion: '1.0.0', Statement: [{ Effect: 'Allow', Action: actions, Resource: resources }],
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
  it('opens saved features, round-trips, and toggles explicit feature statements', async () => {
    const user = userEvent.setup()
    const { last } = setup(featurePayload({ document: documentFor(['analyze', 'comment']) }))
    expect(screen.getByLabelText('Analyze data: People')).toBeChecked()
    expect(screen.getByLabelText('Comment: People')).toBeChecked()
    expect(screen.getByText('2 statements; checked')).toBeInTheDocument()
    expect(JSON.parse(last()).Statement).toEqual([
      { Effect: 'Allow', Action: ['analyze'], Resource: ['person'] },
      { Effect: 'Allow', Action: ['comment'], Resource: ['person'] },
    ])
    await user.click(screen.getByLabelText('Attach files: People'))
    await user.click(screen.getByLabelText('Write: Articles'))
    await user.click(screen.getByLabelText('Comment: People'))
    expect(JSON.parse(last()).Statement).toEqual([
      { Effect: 'Allow', Action: ['analyze'], Resource: ['person'] },
      { Effect: 'Allow', Action: ['attach'], Resource: ['person'] },
      { Effect: 'Allow', Action: ['write'], Resource: ['article'] },
    ])
  })

  it('excludes features from wildcard grants and includes them in row and app selection', async () => {
    const user = userEvent.setup()
    setup(featurePayload({ document: documentFor(['*'], ['person', 'article']) }))
    expect(screen.getByLabelText('Read: People')).toBeChecked()
    expect(screen.getByLabelText('Analyze data: People')).not.toBeChecked()
    expect(screen.getByLabelText('Write: Articles')).not.toBeChecked()
    expect(screen.getByLabelText('All actions: People')).toHaveAttribute('aria-checked', 'mixed')
    await user.click(screen.getByLabelText('All actions: People'))
    expect(screen.getByLabelText('Analyze data: People')).toBeChecked()
    expect(screen.getByLabelText('Everything in Content')).toHaveAttribute('aria-checked', 'mixed')
    await user.click(screen.getByLabelText('Everything in Content'))
    expect(screen.getByLabelText('Write: Articles')).toBeChecked()
    expect(screen.getByLabelText('Everything in Content')).toBeChecked()
    await user.click(screen.getByLabelText('Everything in Content'))
    expect(screen.getByLabelText('Analyze data: People')).not.toBeChecked()
    expect(screen.getByLabelText('Write: Articles')).not.toBeChecked()
  })

  it('searches feature labels and preserves actions unknown for a particular resource', async () => {
    const user = userEvent.setup()
    const { last } = setup(featurePayload({ document: documentFor(['analyze', 'retiredFeature'], ['article', 'person']) }))
    const unknown = screen.getByRole('region', { name: 'Not in this app (3)' })
    expect(within(unknown).getByText('article.analyze')).toBeInTheDocument()
    expect(within(unknown).getByText('person.retiredFeature')).toBeInTheDocument()
    expect(last()).toContain('retiredFeature')
    await user.type(screen.getByLabelText('Find a resource'), 'Attach files')
    expect(screen.getByLabelText('Read: People')).toBeInTheDocument()
    expect(screen.queryByLabelText('Read: Articles')).not.toBeInTheDocument()
    await user.click(within(unknown).getByRole('button', { name: 'Remove all' }))
    expect(JSON.parse(last()).Statement).toEqual([{ Effect: 'Allow', Action: ['analyze'], Resource: ['person'] }])
  })

  it('previews the union with base permissions and differences against the saved policy', async () => {
    const user = userEvent.setup()
    const { container } = setup(featurePayload({ document: documentFor(['read', 'comment']), members: [
      { username: 'sam', label: 'Sam Example', viaGroups: ['Editors'], basePermissions: ['person.read', 'person.read', 'authentik.users.manage'] },
      { username: 'lee', label: 'Lee Example', viaGroups: [], basePermissions: ['person.comment', 'person.analyze'] },
    ], membersTruncated: true }))
    const preview = screen.getByRole('region', { name: 'Preview for a member' })
    expect(within(preview).getByText(/Only the first 200/)).toBeInTheDocument()
    expect(within(preview).queryByRole('list')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Member'), 'sam')
    expect(await within(preview).findByText('3 effective permissions')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Read: People'))
    await user.click(screen.getByLabelText('Comment: People'))
    await user.click(screen.getByLabelText('Analyze data: People'))
    expect(within(preview).getByText('3 effective permissions')).toBeInTheDocument()
    expect(within(preview).getByText('People: Analyze data').parentElement).toHaveTextContent('added by this edit')
    expect(within(preview).getByText('People: Comment').parentElement).toHaveTextContent('removed by this edit')
    expect(within(preview).getByText('People: Read').parentElement).not.toHaveTextContent('removed by this edit')
    expect(within(preview).getByText('authentik.users.manage')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Member'), 'lee')
    expect(await within(preview).findByText('2 effective permissions')).toBeInTheDocument()
    expect(within(preview).queryByText('added by this edit')).not.toBeInTheDocument()
    expect(within(preview).getByText('People: Read').parentElement).toHaveTextContent('removed by this edit')
    expect(await axe(container)).toHaveNoViolations()
  })

  it.each([undefined, []])('handles absent or empty members (%s) and mapper off', (members) => {
    setup(featurePayload({ members, mapperEnabled: false }))
    expect(screen.getByText('No members to preview')).toBeInTheDocument()
    expect(screen.getByText('Policies are not applied at sign-in on this instance (mapper off)')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Member' })).not.toBeInTheDocument()
  })

  it('renders long member permission lists in batches', async () => {
    const user = userEvent.setup()
    setup(featurePayload({ members: [{ username: 'sam', label: 'Sam Example', viaGroups: [], basePermissions: Array.from({ length: 125 }, (_, i) => `resource_${String(i).padStart(3, '0')}.read`) }] }))
    await user.selectOptions(screen.getByLabelText('Member'), 'sam')
    const preview = screen.getByRole('region', { name: 'Preview for a member' })
    expect(await within(preview).findByText('125 effective permissions')).toBeInTheDocument()
    expect(within(preview).queryByText('resource_124: Read')).not.toBeInTheDocument()
    await user.click(within(preview).getByRole('button', { name: 'Show more permissions' }))
    await user.click(within(preview).getByRole('button', { name: 'Show more permissions' }))
    expect(within(preview).getByText('resource_124: Read')).toBeInTheDocument()
    expect(within(preview).queryByRole('button', { name: 'Show more permissions' })).not.toBeInTheDocument()
  })

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
