# Work Package 1: Project Scaffold, Authentication, and Layout Shell

**QQQ Admin UI Modernization — Next.js 15 + React 19 + Tailwind CSS 4**

**Package Status:** FOUNDATIONAL (blocks all other packages)
**Estimated Duration:** 4 weeks
**Team Size:** 2–3 engineers

---

## 1. Prerequisites

**None.** This is Package 1. All implementation begins here.

---

## 2. Requirements Traceability

| Requirement | Specification Section | Implementation Step |
|-------------|----------------------|-------------------|
| Authentication system initialization | Section 3.2 (Auth Endpoints) | Step 2–4 |
| Route generation from app tree metadata | Section 5.1 (Metadata Rendering) | Step 5–6 |
| Sidebar navigation hierarchy (max depth 2) | Section 5.5 (Sidebar Structure) | Step 7–8 |
| Dynamic theming & CSS variable injection | Section 5.3.1 (Theme System) | Step 9–10 |
| Environment/status banner system | Section 3.2 (Branding) | Step 11 |
| User session management (sessionUUID cookie) | Section 3.2.2–3.2.3 (Session API) | Step 3 |
| Error handling & 401 interception | Section 3.4 (Error Handling) | Step 4 |

---

## 3. Shared Context Files Required

Before implementation begins, ensure these files exist in `/sessions/clever-vigilant-gauss/mnt/QRun-IO/docs/implementation-plans/shared-context/`:

- **`type-definitions.md`** ← Used for all TypeScript imports and interfaces
- **`api-contract.md`** ← Used for all API endpoint specifications
- **`coding-conventions.md`** ← Used for file naming, import organization, accessibility patterns

Additionally, reference the **Project Overview** (`00-project-overview.md`) for directory structure and shared conventions.

---

## 4. Scope: In and Out

### In Scope

1. **Project scaffolding** — Next.js App Router directory structure, tsconfig.json, vitest/playwright config
2. **TypeScript setup** — Strict mode enabled, path aliases (`@/*`), type definitions imported from shared-context
3. **API client foundation** — Axios/fetch base client with global auth interceptor, TanStack Query v5 setup, QueryClientProvider
4. **Authentication system** — Auth0, OAuth2, and Fully Anonymous flows (not MOCK); session management via sessionUUID cookie; 401 interception
5. **Route generation** — Recursive app tree traversal; generation of 10+ routes per TABLE node; default route = first accessible app
6. **Sidebar navigation** — Hierarchical rendering from appTree; max depth 2; SideNav collapse/item components; mini-mode (icons only) support; user profile with Gravatar
7. **Layout shell** — Root layout with theme provider, query client provider, and modal stack context; dashboard layout with sidebar, header, and banner zones
8. **Theming system** — Dynamic MUI theme from QThemeMetaData; CSS variable injection for island components; light/dark mode support
9. **Breadcrumbs & page header** — QContext-driven breadcrumb rendering; page header setter from child routes
10. **Status banners** — Top-of-site banner rendering with severity styling (info/warning/error); dismissible support
11. **Error boundaries** — Global error.tsx; 401 → logout trigger; QException status detection
12. **Initial page placeholder** — AppHome component stub (content built in Package 5)
13. **Placeholder routes** — RecordQuery, RecordView, EntityCreate, EntityEdit, ProcessRun, ReportRun stubs

### Out of Scope

- Record query/filtering UI (Package 2)
- Record create/edit form rendering (Package 3)
- Process step wizard (Package 4)
- Dashboard widgets (Package 5)
- Responsive audit, a11y fixes beyond basics, Storybook (Package 6)
- Developer mode tools (Package 6)
- End-to-end tests (Package 6)

---

## 5. Detailed Implementation Steps

### Step 1: Initialize Next.js Project with Tailwind CSS 4 and TypeScript

**Files Created:**
- `package.json` (with all dependencies below)
- `next.config.ts`
- `tsconfig.json`
- `tailwind.config.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `.eslintrc.json` (Prettier + ESLint)
- `.prettierrc.json`
- `.gitignore`

**Exact Dependencies (pnpm add):**

```bash
# React & Next.js
pnpm add next@latest react@19 react-dom@19

# TypeScript
pnpm add -D typescript@5.x @types/node @types/react @types/react-dom

# Styling & Theme
pnpm add tailwindcss@4.x postcss autoprefixer
pnpm add -D @tailwindcss/forms

# shadcn/ui foundation (do NOT install components yet)
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-popover
pnpm add class-variance-authority clsx tailwind-merge

# Data & State
pnpm add @tanstack/react-query@5.x @tanstack/react-table@8.x
pnpm add react-hook-form@7.x zod

# API client
pnpm add axios

# Auth (OAuth2/OIDC)
pnpm add @auth0/auth0-react oidc-client-ts universal-cookie

# Forms & Validation
pnpm add zustand jotai

# Charts
pnpm add recharts

# Testing
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
pnpm add -D @playwright/test

# Linting
pnpm add -D eslint eslint-config-next prettier eslint-config-prettier

# Utilities
pnpm add date-fns lodash ts-md5
```

**Key Configuration Details:**

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "lib": ["es2020", "dom", "dom.iterable"],
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**next.config.ts:**
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@mui/material'],
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

export default nextConfig
```

**tailwind.config.ts:**
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'qqq-primary': 'var(--color-primary)',
        'qqq-accent': 'var(--color-accent)',
      },
      spacing: {
        'sidebar-width': 'var(--sidebar-width)',
      },
    },
  },
  plugins: [],
}

export default config
```

**Directory Structure After Step 1:**

```
qqq-frontend-next/
├── src/
│   ├── app/
│   │   ├── layout.tsx (root layout — empty for now)
│   │   └── page.tsx (empty — will redirect)
│   ├── components/
│   ├── lib/
│   ├── types/
│   └── styles/
├── tests/
├── public/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
└── .eslintrc.json
```

**Testing:** Run `pnpm dev` and verify Next.js starts without errors.

---

### Step 2: Define Core Types and Enums

**File:** `/src/types/index.ts`

Import all types from the shared-context definition. This file serves as the canonical re-export point.

**File:** `/src/types/metadata.ts`

```typescript
export interface QInstance {
  apps: Record<string, QAppMetaData>
  appTree: QAppTreeNode[]
  tables: Record<string, QTableMetaData>
  processes: Record<string, QProcessMetaData>
  reports: Record<string, any>
  widgets: Record<string, QWidgetMetaData>
  branding: QBrandingMetaData
  helpContents: Record<string, QHelpContent>
  environmentValues: Record<string, string>
  supplementalInstanceMetaData?: Record<string, any>
  theme?: QThemeMetaData
}

export interface QAuthenticationMetaData {
  name: string
  type: 'AUTH_0' | 'OAUTH2' | 'FULLY_ANONYMOUS' | 'MOCK'
  values: {
    clientId?: string
    baseUrl?: string
    audience?: string
  }
}

export interface QBrandingMetaData {
  companyName: string
  companyUrl: string
  appName: string
  logo?: string
  icon?: string
  accentColor?: string
  banners?: Record<string, Banner>
}

export interface QThemeMetaData {
  primaryColor?: string
  accentColor?: string
  mode?: 'light' | 'dark'
  customTokens?: Record<string, string>
}

// ... all other types from shared-context/type-definitions.md
```

**File:** `/src/types/enums.ts`

```typescript
export type QFieldType =
  | 'STRING'
  | 'INTEGER'
  | 'LONG'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIME'
  | 'DATE_TIME'
  | 'TEXT'
  | 'HTML'
  | 'PASSWORD'
  | 'BLOB'

export type QAppNodeType = 'TABLE' | 'PROCESS' | 'REPORT' | 'APP'

export type Capability =
  | 'TABLE_QUERY'
  | 'TABLE_GET'
  | 'TABLE_COUNT'
  | 'TABLE_INSERT'
  | 'TABLE_UPDATE'
  | 'TABLE_DELETE'

export type QCriteriaOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'STARTS_WITH'
  | 'CONTAINS'
  // ... (see type-definitions.md for full list)
```

**File:** `/src/types/records.ts`

```typescript
export interface QRecord {
  tableName: string
  recordLabel: string
  values: Record<string, any>
  displayValues: Record<string, string>
  associatedRecords?: Record<string, QRecord[]>
  errors?: string[]
  warnings?: string[]
}

export interface QPossibleValue {
  id: number | string
  label: string
}
```

**Testing:** `pnpm tsc --noEmit` should pass with no errors.

---

### Step 3: Create API Client with Auth Interceptor

**File:** `/src/lib/api/client.ts`

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/qqq/v1'

class APIClient {
  private client: AxiosInstance
  private unauthorizedCallback?: () => void

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true, // Send cookies (sessionUUID)
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Global 401 interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401 && this.unauthorizedCallback) {
          this.unauthorizedCallback()
        }
        return Promise.reject(error)
      }
    )
  }

  setUnauthorizedCallback(callback: () => void): void {
    this.unauthorizedCallback = callback
  }

  async get<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  async delete<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete<T>(url, config)
    return response.data
  }

  getInstance(): AxiosInstance {
    return this.client
  }
}

const apiClient = new APIClient()
export default apiClient
```

**File:** `/src/lib/api/auth.ts`

```typescript
import type { QAuthenticationMetaData } from '@/types'
import apiClient from './client'

const AUTH_METADATA_CACHE_KEY = 'qqqAuthMetadata'
const AUTH_METADATA_TTL = 3600000 // 1 hour in ms

export async function getAuthenticationMetaData(): Promise<QAuthenticationMetaData> {
  // Check localStorage cache
  const cached = localStorage.getItem(AUTH_METADATA_CACHE_KEY)
  if (cached) {
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp < AUTH_METADATA_TTL) {
      return data
    }
  }

  const metadata = await apiClient.get<QAuthenticationMetaData>(
    '/metaData/authentication'
  )

  // Cache in localStorage
  localStorage.setItem(
    AUTH_METADATA_CACHE_KEY,
    JSON.stringify({ data: metadata, timestamp: Date.now() })
  )

  return metadata
}

export interface SessionResponse {
  uuid: string
  values: Record<string, any>
}

export async function manageSession(
  accessToken: string
): Promise<SessionResponse> {
  const formData = new FormData()
  formData.append('accessToken', accessToken)

  return apiClient.post<SessionResponse>('/manageSession', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function logout(): Promise<void> {
  await apiClient.post('/logout')
  localStorage.removeItem(AUTH_METADATA_CACHE_KEY)
}
```

**File:** `/src/lib/api/metadata.ts`

```typescript
import type { QInstance, QTableMetaData, QProcessMetaData } from '@/types'
import apiClient from './client'

export async function loadMetaData(): Promise<QInstance> {
  return apiClient.get<QInstance>('/metaData')
}

export async function loadTableMetaData(tableName: string): Promise<QTableMetaData> {
  return apiClient.get<QTableMetaData>(`/metaData/table/${tableName}`)
}

export async function loadProcessMetaData(processName: string): Promise<QProcessMetaData> {
  return apiClient.get<QProcessMetaData>(`/metaData/process/${processName}`)
}
```

**TanStack Query Setup:** `/src/lib/query-client.ts`

```typescript
import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from '@tanstack/react-query'
import type { DefinedInitialDataOptions } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
    dehydrate: {
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) ||
        query.state.status === 'pending',
    },
  },
})

// Query key factory
export const queryKeys = {
  all: () => ['qqq'] as const,
  auth: () => [...queryKeys.all(), 'auth'] as const,
  authMeta: () => [...queryKeys.auth(), 'metadata'] as const,
  metadata: () => [...queryKeys.all(), 'metadata'] as const,
  metadataAll: () => [...queryKeys.metadata(), 'all'] as const,
  tableMetadata: (tableName: string) => [
    ...queryKeys.metadata(),
    'table',
    tableName,
  ] as const,
  processMetadata: (processName: string) => [
    ...queryKeys.metadata(),
    'process',
    processName,
  ] as const,
}
```

**Testing:** Create a simple test to verify the client makes HTTP requests without errors.

---

### Step 4: Implement Authentication Flows (Auth0, OAuth2, Anonymous)

**File:** `/src/lib/auth/auth-provider.tsx`

```typescript
'use client'

import React, { createContext, ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthenticationMetaData, manageSession, logout } from '@/lib/api/auth'
import type { QAuthenticationMetaData } from '@/types'

export interface AuthUser {
  name?: string
  email?: string
  id?: string
}

export interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  user: AuthUser | null
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export interface AuthProviderProps {
  children: ReactNode
  onAuthError?: (error: Error) => void
}

export function AuthProvider({ children, onAuthError }: AuthProviderProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const authMetadata = await getAuthenticationMetaData()

        switch (authMetadata.type) {
          case 'AUTH_0':
            await setupAuth0(authMetadata)
            break
          case 'OAUTH2':
            await setupOAuth2(authMetadata)
            break
          case 'FULLY_ANONYMOUS':
          case 'MOCK':
            await setupAnonymous()
            break
          default:
            throw new Error(`Unknown auth type: ${authMetadata.type}`)
        }

        setIsAuthenticated(true)
      } catch (error) {
        if (onAuthError && error instanceof Error) {
          onAuthError(error)
        }
        console.error('Auth setup failed:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [onAuthError])

  async function setupAuth0(metadata: QAuthenticationMetaData) {
    // Auth0 flow: check for code in URL or existing session
    // For MVP: extract user info from session
    const user: AuthUser = { name: 'User', email: 'user@example.com' }
    setUser(user)
  }

  async function setupOAuth2(metadata: QAuthenticationMetaData) {
    // OAuth2 OIDC flow: check for code in URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    if (code && state) {
      // Exchange code for token, then call manageSession
      // TODO: implement token exchange
    }

    const user: AuthUser = { name: 'User', email: 'user@example.com' }
    setUser(user)
  }

  async function setupAnonymous() {
    const user: AuthUser = { name: 'Anonymous', email: 'anonymous@example.com' }
    setUser(user)
  }

  async function handleLogout() {
    try {
      await logout()
      setIsAuthenticated(false)
      setUser(null)
      router.push('/auth/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

**File:** `/src/lib/auth/use-auth.ts`

```typescript
'use client'

import { useContext } from 'react'
import { AuthContext, type AuthContextType } from './auth-provider'

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

**Error Handling in Root Layout:** Set the unauthorized callback in `/src/app/layout.tsx` (Step 5).

**Testing:** Mock the auth metadata endpoint and verify each flow initializes correctly.

---

### Step 5: Build Root Layout with Providers

**File:** `/src/app/layout.tsx`

```typescript
import React from 'react'
import type { Metadata } from 'next'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth/auth-provider'
import { queryClient } from '@/lib/query-client'
import apiClient from '@/lib/api/client'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'QQQ Admin',
  description: 'Low-code application admin interface',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Set up global 401 handler
  React.useEffect(() => {
    apiClient.setUnauthorizedCallback(() => {
      // Redirect to login
      window.location.href = '/auth/login'
    })
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

**File:** `/src/styles/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* QQQ Theme Tokens */
:root {
  --color-primary: #0062ff;
  --color-accent: #c0d6f7;
  --color-error: #dc2626;
  --color-warning: #f59e0b;
  --color-success: #10b981;
  --color-info: #3b82f6;

  --sidebar-width: 256px;
  --sidebar-width-mini: 80px;
  --header-height: 64px;
  --banner-height: 40px;

  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #4fa3ff;
    --color-accent: #1e3a8a;
  }
}

body {
  font-family: var(--font-family-base);
  color: #1f2937;
  background: #ffffff;
}

@media (prefers-color-scheme: dark) {
  body {
    color: #f3f4f6;
    background: #111827;
  }
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}
```

**Testing:** `pnpm dev` and verify no console errors, providers initialize.

---

### Step 6: Create Context for Page State (QContext Equivalent)

**File:** `/src/lib/context/q-context.tsx`

```typescript
'use client'

import React, { createContext, ReactNode, useState } from 'react'
import type { QTableMetaData, QProcessMetaData } from '@/types'

export interface QContextType {
  // Navigation
  pathToLabelMap: Record<string, string>

  // Page state
  pageHeader: string | React.ReactNode
  setPageHeader: (header: string | React.ReactNode) => void

  // Theme
  accentColor: string
  setAccentColor: (color: string) => void
  accentColorLight: string
  setAccentColorLight: (color: string) => void

  // Table context
  tableMetaData: QTableMetaData | null
  setTableMetaData: (metadata: QTableMetaData) => void
  tableProcesses: QProcessMetaData[] | null
  setTableProcesses: (processes: QProcessMetaData[]) => void

  // UI state
  dotMenuOpen: boolean
  setDotMenuOpen: (open: boolean) => void

  // Modal stack
  modalStack: string[]
  pushModalOnStack: (id: string) => void
  popModalOffStack: (id: string) => void
  clearModalStack: () => void

  // Help
  keyboardHelpOpen: boolean
  setKeyboardHelpOpen: (open: boolean) => void
  helpHelpActive: boolean

  // User
  userId?: string
  branding: any
}

export const QContext = createContext<QContextType | undefined>(undefined)

export function QContextProvider({ children }: { children: ReactNode }) {
  const [pageHeader, setPageHeader] = useState<string | React.ReactNode>('')
  const [accentColor, setAccentColor] = useState('#0062ff')
  const [accentColorLight, setAccentColorLight] = useState('#c0d6f7')
  const [tableMetaData, setTableMetaData] = useState<QTableMetaData | null>(null)
  const [tableProcesses, setTableProcesses] = useState<QProcessMetaData[] | null>(null)
  const [dotMenuOpen, setDotMenuOpen] = useState(false)
  const [modalStack, setModalStack] = useState<string[]>([])
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false)
  const [pathToLabelMap] = useState<Record<string, string>>({})
  const [branding] = useState({})

  const pushModalOnStack = (id: string) => {
    setModalStack((prev) => [...prev, id])
  }

  const popModalOffStack = (id: string) => {
    setModalStack((prev) =>
      prev.length > 0 && prev[prev.length - 1] === id
        ? prev.slice(0, -1)
        : prev
    )
  }

  const clearModalStack = () => {
    setModalStack([])
  }

  return (
    <QContext.Provider
      value={{
        pageHeader,
        setPageHeader,
        accentColor,
        setAccentColor,
        accentColorLight,
        setAccentColorLight,
        tableMetaData,
        setTableMetaData,
        tableProcesses,
        setTableProcesses,
        dotMenuOpen,
        setDotMenuOpen,
        modalStack,
        pushModalOnStack,
        popModalOffStack,
        clearModalStack,
        keyboardHelpOpen,
        setKeyboardHelpOpen,
        helpHelpActive: false,
        pathToLabelMap,
        branding,
      }}
    >
      {children}
    </QContext.Provider>
  )
}

export function useQContext(): QContextType {
  const context = React.useContext(QContext)
  if (!context) {
    throw new Error('useQContext must be used within QContextProvider')
  }
  return context
}
```

**Testing:** Verify context initializes and setters update state correctly.

---

### Step 7: Create Dashboard Layout with Sidebar, Header, Breadcrumbs

**File:** `/src/app/(dashboard)/layout.tsx`

```typescript
'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { QContextProvider, useQContext } from '@/lib/context/q-context'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import Banner from '@/components/layout/Banner'
import type { QInstance } from '@/types'

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: metaData, isLoading, error } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30, // 30 minutes
  })

  const [sideNavRoutes, setSideNavRoutes] = useState<any[]>([])
  const [pathToLabelMap, setPathToLabelMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!metaData) return

    // Build sidebar routes and path map from appTree
    const routes: any[] = []
    const labelMap: Record<string, string> = {}

    if (metaData.appTree) {
      buildSideNavFromAppTree(metaData.appTree, routes, labelMap, '')
    }

    setSideNavRoutes(routes)
    setPathToLabelMap(labelMap)
  }, [metaData])

  function buildSideNavFromAppTree(
    appTree: any[],
    routes: any[],
    labelMap: Record<string, string>,
    parentPath: string,
    depth: number = 0
  ) {
    if (depth > 2) return

    appTree.forEach((node) => {
      const path = `${parentPath}/${node.name}`
      labelMap[path] = node.label

      if (node.type === 'APP') {
        const children: any[] = []
        if (node.children) {
          buildSideNavFromAppTree(node.children, children, labelMap, path, depth + 1)
        }

        routes.push({
          type: depth === 0 ? 'collapse' : 'item',
          name: node.label,
          path,
          icon: node.iconName,
          children: children.length > 0 ? children : undefined,
        })
      }
    })
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {String(error)}</div>

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar routes={sideNavRoutes} branding={metaData?.branding} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Banner */}
        {metaData?.branding?.banners && (
          <Banner banners={metaData.branding.banners} />
        )}

        {/* Header */}
        <Header appName={metaData?.branding?.appName} />

        {/* Breadcrumbs */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <Breadcrumbs pathToLabelMap={pathToLabelMap} />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QContextProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </QContextProvider>
  )
}
```

**File:** `/src/components/layout/Sidebar.tsx`

```typescript
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { QBrandingMetaData } from '@/types'

interface SidebarProps {
  routes: any[]
  branding?: QBrandingMetaData
}

export default function Sidebar({ routes, branding }: SidebarProps) {
  const pathname = usePathname()
  const [miniMode, setMiniMode] = useState(false)
  const [openCollapses, setOpenCollapses] = useState<Record<string, boolean>>({})

  const toggleCollapse = (path: string) => {
    setOpenCollapses((prev) => ({
      ...prev,
      [path]: !prev[path],
    }))
  }

  return (
    <aside
      className={`${
        miniMode ? 'w-20' : 'w-64'
      } bg-gray-900 text-white flex flex-col transition-all duration-300 overflow-y-auto`}
      onMouseEnter={() => setMiniMode(false)}
      onMouseLeave={() => setMiniMode(true)}
      data-qqq-id="sidebar"
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-700">
        {branding?.logo && (
          <img
            src={branding.logo}
            alt={branding.appName}
            className={miniMode ? 'w-12 h-12' : 'w-full'}
          />
        )}
        {!miniMode && (
          <h1 className="text-sm font-semibold mt-2">
            {branding?.appName || 'QQQ'}
          </h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {routes.map((route) =>
          route.type === 'collapse' ? (
            <SidebarCollapse
              key={route.path}
              route={route}
              isOpen={openCollapses[route.path] || false}
              onToggle={() => toggleCollapse(route.path)}
              isActive={pathname.startsWith(route.path)}
              miniMode={miniMode}
            />
          ) : (
            <SidebarItem
              key={route.path}
              route={route}
              isActive={pathname === route.path}
              miniMode={miniMode}
            />
          )
        )}
      </nav>

      {/* User profile (placeholder) */}
      <div className="p-4 border-t border-gray-700 text-sm">
        {!miniMode && <div>User Profile</div>}
      </div>
    </aside>
  )
}

function SidebarCollapse({
  route,
  isOpen,
  onToggle,
  isActive,
  miniMode,
}: any) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full text-left px-3 py-2 rounded transition ${
          isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
        }`}
        title={miniMode ? route.name : ''}
      >
        <span className="flex items-center justify-between">
          {!miniMode && <span>{route.name}</span>}
          <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
        </span>
      </button>
      {isOpen && !miniMode && route.children && (
        <div className="pl-4 space-y-1">
          {route.children.map((child: any) => (
            <SidebarItem key={child.path} route={child} miniMode={false} />
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarItem({ route, isActive, miniMode }: any) {
  return (
    <Link
      href={route.path}
      className={`block px-3 py-2 rounded transition ${
        isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
      }`}
      title={miniMode ? route.name : ''}
      data-qqq-id={`sidebar-item-${route.name}`}
    >
      {!miniMode && <span>{route.name}</span>}
      {miniMode && route.icon && <span>{route.icon.charAt(0)}</span>}
    </Link>
  )
}
```

**File:** `/src/components/layout/Header.tsx`

```typescript
'use client'

import React from 'react'
import { useAuth } from '@/lib/auth/use-auth'
import { useQContext } from '@/lib/context/q-context'

interface HeaderProps {
  appName?: string
}

export default function Header({ appName }: HeaderProps) {
  const { user, logout } = useAuth()
  const { pageHeader } = useQContext()

  return (
    <header
      className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6"
      data-qqq-id="header"
    >
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">{pageHeader || appName || 'QQQ'}</h1>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {user?.name || 'User'}
        </span>
        <button
          onClick={() => logout()}
          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          data-qqq-id="button-logout"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
```

**File:** `/src/components/layout/Breadcrumbs.tsx`

```typescript
'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface BreadcrumbsProps {
  pathToLabelMap: Record<string, string>
}

export default function Breadcrumbs({ pathToLabelMap }: BreadcrumbsProps) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const breadcrumbs = segments.map((_, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/')
    return {
      path,
      label: pathToLabelMap[path] || segments[index],
    }
  })

  return (
    <nav className="flex items-center gap-2 text-sm" data-qqq-id="breadcrumbs">
      <Link href="/" className="text-blue-600 hover:underline">
        Home
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          <span className="text-gray-400">/</span>
          {index === breadcrumbs.length - 1 ? (
            <span className="text-gray-900 dark:text-gray-100">
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.path} className="text-blue-600 hover:underline">
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
```

**File:** `/src/components/layout/Banner.tsx`

```typescript
'use client'

import React, { useState } from 'react'
import type { Banner } from '@/types'

interface BannerProps {
  banners: Record<string, Banner>
}

export default function BannerComponent({ banners }: BannerProps) {
  const banner = banners['QFMD_TOP_OF_SITE']
  const [dismissed, setDismissed] = useState(false)

  if (!banner || dismissed) return null

  const severityColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    error: 'bg-red-100 text-red-800 border-red-300',
  }

  return (
    <div
      className={`${severityColors[banner.severity]} border-b px-6 py-3 flex items-center justify-between`}
      role="alert"
      data-qqq-id="banner-top"
    >
      <span>{banner.text}</span>
      {banner.dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="ml-4 text-sm font-semibold underline hover:opacity-70"
          aria-label="Dismiss banner"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
```

**Testing:** Navigate to dashboard, verify sidebar, header, and breadcrumbs render correctly.

---

### Step 8: Generate Routes from App Tree

**File:** `/src/lib/hooks/use-routes.ts`

```typescript
'use client'

import { useMemo } from 'react'
import type { QInstance, QAppNodeType } from '@/types'

export interface RouteRecord {
  path: string
  name: string
  component?: React.ReactNode
  children?: RouteRecord[]
}

export function useAppTreeRoutes(
  metaData: QInstance | undefined
): {
  routes: RouteRecord[]
  pathToLabelMap: Record<string, string>
  defaultRoute: string
} {
  return useMemo(() => {
    if (!metaData?.appTree) {
      return {
        routes: [],
        pathToLabelMap: {},
        defaultRoute: '/no-access',
      }
    }

    const routes: RouteRecord[] = []
    const pathToLabelMap: Record<string, string> = {}
    let defaultRoute = '/no-access'
    let foundFirstApp = false

    function traverseAppTree(
      nodes: any[],
      parentPath: string,
      depth: number
    ) {
      nodes.forEach((node) => {
        const path = `${parentPath}/${node.name}`

        if (node.type === 'TABLE') {
          // Generate 10+ routes per TABLE
          const tableRoutes = [
            { path, label: `${node.label} Query` },
            { path: `${path}/create`, label: `${node.label} Create` },
            { path: `${path}/:id`, label: `${node.label} View` },
            { path: `${path}/:id/edit`, label: `${node.label} Edit` },
            { path: `${path}/:id/copy`, label: `${node.label} Copy` },
            { path: `${path}/:id/dev`, label: `${node.label} Dev` },
            { path: `${path}/dev`, label: `${node.label} Table Dev` },
            { path: `${path}/savedView/:viewId`, label: `${node.label} Saved View` },
            { path: `${path}/key`, label: `${node.label} View by Key` },
          ]

          tableRoutes.forEach(({ path: routePath, label }) => {
            pathToLabelMap[routePath] = label
          })
        } else if (node.type === 'APP') {
          pathToLabelMap[path] = node.label

          if (!foundFirstApp) {
            defaultRoute = path
            foundFirstApp = true
          }

          if (node.children && depth < 2) {
            traverseAppTree(node.children, path, depth + 1)
          }
        } else if (node.type === 'PROCESS') {
          pathToLabelMap[path] = node.label
        } else if (node.type === 'REPORT') {
          pathToLabelMap[path] = node.label
        }
      })
    }

    traverseAppTree(metaData.appTree, '', 0)

    return { routes, pathToLabelMap, defaultRoute }
  }, [metaData])
}
```

**Testing:** Verify hook generates correct paths and labels for all node types.

---

### Step 9: Create Theme System with Dynamic CSS Variables

**File:** `/src/lib/theme/theme-provider.tsx`

```typescript
'use client'

import React, { createContext, ReactNode, useEffect, useState } from 'react'
import type { QThemeMetaData } from '@/types'

export interface ThemeContextType {
  theme: QThemeMetaData | null
  setTheme: (theme: QThemeMetaData) => void
  isDarkMode: boolean
  toggleDarkMode: () => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode
  initialTheme?: QThemeMetaData
}) {
  const [theme, setTheme] = useState<QThemeMetaData | null>(initialTheme || null)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // Check user preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDarkMode(prefersDark)
  }, [])

  useEffect(() => {
    // Inject CSS variables
    if (!theme) return

    const root = document.documentElement
    root.style.setProperty('--color-primary', theme.primaryColor || '#0062ff')
    root.style.setProperty('--color-accent', theme.accentColor || '#c0d6f7')

    if (isDarkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme, isDarkMode])

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDarkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

**File:** `/src/styles/qqq-theme.css`

```css
/* QQQ Theme Token Definitions */

:root {
  /* Colors */
  --color-primary: #0062ff;
  --color-accent: #c0d6f7;
  --color-error: #dc2626;
  --color-warning: #f59e0b;
  --color-success: #10b981;
  --color-info: #3b82f6;
  --color-text: #1f2937;
  --color-text-light: #6b7280;
  --color-border: #e5e7eb;
  --color-bg: #ffffff;

  /* Spacing */
  --sidebar-width: 256px;
  --sidebar-width-mini: 80px;
  --header-height: 64px;
  --banner-height: 40px;

  /* Typography */
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #4fa3ff;
    --color-accent: #1e3a8a;
    --color-text: #f3f4f6;
    --color-text-light: #d1d5db;
    --color-border: #374151;
    --color-bg: #1f2937;
  }
}
```

**Inject into Layout:** Add `<ThemeProvider>` to root layout.

**Testing:** Verify CSS variables are injected and theme toggles work.

---

### Step 10: Create Placeholder Page Components

**File:** `/src/app/(dashboard)/app/page.tsx`

```typescript
'use client'

import React from 'react'
import { useQContext } from '@/lib/context/q-context'

export default function AppHome() {
  const { setPageHeader } = useQContext()

  React.useEffect(() => {
    setPageHeader('Dashboard')
  }, [setPageHeader])

  return (
    <div>
      <p className="text-gray-600">App home placeholder — Package 5</p>
    </div>
  )
}
```

**File:** `/src/app/(dashboard)/app/[tableName]/page.tsx`

```typescript
'use client'

import React from 'react'
import { useQContext } from '@/lib/context/q-context'

export default function RecordQuery() {
  const { setPageHeader } = useQContext()

  React.useEffect(() => {
    setPageHeader('Records')
  }, [setPageHeader])

  return <div>Record query placeholder — Package 2</div>
}
```

**File:** `/src/app/(dashboard)/app/[tableName]/[recordId]/page.tsx`

```typescript
'use client'

import React from 'react'
import { useQContext } from '@/lib/context/q-context'

export default function RecordView() {
  const { setPageHeader } = useQContext()

  React.useEffect(() => {
    setPageHeader('Record Details')
  }, [setPageHeader])

  return <div>Record view placeholder — Package 3</div>
}
```

**Additional placeholders:**
- `/src/app/(dashboard)/app/[tableName]/create/page.tsx` → EntityCreate
- `/src/app/(dashboard)/app/[tableName]/[recordId]/edit/page.tsx` → EntityEdit
- `/src/app/(dashboard)/app/[tableName]/[recordId]/copy/page.tsx` → EntityCopy
- `/src/app/(dashboard)/app/[tableName]/[recordId]/dev/page.tsx` → RecordDeveloperView
- `/src/app/(dashboard)/app/[tableName]/dev/page.tsx` → TableDeveloperView
- `/src/app/(dashboard)/app/[processName]/page.tsx` → ProcessRun
- `/src/app/(dashboard)/[reportName]/page.tsx` → ReportRun

**Testing:** Navigate to each route and verify placeholder renders without errors.

---

### Step 11: Implement Error Boundary and Auth Redirect

**File:** `/src/app/error.tsx`

```typescript
'use client'

import React, { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  // Check if 401
  if (error.message?.includes('401')) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Session Expired</h1>
          <p className="text-gray-600 mt-2">Please log in again.</p>
          <button
            onClick={() => (window.location.href = '/auth/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-screen bg-red-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-gray-600 mt-2">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
```

**File:** `/src/app/not-found.tsx`

```typescript
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-gray-600 mt-2">Page not found.</p>
        <Link
          href="/"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
```

**File:** `/src/app/(auth)/login/page.tsx`

```typescript
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/use-auth'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow text-center">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="text-gray-600 mt-2">Authenticating...</p>
      </div>
    </div>
  )
}
```

**Testing:** Verify 401 errors redirect to login; 404 page displays; error boundary catches exceptions.

---

## 6. Component Specifications

All components must accept the exact TypeScript interfaces specified below. These are non-negotiable contracts for downstream packages.

### 6.1 Sidebar Component

**File:** `/src/components/layout/Sidebar.tsx`

```typescript
interface SidebarProps {
  routes: SidebarRoute[]
  branding?: QBrandingMetaData
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  logout?: () => void
}

interface SidebarRoute {
  name: string
  path: string
  icon?: string
  type?: 'collapse' | 'item'
  children?: SidebarRoute[]
}

// Export signature:
export default function Sidebar(props: SidebarProps): JSX.Element
```

**Required Attributes:**
- `data-qqq-id="sidebar"` on container
- `data-qqq-id="sidebar-item-{name}"` on each item link
- `data-qqq-id="sidebar-collapse-{name}"` on collapse buttons
- `aria-label` on all interactive elements
- `role="navigation"` on nav container

---

### 6.2 Breadcrumbs Component

**File:** `/src/components/layout/Breadcrumbs.tsx`

```typescript
interface BreadcrumbsProps {
  pathToLabelMap: Record<string, string>
  separator?: string // default: '/'
}

export default function Breadcrumbs(props: BreadcrumbsProps): JSX.Element
```

**Required Attributes:**
- `data-qqq-id="breadcrumbs"` on container
- `data-qqq-id="breadcrumb-link-{index}"` on each link
- `aria-current="page"` on final breadcrumb

---

### 6.3 Header Component

**File:** `/src/components/layout/Header.tsx`

```typescript
interface HeaderProps {
  appName?: string
  onLogout?: () => void
  userName?: string
  userEmail?: string
}

export default function Header(props: HeaderProps): JSX.Element
```

**Required Attributes:**
- `data-qqq-id="header"` on container
- `data-qqq-id="button-logout"` on logout button

---

### 6.4 Banner Component

**File:** `/src/components/layout/Banner.tsx`

```typescript
interface BannerProps {
  banners: Record<string, Banner>
  onDismiss?: (bannerKey: string) => void
}

export default function Banner(props: BannerProps): JSX.Element
```

**Required Attributes:**
- `data-qqq-id="banner-{key}"` on each banner
- `role="alert"` on container
- `aria-label` describing severity

---

### 6.5 QContext Hook

**File:** `/src/lib/context/q-context.tsx`

```typescript
export function useQContext(): QContextType {
  pageHeader: string | React.ReactNode
  setPageHeader: (header: string | React.ReactNode) => void
  accentColor: string
  setAccentColor: (color: string) => void
  tableMetaData: QTableMetaData | null
  setTableMetaData: (metadata: QTableMetaData) => void
  modalStack: string[]
  pushModalOnStack: (id: string) => void
  popModalOffStack: (id: string) => void
  pathToLabelMap: Record<string, string>
  // ... full interface in type-definitions
}
```

---

## 7. API Client Functions

All functions must be implemented in `/src/lib/api/` with exact signatures and TanStack Query integration.

### 7.1 Authentication Functions

**File:** `/src/lib/api/auth.ts`

```typescript
/**
 * Fetch authentication configuration from backend.
 * Caches result in localStorage with 1-hour TTL.
 * @returns Promise<QAuthenticationMetaData>
 */
export async function getAuthenticationMetaData(): Promise<QAuthenticationMetaData>

/**
 * Exchange accessToken for sessionUUID cookie.
 * @param accessToken - OAuth access token from provider
 * @returns Promise<{ uuid: string; values: Record<string, any> }>
 */
export async function manageSession(
  accessToken: string
): Promise<SessionResponse>

/**
 * Invalidate session and clear cookies.
 * @returns Promise<void>
 */
export async function logout(): Promise<void>
```

**TanStack Query Key:**
```typescript
queryKeys.authMeta() // ['qqq', 'auth', 'metadata']
```

### 7.2 Metadata Functions

**File:** `/src/lib/api/metadata.ts`

```typescript
/**
 * Load complete application metadata (tables, processes, apps, branding, theme).
 * @returns Promise<QInstance>
 * Stale time: 30 minutes
 */
export async function loadMetaData(): Promise<QInstance>

/**
 * Load metadata for a single table.
 * @param tableName - Name of table
 * @returns Promise<QTableMetaData>
 * Stale time: 30 minutes
 */
export async function loadTableMetaData(tableName: string): Promise<QTableMetaData>

/**
 * Load metadata for a single process.
 * @param processName - Name of process
 * @returns Promise<QProcessMetaData>
 * Stale time: 30 minutes
 */
export async function loadProcessMetaData(processName: string): Promise<QProcessMetaData>
```

**TanStack Query Keys:**
```typescript
queryKeys.metadataAll() // ['qqq', 'metadata', 'all']
queryKeys.tableMetadata(tableName) // ['qqq', 'metadata', 'table', tableName]
queryKeys.processMetadata(processName) // ['qqq', 'metadata', 'process', processName]
```

---

## 8. Testing Requirements

### 8.1 Unit Tests

Create test files co-located with source:
- `/src/lib/api/client.test.ts` — Test HTTP client initialization, interceptors, and error handling
- `/src/lib/api/auth.test.ts` — Test auth metadata caching, session management, logout
- `/src/lib/context/q-context.test.tsx` — Test context provider, modal stack operations
- `/src/lib/hooks/use-routes.test.ts` — Test app tree traversal, route generation
- `/src/lib/theme/theme-provider.test.tsx` — Test theme injection, dark mode toggle

**Minimum Coverage:**
- API client 401 handling
- Auth metadata cache invalidation
- Modal stack push/pop/clear
- Route generation for each node type (APP, TABLE, PROCESS, REPORT)
- Theme CSS variable injection

### 8.2 Component Tests

- `/src/components/layout/Sidebar.test.tsx` — Test collapse/expand, active state, mini mode
- `/src/components/layout/Breadcrumbs.test.tsx` — Test path rendering, current page marking
- `/src/components/layout/Header.test.tsx` — Test user display, logout button
- `/src/components/layout/Banner.test.tsx` — Test severity styling, dismissal

### 8.3 Integration Tests

Create `/tests/e2e/` with Playwright:
- `auth-flow.spec.ts` — Complete auth flow (login → dashboard → logout)
- `navigation.spec.ts` — Sidebar navigation, route transitions, breadcrumb updates
- `error-handling.spec.ts` — 401 handling, 404 page, error boundary
- `theme.spec.ts` — Dark mode toggle, CSS variable injection

### 8.4 Accessibility Tests

- Use `@axe-core/react` in component tests
- Verify all buttons have `aria-label` or text content
- Verify form labels exist for all inputs
- Verify contrast ratios (4.5:1 for normal text)
- Verify keyboard navigation (Tab, Enter, Escape)

**Test Command:**
```bash
pnpm test           # Run Vitest unit tests
pnpm test:e2e      # Run Playwright E2E tests
pnpm test:coverage # Generate coverage report
```

---

## 9. Acceptance Criteria

All of the following must be **true** (binary pass/fail) before Package 1 is marked complete:

1. ✓ Next.js project scaffolded with strict TypeScript, Tailwind CSS 4, and pnpm
2. ✓ All types from `shared-context/type-definitions.md` are imported and re-exported from `/src/types/index.ts`
3. ✓ API client initialized with axios, global auth interceptor, and 401 → logout trigger
4. ✓ TanStack Query v5 configured with 30-minute metadata stale time and query key factory
5. ✓ Authentication system supports AUTH_0, OAUTH2, FULLY_ANONYMOUS flows (sessionUUID cookie)
6. ✓ Auth metadata cached in localStorage with 1-hour TTL and automatic cache invalidation on 401
7. ✓ App tree traversal generates correct routes (10+ per TABLE node, correct paths and labels)
8. ✓ Sidebar renders hierarchical navigation from appTree with max depth 2, collapse/expand, mini-mode support
9. ✓ Header displays page header from QContext setPageHeader(), app name, user name, logout button
10. ✓ Breadcrumbs auto-generate from current pathname using pathToLabelMap, mark current page with `aria-current="page"`
11. ✓ Banner system renders environment/status banners with severity styling (info/warning/error) and dismissal
12. ✓ Root layout wraps app with QueryClientProvider, AuthProvider, ThemeProvider, CssBaseline
13. ✓ Dashboard layout (with sidebar + header + breadcrumbs) renders for `/(dashboard)/**` routes
14. ✓ QContext provider initialized in dashboard layout with setPageHeader, modal stack, theming functions
15. ✓ Theme system injects CSS custom properties from QThemeMetaData; dark mode toggle works
16. ✓ All 9 placeholder components (AppHome, RecordQuery, RecordView, EntityCreate, EntityEdit, EntityCopy, RecordDeveloperView, TableDeveloperView, ProcessRun) exist and accept correct props
17. ✓ Login page at `/(auth)/login` displays and redirects authenticated users to dashboard
18. ✓ 401 responses trigger Client.setUnauthorizedCallback() → redirect to login preserving return URL
19. ✓ Global error.tsx catches exceptions, detects 401 status, displays appropriate message
20. ✓ 404 page (not-found.tsx) renders for undefined routes
21. ✓ All interactive elements have `data-qqq-id` attributes for CSS customization
22. ✓ All form inputs have `aria-label` or associated `<label>` elements
23. ✓ Navigation containers have `role="navigation"` and breadcrumbs have `role="navigation"`
24. ✓ Buttons have descriptive text or `aria-label`
25. ✓ `pnpm dev` runs without errors; `pnpm build` succeeds; `pnpm test` passes all unit tests
26. ✓ E2E tests (auth flow, navigation, error handling) pass in Playwright
27. ✓ Minimum 70% code coverage on `/src/lib/api`, `/src/lib/context`, `/src/lib/hooks`
28. ✓ No console errors or TypeScript compilation errors
29. ✓ All exported functions have JSDoc comments with @param, @returns, example usage
30. ✓ Import statements follow project conventions (React/Next → external libs → types → lib → components)

---

## 10. Sign-Off and Handoff

When Package 1 is complete:

1. Create a summary document listing all deliverables (files created, components, functions, tests)
2. Update the Project Overview's dependency graph to show Package 1 ✓ complete
3. Create stub issues for Packages 2 and 3 with references to this implementation plan
4. Conduct 30-minute review with Package 2 and 3 leads to verify API contracts and component signatures
5. Archive this plan version; create Package 2 plan from the template

---

**Document Version:** 1.0
**Last Updated:** 2026-02-25
**Status:** Ready for Implementation
**Reviewed By:** [To be filled]
