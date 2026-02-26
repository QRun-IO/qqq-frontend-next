'use client'

// WidgetErrorBoundary — React class-based error boundary for individual widgets
// Prevents a single widget failure from crashing the entire dashboard

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
  widgetName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[WidgetErrorBoundary] Widget "${this.props.widgetName}" crashed:`, error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

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
