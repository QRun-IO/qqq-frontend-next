/** q-context.test — unit tests for the QContextProvider and useQContext hook */
// Tests for QContext provider

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { QContextProvider, useQContext } from './q-context'

/**
 * Internal test helper that renders a subset of QContext values into the DOM
 * so that assertions can read them via `getByTestId`.
 *
 * Also exposes buttons to trigger state mutations (setPageHeader,
 * pushModalOnStack, popModalOffStack, clearModalStack).
 */
function TestConsumer() {
  const ctx = useQContext()
  return (
    <div>
      <span data-testid="page-header">{String(ctx.pageHeader)}</span>
      <span data-testid="accent-color">{ctx.accentColor}</span>
      <span data-testid="modal-stack">{ctx.modalStack.join(',')}</span>
      <button onClick={() => ctx.setPageHeader('New Header')}>Set Header</button>
      <button onClick={() => ctx.pushModalOnStack('modal-1')}>Push Modal</button>
      <button onClick={() => ctx.popModalOffStack('modal-1')}>Pop Modal</button>
      <button onClick={() => ctx.clearModalStack()}>Clear Modals</button>
    </div>
  )
}

describe('QContext', () => {
  it('should provide default values', () => {
    render(
      <QContextProvider>
        <TestConsumer />
      </QContextProvider>
    )

    expect(screen.getByTestId('page-header')).toHaveTextContent('')
    expect(screen.getByTestId('accent-color')).toHaveTextContent('#0062ff')
    expect(screen.getByTestId('modal-stack')).toHaveTextContent('')
  })

  it('should update pageHeader', async () => {
    const user = userEvent.setup()
    render(
      <QContextProvider>
        <TestConsumer />
      </QContextProvider>
    )

    await user.click(screen.getByText('Set Header'))
    expect(screen.getByTestId('page-header')).toHaveTextContent('New Header')
  })

  it('should push modal to stack', async () => {
    const user = userEvent.setup()
    render(
      <QContextProvider>
        <TestConsumer />
      </QContextProvider>
    )

    await user.click(screen.getByText('Push Modal'))
    expect(screen.getByTestId('modal-stack')).toHaveTextContent('modal-1')
  })

  it('should pop modal from stack', async () => {
    const user = userEvent.setup()
    render(
      <QContextProvider>
        <TestConsumer />
      </QContextProvider>
    )

    await user.click(screen.getByText('Push Modal'))
    await user.click(screen.getByText('Pop Modal'))
    expect(screen.getByTestId('modal-stack')).toHaveTextContent('')
  })

  it('should clear all modals', async () => {
    const user = userEvent.setup()
    render(
      <QContextProvider>
        <TestConsumer />
      </QContextProvider>
    )

    await user.click(screen.getByText('Push Modal'))
    await user.click(screen.getByText('Push Modal'))
    await user.click(screen.getByText('Clear Modals'))
    expect(screen.getByTestId('modal-stack')).toHaveTextContent('')
  })

  it('should throw when useQContext is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestConsumer />)
    }).toThrow('useQContext must be used within QContextProvider')

    consoleSpy.mockRestore()
  })
})
