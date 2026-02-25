# CLAUDE.md — QQQ Frontend Next

## Project Overview

This is the **QQQ Admin UI Modernization** project — a complete rewrite of the QQQ admin frontend from React + Material UI to Next.js + Tailwind CSS + shadcn/ui.

QQQ is a metadata-driven, low-code application framework. The admin UI renders entirely from backend metadata — no table names, field lists, or navigation items are hardcoded. The backend declares metadata (tables, processes, apps, widgets), and the frontend renders it dynamically.

## Tech Stack

- **Framework:** Next.js 15 (App Router) with React 19
- **Language:** TypeScript 5.x (`strict: true` — no `any` in component props)
- **Styling:** Tailwind CSS 4.x with CSS custom properties for QQQ theme tokens
- **Components:** shadcn/ui (Radix primitives + Tailwind)
- **Data Grid:** TanStack Table v8 (replaces MUI X DataGrid Pro)
- **Forms:** React Hook Form v7 + Zod validation (replaces Formik + Yup)
- **Data Fetching:** TanStack Query v5
- **Charts:** Recharts
- **Testing:** Vitest (unit), Playwright (E2E), axe-core (a11y)
- **Package Manager:** pnpm

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth routes (login, callback)
│   ├── (dashboard)/        # Authenticated routes
│   │   ├── layout.tsx      # Dashboard layout (sidebar + nav + banners)
│   │   └── app/            # All app routes
│   │       ├── [appName]/page.tsx           # App home (dashboard)
│   │       ├── [tableName]/page.tsx         # Record query
│   │       ├── [tableName]/create/page.tsx  # Create record
│   │       ├── [tableName]/[recordId]/page.tsx      # Record view
│   │       ├── [tableName]/[recordId]/edit/page.tsx  # Edit record
│   │       └── [processName]/page.tsx       # Process execution
│   ├── layout.tsx          # Root layout (providers)
│   ├── error.tsx           # Global error boundary
│   └── not-found.tsx       # 404
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # Sidebar, Header, Breadcrumbs, Banner
│   ├── records/            # RecordView, FieldValue
│   ├── forms/              # DynamicForm, EntityForm, field components
│   ├── query/              # DataGrid, FilterBuilder, ColumnConfig, Pagination
│   ├── process/            # StepWizard, ValidationReview, BulkLoad
│   ├── widgets/            # Widget containers, charts, blocks, grids
│   └── feedback/           # Alerts, Toasts, Modals, CommandMenu
├── lib/
│   ├── api/                # Typed API client modules
│   │   ├── client.ts       # Base axios client with 401 interceptor
│   │   ├── auth.ts         # Auth endpoints
│   │   ├── metadata.ts     # Metadata endpoints
│   │   ├── tables.ts       # CRUD + query/count
│   │   ├── processes.ts    # Process lifecycle
│   │   ├── widgets.ts      # Widget data
│   │   └── possible-values.ts
│   ├── auth/               # Auth providers (OAuth2, Auth0, Anonymous)
│   ├── hooks/              # Shared React hooks
│   ├── utils/              # Pure utility functions
│   ├── context/            # React contexts (QContext)
│   └── theme/              # Theme provider, CSS tokens
├── types/                  # TypeScript type definitions
└── styles/                 # Global styles, theme tokens
```

## Key Conventions

### Metadata-Driven Rendering
- ALL components that render from metadata accept it as a prop — never fetch internally
- No hardcoded table names, field names, or process names anywhere
- User-facing text uses `label` from metadata, never `name`
- UI structure derives entirely from backend metadata

### API Integration
- All API calls go through typed functions in `src/lib/api/` — never raw `fetch`
- TanStack Query manages server state (caching, deduplication, revalidation)
- Query keys follow the factory pattern in `src/lib/query-client.ts`
- 401 responses intercepted globally → redirect to login

### Component Patterns
- Server Components: root layouts, metadata-fetching pages
- Client Components: interactive UI (forms, grids, filters) — mark with `"use client"`
- Every interactive component has a `data-qqq-id` attribute for CSS customization
- Naming: `data-qqq-id="{component-type}-{identifier}"` (e.g., `data-qqq-id="button-save"`)

### State Management
- Server state: TanStack Query
- UI state: React context (QContext)
- Form state: React Hook Form
- URL state: Next.js searchParams (filters, pagination — shareable URLs)
- Local persistence: localStorage (density, column widths, saved views)

### File Naming
- Components: PascalCase (`RecordQuery.tsx`)
- Hooks: camelCase with `use-` prefix (`use-metadata.ts`)
- Utilities: kebab-case (`filter-utils.ts`)
- Types: kebab-case (`metadata.ts`)
- Tests: `*.test.ts(x)` co-located with source

### Import Order
```typescript
// 1. React/Next.js
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. External libraries
import { useQuery } from '@tanstack/react-query'

// 3. Types
import type { QTableMetaData } from '@/types'

// 4. Lib (API, hooks, utils)
import { queryRecords } from '@/lib/api/tables'

// 5. Components
import { Button } from '@/components/ui/button'
```

### Error Handling
- Error boundaries at route level (`error.tsx`) and widget level
- API errors via TanStack Query `onError` → toast notification
- Form validation: Zod schemas from field metadata
- Loading: skeleton components matching final layout
- Empty: descriptive messages with action buttons

### Accessibility (WCAG 2.1 AA)
- All form inputs: `<label>` with `htmlFor`, `aria-required`, `aria-invalid`
- All buttons: descriptive text or `aria-label`
- Focus trapped in modals, restored on close
- Keyboard navigation for all interactive elements
- Color contrast: 4.5:1 normal, 3:1 large text

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Run Vitest unit tests
pnpm test:e2e     # Run Playwright E2E tests
pnpm tsc --noEmit # Type check without emitting
pnpm lint         # ESLint
pnpm format       # Prettier
```

## Implementation Plans

Full implementation plans are in `docs/implementation-plans/`. The project is built in 6 work packages:

1. **Package 1** — Scaffold, Auth, Layout Shell (foundation — must be first)
2. **Package 2** — Record Query (data grid, filters, pagination, saved views)
3. **Package 3** — Record View + CRUD (forms, field types, validation)
4. **Package 4** — Process Execution (step wizard, async polling, bulk load)
5. **Package 5** — Dashboard + Widgets (charts, statistics, blocks, grids)
6. **Package 6** — Polish + Parity (responsive, a11y, perf, Storybook, E2E)

Shared context for all agents: `docs/implementation-plans/shared-context/`

## Reference Codebase

The current frontend being replaced lives in the sibling `qqq-frontend-material-dashboard` repo. Key files to reference for behavior parity:
- `App.tsx` — route generation, auth flow, layout
- `src/qqq/pages/records/query/RecordQuery.tsx` — most complex page (260+ state vars)
- `src/qqq/pages/records/view/RecordView.tsx` — record detail
- `src/qqq/pages/processes/ProcessRun.tsx` — process execution
- `src/qqq/components/widgets/` — 60+ widget components

## API Base URL

Set via `NEXT_PUBLIC_API_BASE_URL` environment variable. Defaults to `/qqq/v1`.
The API uses cookie-based session auth (`sessionUUID` cookie).
