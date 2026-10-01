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

// The Material QFMD bridge, live qContext and React globals for customComponent widgets (QRun-IO/qqq#728, WID-072)

import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render as renderUi, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api/metadata', () => ({
  loadMetaData: vi.fn(async () => ({ tables: {}, widgets: { accHealthy: { name: 'accHealthy', label: 'Healthy Neighbor', type: 'html', hasPermission: true } } })),
}))
vi.mock('./ConnectedWidget', () => ({
  ConnectedWidget: ({ widgetMetaData, params }: { widgetMetaData: { label: string }; params: Record<string, unknown> }) => (
    <div data-testid="connected">{widgetMetaData.label} {JSON.stringify(params)}</div>
  ),
}))

import type { QWidgetMetaData } from '@/types'
import { QContextProvider, useQContext } from '@/lib/context/q-context'
import { exposeReactGlobals, qfmdBridge } from './qfmd-bridge'
import { QqqCustomComponentWidget } from './QqqContainerWidgets'

/**
 * Renders with a query client.
 *
 * @param ui - Element to render.
 * @returns The render result.
 */
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderUi(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).OwnedBridgeComponent
})

describe('qfmdBridge', () => {
  it('makes alerts with lines and colors, closable on request', () => {
    render(<div>{qfmdBridge.makeAlert('Owned line one\nOwned line two', 'success', true)}{qfmdBridge.makeAlert('Owned error', 'error')}</div>)
    const alerts = screen.getAllByRole('alert')
    expect(alerts[0]).toHaveAttribute('data-color', 'success')
    expect(alerts[0].textContent).toContain('Owned line oneOwned line two')
    expect(alerts[1]).toHaveAttribute('data-color', 'error')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('makes full-width buttons that call back and honor disabled', () => {
    const onClick = vi.fn()
    render(<div>{qfmdBridge.makeButton('Owned bridge button', onClick)}{qfmdBridge.makeButton('Owned disabled', vi.fn(), { disabled: true })}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'Owned bridge button' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Owned disabled' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Owned bridge button' })).toHaveClass('w-full')
  })

  it('makes a form seeded from a Material record that reports changes and submits its values', async () => {
    const handleChange = vi.fn()
    const handleSubmit = vi.fn()
    const record = { values: new Map<string, unknown>([['ownedName', 'Initial owned']]) }
    render(qfmdBridge.makeForm([{ name: 'ownedName', label: 'Owned Name', type: 'STRING' }, { name: 'ownedCount', label: 'Owned Count', type: 'INTEGER', defaultValue: 3 }],
      record, handleChange, handleSubmit))
    const name = screen.getByLabelText(/Owned Name/)
    expect(name).toHaveValue('Initial owned')
    expect(screen.getByLabelText(/Owned Count/)).toHaveValue(3)
    fireEvent.change(name, { target: { value: 'Changed owned' } })
    await waitFor(() => expect(handleChange).toHaveBeenCalledWith('ownedName', 'Changed owned'))
    fireEvent.submit(screen.getByLabelText(/Owned Name/).closest('form') as HTMLFormElement)
    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1))
    expect(handleSubmit.mock.calls[0][0]).toMatchObject({ ownedName: 'Changed owned' })
  })

  it('makes an open modal that closes through onClose with the reason', () => {
    const onClose = vi.fn((setIsOpen: (open: boolean) => void) => setIsOpen(false))
    render(qfmdBridge.makeModal(<p>Owned bridge modal</p>, onClose))
    expect(screen.getByRole('dialog')).toHaveTextContent('Owned bridge modal')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledWith(expect.any(Function), expect.anything(), 'escapeKeyDown')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('makes an instance widget, loaded for the record', async () => {
    render(qfmdBridge.makeWidget('accHealthy', 'person', '7', { values: { name: 'Owned' } }))
    expect(await screen.findByTestId('connected')).toHaveTextContent('Healthy Neighbor {"name":"Owned","id":"7","tableName":"person"}')
    render(qfmdBridge.makeWidget('accMissing'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Could not load widget [accMissing]')
  })

  it('exposes React and ReactDOM for bundles', () => {
    exposeReactGlobals()
    const globals = window as unknown as { React: typeof React; ReactDOM: { createRoot: unknown; createPortal: unknown } }
    expect(globals.React).toBe(React)
    expect(typeof globals.ReactDOM.createRoot).toBe('function')
    expect(typeof globals.ReactDOM.createPortal).toBe('function')
  })
})

describe('customComponent widget', () => {
  it('passes the bridge and the live QContext to the loaded component', async () => {
    const meta: QWidgetMetaData = { name: 'accBridge', label: 'Owned Bridge', type: 'customComponent', hasPermission: true,
      defaultValues: { componentName: 'OwnedBridgeComponent', componentSourceUrl: 'http://127.0.0.1:9/owned-bridge.js' } }

    /**
     * Sets the accent color, as the dashboard layout does after metadata loads.
     *
     * @returns Nothing visible.
     */
    function Accent() {
      const { setAccentColor } = useQContext()
      return <button type="button" onClick={() => setAccentColor('#123456')}>Recolor</button>
    }

    render(<QContextProvider><Accent /><QqqCustomComponentWidget widgetMetaData={meta} data={{ footerHTML: 'owned' }} /></QContextProvider>)
    const script = document.head.querySelector('script[src="http://127.0.0.1:9/owned-bridge.js"]') as HTMLScriptElement
    expect(script).toBeInTheDocument()
    // the bundle registers itself, built on the shared window.React, and uses the bridge and context
    ;(window as unknown as Record<string, unknown>).OwnedBridgeComponent = {
      OwnedBridgeComponent: ({ qfmdBridge: bridge, qContext, props }: { qfmdBridge: typeof qfmdBridge; qContext: { accentColor: string }; props: { widgetData: { footerHTML: string } } }) => {
        const R = (window as unknown as { React: typeof React }).React
        const [count, setCount] = R.useState(0)
        return R.createElement('div', null,
          bridge.makeAlert(`Owned alert ${props.widgetData.footerHTML}`, 'info'),
          bridge.makeButton(`Clicked ${count}`, () => setCount(count + 1)),
          R.createElement('span', { 'data-testid': 'accent' }, qContext.accentColor))
      },
    }
    await act(async () => { script.dispatchEvent(new Event('load')) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Owned alert owned')
    fireEvent.click(screen.getByRole('button', { name: 'Clicked 0' }))
    expect(screen.getByRole('button', { name: 'Clicked 1' })).toBeInTheDocument()
    expect(screen.getByTestId('accent')).toHaveTextContent('#0062ff')
    fireEvent.click(screen.getByRole('button', { name: 'Recolor' }))
    expect(screen.getByTestId('accent')).toHaveTextContent('#123456')
  })
})
