/** useAuth — React hook that exposes the current authentication state to client components */
'use client'

// useAuth hook — provides auth state to client components

import { useContext } from 'react'
import { AuthContext, type AuthContextType } from './auth-provider'

/**
 * Returns the current authentication context.
 *
 * Must be called inside a component that is a descendant of {@link AuthProvider}.
 * Throws an error at runtime if no provider is found in the tree.
 *
 * @returns The {@link AuthContextType} value providing `isAuthenticated`, `user`,
 *   `authMetadata`, `logout`, and `handleOAuthCallback`.
 * @throws {Error} When called outside of an {@link AuthProvider} subtree.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
