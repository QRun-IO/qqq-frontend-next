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
