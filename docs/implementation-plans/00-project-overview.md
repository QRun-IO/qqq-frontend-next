# Project Overview: QQQ Admin UI Modernization

## Technology Stack

- **Framework:** Next.js 15+ (App Router) with React 19
- **Language:** TypeScript 5.x (strict mode)
- **Styling:** Tailwind CSS 4.x with CSS custom properties for QQQ theme tokens
- **Component Library:** shadcn/ui (Radix primitives + Tailwind styling)
- **Data Grid:** TanStack Table v8 with virtual scrolling (replaces MUI X DataGrid Pro)
- **Forms:** React Hook Form v7 + Zod validation (replaces Formik + Yup)
- **Data Fetching:** TanStack Query v5 (React Query) for server state
- **Charts:** Recharts (replaces Chart.js) — React-native, composable, SSR-compatible
- **Testing:** Vitest (unit/component), Playwright (E2E), axe-core (accessibility)
- **Build:** Turbopack (dev), Webpack (production via Next.js)
- **Linting:** ESLint + Prettier with project-standard config
- **Package Manager:** pnpm

## Project Structure

```
qqq-frontend-next/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth route group (no layout)
│   │   │   ├── login/page.tsx        # Login page
│   │   │   └── callback/page.tsx     # OAuth callback handler
│   │   ├── (dashboard)/              # Authenticated route group
│   │   │   ├── layout.tsx            # Dashboard layout (sidebar + nav + banners)
│   │   │   └── app/                  # All app routes
│   │   │       ├── [appName]/
│   │   │       │   └── page.tsx      # AppHome (dashboard/widgets)
│   │   │       ├── [tableName]/
│   │   │       │   ├── page.tsx              # RecordQuery (list)
│   │   │       │   ├── savedView/[viewId]/page.tsx  # Saved view query
│   │   │       │   ├── create/page.tsx       # Create record
│   │   │       │   ├── key/page.tsx          # View by unique key
│   │   │       │   ├── dev/page.tsx          # Table developer view
│   │   │       │   └── [recordId]/
│   │   │       │       ├── page.tsx          # RecordView
│   │   │       │       ├── edit/page.tsx     # Edit record
│   │   │       │       ├── copy/page.tsx     # Copy record
│   │   │       │       ├── dev/page.tsx      # Record developer view
│   │   │       │       └── createChild/[childTable]/page.tsx
│   │   │       └── [processName]/
│   │   │           └── page.tsx      # ProcessRun (standalone)
│   │   ├── layout.tsx                # Root layout (providers, global styles)
│   │   ├── not-found.tsx             # 404 page
│   │   └── error.tsx                 # Global error boundary
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives (Button, Input, Dialog, etc.)
│   │   ├── layout/                   # Sidebar, Navbar, Breadcrumbs, BrandedHeader, Footer
│   │   ├── records/                  # RecordView, FieldValue, RecordSidebar
│   │   ├── forms/                    # DynamicForm, EntityForm, field-type components
│   │   ├── query/                    # DataGrid, FilterBuilder, ColumnConfig, Pagination, Export
│   │   ├── process/                  # StepWizard, ValidationReview, BulkLoad, ProcessResults
│   │   ├── widgets/                  # Widget, DashboardWidgets, all chart/block/grid widgets
│   │   └── feedback/                 # Alerts, Toasts, Modals, HelpContent, CommandMenu
│   ├── lib/
│   │   ├── api/                      # Typed API client modules
│   │   │   ├── client.ts             # Base axios/fetch client with auth interceptor
│   │   │   ├── auth.ts               # getAuthenticationMetaData, manageSession, logout
│   │   │   ├── metadata.ts           # loadMetaData, loadTableMetaData, loadProcessMetaData
│   │   │   ├── tables.ts             # queryRecords, countRecords, getRecord, insertRecord, updateRecord, deleteRecord
│   │   │   ├── processes.ts          # processInit, processStep, processStatus, processRecords, processCancel
│   │   │   ├── widgets.ts            # fetchWidgetData
│   │   │   ├── possible-values.ts    # fetchPossibleValues (table, process, standalone contexts)
│   │   │   └── developer.ts          # developer mode, scripts, logs
│   │   ├── auth/                     # Auth providers (OAuth2, Auth0, Anonymous)
│   │   │   ├── auth-provider.tsx     # AuthContext + provider component
│   │   │   ├── use-auth.ts           # useAuth() hook
│   │   │   ├── oauth2.ts             # OAuth2/OIDC flow
│   │   │   ├── auth0.ts              # Auth0 integration
│   │   │   └── anonymous.ts          # Anonymous/mock auth
│   │   ├── hooks/                    # Shared React hooks
│   │   │   ├── use-metadata.ts       # useMetaData(), useTableMetaData(), useProcessMetaData()
│   │   │   ├── use-query-records.ts  # useQueryRecords() with TanStack Query
│   │   │   ├── use-record.ts         # useRecord() single record fetch
│   │   │   ├── use-process.ts        # useProcess() step machine
│   │   │   ├── use-widget.ts         # useWidget() with abort/cancel
│   │   │   ├── use-possible-values.ts # usePossibleValues() with debounce
│   │   │   ├── use-saved-views.ts    # useSavedViews() CRUD
│   │   │   └── use-local-storage.ts  # useLocalStorage() typed wrapper
│   │   ├── utils/                    # Pure utility functions
│   │   │   ├── filter-utils.ts       # QQueryFilter builders and validators
│   │   │   ├── value-utils.ts        # Display value formatting per field type
│   │   │   ├── table-utils.ts        # Table section/field helpers
│   │   │   ├── process-utils.ts      # Process navigation helpers
│   │   │   ├── export-utils.ts       # CSV/Excel export
│   │   │   └── responsive-utils.ts   # Breakpoint helpers
│   │   └── theme/                    # Theming system
│   │       ├── theme-provider.tsx    # ThemeContext (light/dark, accent colors)
│   │       ├── tokens.ts             # CSS custom property definitions (60+ tokens)
│   │       └── tailwind-plugin.ts    # Tailwind plugin for QQQ theme tokens
│   ├── types/                        # TypeScript type definitions
│   │   ├── index.ts                  # Re-exports all types
│   │   ├── metadata.ts              # QInstance, QTableMetaData, QFieldMetaData, QProcessMetaData, etc.
│   │   ├── records.ts               # QRecord, QPossibleValue
│   │   ├── query.ts                 # QQueryFilter, QFilterCriteria, QCriteriaOperator, etc.
│   │   ├── processes.ts             # QJobStarted, QJobRunning, QJobComplete, QJobError
│   │   ├── widgets.ts              # Widget data types
│   │   └── enums.ts                # QFieldType, QComponentType, AdornmentType, Capability, QAppNodeType
│   └── styles/
│       ├── globals.css              # Tailwind directives + CSS custom properties
│       └── qqq-theme.css            # QQQ-specific theme tokens
├── public/                           # Static assets
├── .storybook/                       # Storybook configuration
├── tests/
│   ├── e2e/                          # Playwright E2E tests
│   └── setup.ts                      # Vitest setup
├── next.config.ts                    # Next.js configuration
├── tailwind.config.ts               # Tailwind configuration
├── tsconfig.json                    # TypeScript config (strict: true)
├── vitest.config.ts                 # Vitest configuration
├── playwright.config.ts             # Playwright configuration
└── package.json
```

## Dependency Graph

```
Package 1 (Scaffold + Auth + Layout Shell)
    │
    ├──→ Package 2 (Record Query)
    │        │
    │        ├──→ Package 4 (Process Execution) ←── Package 3 (Record View + CRUD)
    │        │                                            │
    │        └──→ Package 5 (Dashboard + Widgets) ←──────┘
    │
    └──→ Package 3 (Record View + CRUD)
              │
              └──→ Package 6 (Polish + Parity) [depends on ALL above]
```

Packages 2 and 3 can execute in parallel after Package 1 completes.
Package 4 requires form components from Package 3.
Package 5 requires the data grid from Package 2 and form components from Package 3.
Package 6 requires everything.

## Work Package Summary

| Package | Name | Est. Duration | Prerequisites | Key Deliverables |
|---------|------|---------------|---------------|------------------|
| 1 | Scaffold + Auth + Layout Shell | 4 weeks | None | Project setup, types, API client, auth flow, sidebar/nav, theming, placeholder routes |
| 2 | Record Query | 6 weeks | Package 1 | Data grid, filters (basic/advanced), column config, pagination, saved views, export |
| 3 | Record View + CRUD | 6 weeks | Package 1 | Record detail view, entity form (all 12 field types), create/edit/copy/delete |
| 4 | Process Execution | 5 weeks | Packages 1, 3 | Step wizard, async job polling, bulk load, validation review, process results |
| 5 | Dashboard + Widgets | 4 weeks | Packages 1, 2, 3 | App home, widget system, charts, statistics, record grid widget, block types |
| 6 | Polish + Parity | 5 weeks | All above | Responsive audit, a11y, performance, Storybook, E2E tests, dev tools, command palette |

## Shared Conventions

### Metadata-Driven Rendering

- ALL components that render from metadata MUST accept the metadata type as a prop — never fetch it internally
- No hardcoded table names, field names, or process names anywhere in the UI code
- All user-facing text from metadata uses the `label` property, never `name`
- UI structure (navigation, pages, forms, columns) derives entirely from backend metadata

### API Integration

- All API calls go through typed client functions in `src/lib/api/` — never raw `fetch` or `axios`
- TanStack Query manages all server state caching, deduplication, and revalidation
- Query keys follow convention: `['metadata']`, `['tableMetadata', tableName]`, `['records', tableName, filterHash]`
- Mutations use `useMutation` with `onSuccess` invalidation of affected queries
- 401 responses intercepted globally → redirect to login preserving current URL

### Component Patterns

- Server Components used for: root layouts, metadata-fetching route pages
- Client Components used for: interactive UI (forms, grids, filters, modals)
- Mark client components with `"use client"` directive at file top
- Every interactive component must have a `data-qqq-id` attribute for CSS customization hooks
- Naming convention: `data-qqq-id="{component-type}-{identifier}"` (e.g., `data-qqq-id="button-save"`, `data-qqq-id="field-firstName"`)

### State Management

- Server state: TanStack Query (data from API)
- UI state: React context (theme, sidebar open/closed, modal stack, current user)
- Form state: React Hook Form (form values, validation, dirty tracking)
- URL state: Next.js searchParams (filters, pagination, sort — shareable URLs)
- Local persistence: localStorage (density, column widths, saved view selections, widget dropdown choices)

### Error Handling

- Error boundaries at: route level (Next.js error.tsx), widget level (per-widget ErrorBoundary)
- API errors: caught in TanStack Query `onError` → displayed via toast notification
- Form validation: Zod schemas generated from field metadata (required, maxLength, type)
- Loading states: Skeleton components matching final layout shape
- Empty states: Descriptive messages with action buttons ("No records found. Create one?")

### Accessibility (WCAG 2.1 AA)

- All form inputs: `<label>` element with `htmlFor` or wrapping input, `aria-required`, `aria-invalid`
- All buttons: descriptive text or `aria-label`
- Focus management: trap focus in modals, restore on close
- Keyboard navigation: all interactive elements reachable via Tab, actions via Enter/Space
- Color contrast: minimum 4.5:1 for normal text, 3:1 for large text
- Screen reader: `aria-live` regions for dynamic content updates (toasts, loading states)

### CSS Customization

- 60+ CSS custom properties (tokens) for theming — defined in `src/styles/qqq-theme.css`
- `data-qqq-id` attributes on all interactive elements enable `customCss` injection
- Light/dark mode via `prefers-color-scheme` media query + manual toggle stored in localStorage
- Tailwind classes for all layout/spacing; CSS custom properties for brand colors only

### File Naming Conventions

- Components: PascalCase (`RecordQuery.tsx`, `FilterBuilder.tsx`)
- Hooks: camelCase with `use-` prefix (`use-metadata.ts`, `use-query-records.ts`)
- Utilities: kebab-case (`filter-utils.ts`, `value-utils.ts`)
- Types: kebab-case (`metadata.ts`, `records.ts`)
- API modules: kebab-case (`possible-values.ts`, `auth.ts`)
- Tests: `*.test.ts(x)` co-located with source or in `tests/` directory

### Import Organization

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 2. External libraries
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

// 3. Internal: types
import type { QTableMetaData, QRecord } from '@/types'

// 4. Internal: lib (API, hooks, utils)
import { queryRecords } from '@/lib/api/tables'
import { useMetaData } from '@/lib/hooks/use-metadata'

// 5. Internal: components
import { Button } from '@/components/ui/button'
import { DataGrid } from '@/components/query/DataGrid'
```
