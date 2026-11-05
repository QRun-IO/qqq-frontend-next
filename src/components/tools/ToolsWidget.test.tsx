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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import type { QInstance } from '@/types'
import ToolsWidget from './ToolsWidget'
import { connectionUrl, toolsTarget } from './tools-catalog'
import backendCatalog from '../../../tests/e2e/fixtures/tools-catalog.json'

const metadata = {
  apps: {},
  appTree: [],
  widgets: {},
  tables: {},
  processes: {},
  reports: {},
  branding: {},
} as QInstance
vi.mock('@/lib/hooks/use-metadata', () => ({ useMetaData: () => ({ data: metadata }) }))
const terminal = {
  id: 'terminal',
  label: 'CLI & Terminal UI',
  summary: 'Use QQQ from a terminal.',
  platforms: 'Windows, macOS and Linux',
  available: true,
  downloadUrl: 'https://example.test/releases',
  downloadLabel: 'Get CLI & TUI',
  guideUrl: 'https://example.test/guide',
  note: 'Standalone includes both.',
  steps: ['Install the client.', 'Sign in.'],
  commands: ['qqq login --server {server}', 'qqq ui'],
  manageApp: 'printing',
}
const payload = {
  serverUrl: 'https://example.test/customer',
  tools: [terminal, { ...terminal, id: 'scanner', label: 'Mobile Scanners', available: false }],
}

describe('Tools', () => {
  it('renders the actual Java payload with omitted empty command lists', () => {
    render(<ToolsWidget data={backendCatalog} />)
    expect(screen.getByRole('button', { name: 'Set up Print Client' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set up Mobile Scanners' })).toBeInTheDocument()
  })
  it('renders available downloads, collapses unavailable tools and copies an instance-specific sign-in command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { container } = render(<ToolsWidget data={payload} />)
    expect(screen.getByRole('link', { name: /Get CLI/ })).toHaveAttribute(
      'href',
      'https://example.test/releases'
    )
    expect(container.querySelector('[data-qqq-id="tools-unavailable"]')).not.toHaveAttribute('open')
    expect(container.querySelector('[data-qqq-id="tools-card-scanner"] a')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Set up CLI & Terminal UI' }))
    fireEvent.click(screen.getByLabelText('Copy CLI & Terminal UI command 1'))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('qqq login --server "https://example.test/customer"')
    )
    expect(screen.queryByText(/Open Printing/)).not.toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('switches the setup workspace without hiding other tools', () => {
    render(<ToolsWidget data={backendCatalog} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set up Print Client' }))
    expect(screen.getByRole('heading', { name: 'Print Client' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Get Print Client/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set up CLI & Terminal UI' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Set up Mobile Scanners' }))
    expect(screen.getByRole('heading', { name: 'Mobile Scanners' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Get Print Client/ })).not.toBeInTheDocument()
  })

  it('switches platform installers and copies the selected command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<ToolsWidget data={backendCatalog} />)
    fireEvent.change(screen.getByLabelText('Install platform'), { target: { value: 'windows' } })
    expect(screen.getByText('scoop install qqq')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Copy Scoop install command 2'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('scoop install qqq'))
    fireEvent.change(screen.getByLabelText('Install platform'), { target: { value: 'macos' } })
    expect(screen.getByText('brew install qrun-io/tap/qqq')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Install method'), {
      target: { value: 'curl installer' },
    })
    expect(screen.getByText(/curl -fsSL/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Install platform'), { target: { value: 'linux' } })
    expect(screen.getByLabelText('Install method')).toHaveValue('curl installer')
  })

  it('copies complete printer and mobile installer scripts with preserved newlines', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<ToolsWidget data={backendCatalog} />)
    for (const [label, id] of [
      ['Print Client', 'printing'],
      ['Mobile Scanners', 'scanner'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name: `Set up ${label}` }))
      fireEvent.change(screen.getByLabelText('Install platform'), { target: { value: 'windows' } })
      fireEvent.click(screen.getByRole('button', { name: 'Copy install script' }))
      const script = backendCatalog.tools.find((tool) => tool.id === id)!.installOptions[0]
        .commands![0]
      await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(script))
      expect(script).toContain('\n')
    }
    fireEvent.change(screen.getByLabelText('Install platform'), { target: { value: 'android' } })
    expect(screen.queryByRole('button', { name: 'Copy install script' })).not.toBeInTheDocument()
    expect(screen.getByText(/In the handheld's Files app/)).toBeInTheDocument()
  })

  it('shows a recovery path when clipboard access fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    render(<ToolsWidget data={payload} />)
    fireEvent.click(screen.getByLabelText('Copy server address'))
    expect(
      await screen.findByText('Could not copy. Select and copy the text above.')
    ).toBeInTheDocument()
  })

  it('rejects malformed payloads and unsafe download links', () => {
    const view = render(<ToolsWidget data={{}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
    view.rerender(
      <ToolsWidget
        data={{ ...payload, tools: [{ ...terminal, downloadUrl: 'javascript:alert(1)' }] }}
      />
    )
    expect(screen.queryByRole('link', { name: /Get CLI/ })).not.toBeInTheDocument()
  })

  it('resolves public roots without losing proxy paths or accepting credentials and shell syntax', () => {
    expect(connectionUrl(null, '/tenant/qqq/v1', 'https://example.test')).toBe(
      'https://example.test/tenant'
    )
    expect(connectionUrl(null, 'https://api.test/qqq/v1/', 'https://example.test')).toBe(
      'https://api.test'
    )
    expect(connectionUrl(null, '/unknown', 'https://example.test')).toBeUndefined()
    expect(connectionUrl(null, '/qqq/v1', 'http://localhost:8077')).toBe('http://localhost:8077')
    for (const value of [
      'https://user:pass@example.test',
      'https://example.test?token=secret',
      'http://example.test',
      'https://example.test/$HOME',
    ]) {
      expect(connectionUrl(value, '/qqq/v1', 'https://example.test')).toBeUndefined()
    }
  })

  it('finds the menu shortcut by visible widget metadata, including renamed apps', () => {
    const instance = {
      ...metadata,
      apps: { downloads: { name: 'downloads', label: 'Company Tools', widgets: ['catalog'] } },
      widgets: {
        catalog: { name: 'catalog', label: 'Tools', type: 'QQQ_TOOLS', hasPermission: true },
      },
      appTree: [{ name: 'downloads', label: 'Company Tools', type: 'APP' as const }],
    }
    expect(toolsTarget(instance)?.path).toBe('/app/downloads')
    expect(toolsTarget({ ...instance, appTree: [] })).toBeUndefined()
    instance.widgets.catalog.hasPermission = false
    expect(toolsTarget(instance)).toBeUndefined()
  })
})
