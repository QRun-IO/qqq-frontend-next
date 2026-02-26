'use client'

// Login page — authenticates user and redirects to dashboard
// Wrapped in Suspense because it uses useSearchParams()

import React, { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useAuth } from '@/lib/auth/use-auth'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, authMetadata } = useAuth()

  const returnTo = searchParams.get('returnTo') ?? '/'

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Decode and validate the returnTo URL
      try {
        const decoded = decodeURIComponent(returnTo)
        // Only redirect to relative paths (security: prevent open redirect)
        if (decoded.startsWith('/')) {
          router.replace(decoded)
        } else {
          router.replace('/')
        }
      } catch {
        router.replace('/')
      }
    }
  }, [isAuthenticated, isLoading, router, returnTo])

  if (isLoading) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <h1 className="text-xl font-semibold text-foreground">
            Authenticating...
          </h1>
          <p className="text-sm text-muted-foreground">
            {authMetadata
              ? `Setting up ${authMetadata.type} session...`
              : 'Checking authentication...'}
          </p>
        </div>
      </div>
    )
  }

  // If not loading and not authenticated, show login state
  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground"
          aria-hidden="true"
        >
          Q
        </div>
        <h1 className="text-xl font-semibold text-foreground">QQQ Admin</h1>
        <p className="text-sm text-muted-foreground">
          {authMetadata?.type === 'FULLY_ANONYMOUS' || authMetadata?.type === 'MOCK'
            ? 'Setting up anonymous session...'
            : 'Redirecting to authentication provider...'}
        </p>
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  )
}
