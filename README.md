# QQQ Frontend Next

A metadata-driven admin UI for the QQQ low-code application framework, rewritten from React + Material UI to Next.js 16 + Tailwind CSS + shadcn/ui. The UI renders entirely from backend metadata — no table names, field lists, or navigation items are hardcoded in the frontend.

## QQQ 4.0 compatibility

With published QQQ 4.0.0, Next renders canonical statistics, HTML and bar/line/pie charts through the framework's authenticated `/widget/{name}` and full `/metaData` routes; deployments must forward these routes at the same application root as `/qqq/v1`. Next does not yet have full Material dashboard widget parity: multi-statistics, tables, stacked bars, steppers, small line charts and canonical composite children remain limited ([#550](https://github.com/QRun-IO/qqq/issues/550), deferred). Full dashboard parity remains a follow-up; the published QQQ 4.0.0 release does not imply that every Material widget is supported by Next.

## Run the local QQQ sample

Use the [QQQ quickstart](https://github.com/QRun-IO/qqq/blob/main/qqq-sample-project/README.md#quickstart-with-next) to clone editable Java sample source, compile against published QQQ 4.0.0, and launch this dashboard by default. It checks JDK 21+, Git, curl, unzip, and Docker; no Node.js or Maven installation is needed. Sample data is local and resets on restart.

The versioned image `ghcr.io/qrun-io/qqq-frontend-next:0.1.0` supplies Next on port 3000 and proxies the sample's API on host port 8000. It is built from `docker/quickstart/Dockerfile` for Linux amd64 and arm64 with browser mocks disabled. The launcher publishes the dashboard on localhost and removes its container on Ctrl+C. This image is configured for the local sample; application-specific deployments should set their backend during the build.

## Frontend development prerequisites

- **Node.js** 20.19+ or 22.12+ (required by the Storybook developer tooling)
- **pnpm** (install with `npm install -g pnpm` if not already present)

## Frontend development

```bash
git clone https://github.com/QRun-IO/qqq-frontend-next.git
cd qqq-frontend-next
pnpm install
pnpm dev
```

The dev server starts at [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `/qqq/v1` | Base URL for all QQQ backend API calls |
| `QQQ_BACKEND_URL` | _(unset)_ | Build-time backend origin for same-origin API rewrites; the quickstart image uses `http://host.docker.internal:8000` |
| `NEXT_PUBLIC_MOCK_API` | _(unset)_ | Set to `true` to activate MSW browser mocks for dev/demo without a live backend |

Copy `.env.example` to `.env.local` and adjust as needed.

## Available Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the Next.js development server (Turbopack) |
| `pnpm build` | Compile a production build |
| `pnpm start` | Serve the production build |
| `pnpm test` | Run Vitest unit tests (single pass) |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:coverage` | Run Vitest with V8 coverage report |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm typecheck` | Run `tsc --noEmit` (type check without emitting files) |
| `pnpm lint` | Run ESLint + Apache license header check |
| `pnpm format` | Run Prettier over all source files |
| `pnpm storybook` | Start Storybook component explorer on port 6006 |

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login and OAuth callback routes
│   ├── (dashboard)/        # Authenticated shell (sidebar + nav)
│   │   └── app/            # All app routes (tables, records, processes)
│   ├── layout.tsx          # Root layout — providers
│   ├── error.tsx           # Global error boundary
│   └── not-found.tsx       # 404 page
├── components/
│   ├── ui/                 # shadcn/ui primitives (Button, Input, Dialog, …)
│   ├── layout/             # Sidebar, Header, Breadcrumbs, Banner
│   ├── records/            # RecordView, FieldValue
│   ├── forms/              # DynamicForm, EntityForm, field components
│   ├── query/              # DataGrid, FilterBuilder, ColumnConfig, Pagination
│   ├── process/            # StepWizard, ValidationReview, BulkLoad
│   ├── widgets/            # Widget containers, charts, stat blocks, grids
│   └── feedback/           # Alerts, Toasts, Modals, CommandMenu
├── lib/
│   ├── api/                # Typed API client modules (client.ts, tables.ts, …)
│   ├── auth/               # Auth providers (OAuth2, Auth0, Anonymous)
│   ├── hooks/              # Shared React hooks (useLocalStorage, useMetadata, …)
│   ├── utils/              # Pure utility functions
│   ├── context/            # React contexts (QContext)
│   └── theme/              # Theme provider and CSS custom property tokens
├── types/                  # TypeScript type definitions
└── styles/                 # Global styles and theme tokens
```

## Documentation

| Document | Purpose |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Full architecture reference — conventions, patterns, key decisions |
| [`docs/STATE-MANAGEMENT.md`](./docs/STATE-MANAGEMENT.md) | When to use each state container (TanStack Query, RHF, URL params, localStorage, QContext) |
| [`docs/API-ERROR-HANDLING.md`](./docs/API-ERROR-HANDLING.md) | Global error handler, 401 interceptor, per-status guidance, code examples |
| [`docs/implementation-plans/`](./docs/implementation-plans/) | Work-package implementation plans (6 packages) |

## Tech Stack

- **Framework:** Next.js 15 (App Router) with React 19
- **Language:** TypeScript 5.x (`strict: true`)
- **Styling:** Tailwind CSS 4.x with CSS custom properties
- **Components:** shadcn/ui (Radix primitives + Tailwind)
- **Data Grid:** TanStack Table v8
- **Forms:** React Hook Form v7 + Zod
- **Data Fetching:** TanStack Query v5
- **Charts:** Recharts
- **Testing:** Vitest (unit), Playwright (E2E), axe-core (a11y)
- **Package Manager:** pnpm
