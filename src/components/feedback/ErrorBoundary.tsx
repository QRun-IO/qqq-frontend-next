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

/**
 * @file ErrorBoundary — reusable React class-based error boundary that catches render errors in its children subtree.
 */

'use client'

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
   * React lifecycle method called during the render phase when a descendant
   * throws. Because it runs in the render phase (not the commit phase), React
   * can use the returned state to re-render the fallback UI in the same pass —
   * no additional render cycle is required. Side effects such as logging must
   * NOT be placed here; use {@link componentDidCatch} instead, which runs in
   * the commit phase after the fallback has been painted.
   *
   * @param error - The error that was thrown by a descendant component.
   * @returns New state with `hasError: true` and the caught `error` object so
   *   `render()` can display the fallback UI.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  /**
   * React lifecycle method called in the commit phase after the fallback UI
   * has been painted to the DOM. This is the correct place for side effects
   * such as logging because the render phase has already completed. In
   * contrast, {@link getDerivedStateFromError} runs during the render phase
   * and must remain pure (no side effects).
   *
   * @param error - The caught error.
   * @param info - React error info containing the component stack trace.
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

  /**
   * Renders either the fallback UI (when an error has been caught) or the child tree.
   *
   * Priority order when `hasError` is true:
   * 1. `fallback` prop — custom caller-supplied node rendered as-is.
   * 2. Default error card — centered red card with the error message and a
   *    "Try Again" button that calls {@link handleReset}.
   *
   * When `hasError` is false, renders `children` unchanged.
   *
   * @returns The `fallback` prop when provided, the default error card as
   *   secondary fallback, or `children` when no error has occurred.
   */
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
