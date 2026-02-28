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

'use client'

/** ErrorBoundary — reusable React class-based error boundary that catches render errors in its children subtree. */

import React, { type ReactNode, type ErrorInfo } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Props for the ErrorBoundary class component.
 */
export interface ErrorBoundaryProps {
  /** The React subtree to protect against render errors. */
  children: ReactNode
  /** Custom fallback UI to render instead of the default error card when an error is caught. */
  fallback?: ReactNode
  /** Optional callback invoked with the caught error and React error info for external logging. */
  onError?: (error: Error, info: ErrorInfo) => void
  /** Additional Tailwind class names applied to the default error card container. */
  className?: string
}

/**
 * Internal state for the ErrorBoundary class component.
 */
interface ErrorBoundaryState {
  /** Whether an error has been caught and the fallback UI should be shown. */
  hasError: boolean
  /** The most recently caught error, or `null` when none has occurred. */
  error: Error | null
}

/**
 * React class component that catches JavaScript errors anywhere in its child tree.
 *
 * When an error is caught, it renders either a custom `fallback` node or the
 * built-in error card with a "Try Again" button. Calling `handleReset` clears
 * the error state so children can re-render.
 *
 * @example
 * ```tsx
 * <ErrorBoundary onError={(err) => logger.error(err)}>
 *   <WidgetGrid />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  /**
   * React lifecycle method called during rendering when a descendant throws.
   *
   * @param error - The error that was thrown.
   * @returns New state with `hasError: true` and the caught error.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  /**
   * React lifecycle method called after an error has been rendered to the DOM.
   *
   * Logs the error to the console and forwards it to the optional `onError` prop.
   *
   * @param error - The caught error.
   * @param info - React error info containing the component stack.
   */
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info)
    this.props.onError?.(error, info)
  }

  /**
   * Resets the error state so the child tree will attempt to re-render.
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center',
            this.props.className
          )}
          role="alert"
          data-qqq-id="error-boundary"
        >
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" aria-hidden="true" />
          <h3 className="text-base font-semibold text-destructive">
            Something went wrong
          </h3>
          {this.state.error && (
            <p className="mt-1 max-w-xs text-sm text-destructive">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className={cn(
              'mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
              'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'transition-colors duration-150'
            )}
            data-qqq-id="button-error-boundary-retry"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
