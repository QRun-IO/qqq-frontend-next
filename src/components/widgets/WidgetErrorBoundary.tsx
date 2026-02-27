/**
 * WidgetErrorBoundary — React class-based error boundary for individual dashboard widgets.
 *
 * Catches render-time exceptions thrown by any descendant component and replaces
 * the crashed widget with a styled error card containing a Retry button.
 * Prevents a single widget failure from crashing the entire dashboard.
 */
'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/** Props accepted by the WidgetErrorBoundary class component. */
interface Props {
  /** Child component tree to protect with the error boundary. */
  children: React.ReactNode
  /** Optional widget name included in error logs and data-qqq-id attributes. */
  widgetName?: string
}

/** Internal state tracked by the WidgetErrorBoundary class component. */
interface State {
  /** True after getDerivedStateFromError has been called for a caught error. */
  hasError: boolean
  /** The most recently caught error, or null when no error has occurred. */
  error: Error | null
}

/**
 * React error boundary that isolates render failures to individual dashboard widgets.
 *
 * When a descendant throws during rendering, getDerivedStateFromError sets
 * `hasError=true` and the boundary renders a red error card with the error
 * message and a Retry button. Clicking Retry resets state, causing the
 * boundary to attempt re-rendering the children.
 */
export class WidgetErrorBoundary extends React.Component<Props, State> {
  /**
   * Initializes the boundary with no active error.
   *
   * @param props - Component props including children and optional widgetName.
   */
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  /**
   * React lifecycle method called when a descendant throws during rendering.
   *
   * @param error - The error that was thrown.
   * @returns New state object with hasError=true and the captured error.
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  /**
   * React lifecycle method called after a descendant error has been caught.
   *
   * Logs the error and component stack to the console for debugging.
   *
   * @param error - The error that was thrown.
   * @param info - React ErrorInfo object containing the component stack trace.
   */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[WidgetErrorBoundary] Widget "${this.props.widgetName}" crashed:`, error, info)
  }

  /**
   * Resets the error boundary state, causing the children to be re-rendered.
   *
   * Bound as an arrow function so it can be passed directly as an onClick handler.
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  /**
   * Renders either the error card (when hasError is true) or the protected children.
   *
   * @returns A red error card with a Retry button, or the wrapped child tree.
   */
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-6 text-center"
          data-qqq-id={`widget-error-${this.props.widgetName ?? 'unknown'}`}
          role="alert"
        >
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-destructive">
              Widget failed to render
            </p>
            {this.state.error && (
              <p className="mt-1 text-xs text-destructive">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-destructive ring-1 ring-red-300 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id={`button-widget-retry-${this.props.widgetName ?? 'unknown'}`}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
