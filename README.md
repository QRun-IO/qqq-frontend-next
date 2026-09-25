# QQQ Frontend Next

A metadata-driven admin UI for the QQQ low-code application framework, rewritten from React + Material UI to Next.js 16 + Tailwind CSS + shadcn/ui. The UI renders entirely from backend metadata — no table names, field lists, or navigation items are hardcoded in the frontend.

## Use it in a QQQ application

The dashboard is the default admin UI for QQQ 4.1+. Add the jar (managed by `qqq-bom-pom`) and `QApplicationJavalinServer` serves it at `/`, on the same port and origin as the API:

```xml
<dependency>
    <groupId>com.kingsrook.qqq</groupId>
    <artifactId>qqq-frontend-next</artifactId>
</dependency>
```

The jar holds the static export (`pnpm build:export`) under `next-dashboard/`. Deep links such as `/app/person/1` are served from placeholder pages and read their route from the browser path, so no Node.js server is involved. The Material Dashboard remains available: select it with `withServeFrontendMaterialDashboard(true)` or `-Dqqq.javalin.frontend=material`. Material routes are `/<app>/<table>/<id>`; Next routes are `/app/<table>/<id>`.

Feature coverage is certified by the real-backend acceptance matrix in [`docs/acceptance/feature-matrix.md`](docs/acceptance/feature-matrix.md) ([QRun-IO/qqq#649](https://github.com/QRun-IO/qqq/issues/649)). Run it with `pnpm test:acceptance` (see [`tests/acceptance/README.md`](tests/acceptance/README.md)).

## Run the local QQQ sample

Use the [QQQ quickstart](https://github.com/QRun-IO/qqq/blob/main/qqq-sample-project/README.md#quickstart-with-next): it clones editable Java sample source, compiles it against published QQQ, and serves this dashboard from the sample on port 8000. It needs JDK 21+, Git, curl and unzip; no Node.js, Maven or Docker installation.

A container image (`ghcr.io/qrun-io/qqq-frontend-next`, built from `docker/quickstart/Dockerfile`) remains available for running the dashboard as a separate Node server in front of a backend on host port 8000. The backend origin is fixed at image build time (`QQQ_BACKEND_URL`).

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
| `QQQ_BACKEND_URL` | _(unset)_ | Standalone build only: backend origin for same-origin API rewrites; the container image uses `http://host.docker.internal:8000` |
| `QQQ_NEXT_OUTPUT` | _(unset)_ | `export` produces the static export for QQQ hosting (`pnpm build:export`) |
| `NEXT_PUBLIC_MOCK_API` | _(unset)_ | Set to `true` to activate MSW browser mocks for dev/demo without a live backend |

Copy `.env.example` to `.env.local` and adjust as needed.

## Available Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the Next.js development server (Turbopack) |
| `pnpm build` | Compile the standalone (Node server) production build |
| `pnpm build:export` | Compile the static export served by QQQ (`out/`) |
| `pnpm build:jar` | Static export packaged as the `qqq-frontend-next` Maven jar |
| `pnpm test:acceptance` | Real-backend acceptance suite and matrix gate (needs `QQQ_SAMPLE_JAR`) |
| `pnpm start` | Serve the production build |
| `pnpm test` | Run Vitest unit tests (single pass) |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:coverage` | Run Vitest with V8 coverage; fails below the `src/lib` thresholds in `vitest.config.ts` |
| `pnpm test:e2e` | Run the mocked Playwright e2e suite (`tests/e2e`, no backend); `QQQ_E2E_SERVER=production` serves the `pnpm build` output, `QQQ_E2E_PORT` picks the port |
| `pnpm perf:budget` | Check the static export (`out/`) against the bundle budget in `perf-budget.json` ([`docs/acceptance/performance.md`](docs/acceptance/performance.md)) |
| `pnpm typecheck` | Run `tsc --noEmit` (type check without emitting files) |
| `pnpm lint` | Run ESLint + Apache license header check |
| `pnpm format` | Run Prettier over all source files |
| `pnpm storybook` | Start Storybook component explorer on port 6006 |
| `pnpm build-storybook` | Build the static Storybook (`storybook-static/`) |

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

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript 5.x (`strict: true`)
- **Styling:** Tailwind CSS 4.x with CSS custom properties
- **Components:** shadcn/ui (Radix primitives + Tailwind)
- **Data Grid:** TanStack Table v8
- **Forms:** React Hook Form v7 + Zod
- **Data Fetching:** TanStack Query v5
- **Charts:** Recharts
- **Testing:** Vitest (unit), Playwright (E2E), axe-core (a11y)
- **Package Manager:** pnpm
