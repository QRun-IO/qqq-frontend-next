'use client'

// ErrorBoundary — Reusable React class-based error boundary
// Catches render errors in its children subtree

import React, { type ReactNode, type ErrorInfo } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
  className?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info)
    this.props.onError?.(error, info)
  }

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
