'use client'

// useAuth hook — provides auth state to client components

import { useContext } from 'react'
import { AuthContext, type AuthContextType } from './auth-provider'

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
