# QQQ Frontend Next

A metadata-driven admin UI for the QQQ low-code application framework, rewritten from React + Material UI to Next.js 16 + Tailwind CSS + shadcn/ui. The UI renders entirely from backend metadata — no table names, field lists, or navigation items are hardcoded in the frontend.

**This checkout targets Next UI 1.0.0-RC.25**, which adds an assistant panel that never blocks asking, re-attaches after refresh, shows live progress and can always Stop to RC24. Confirm availability in the [RC25 GitHub release](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.25) before installing; see the [RC25 notes](docs/releases/1.0.0-RC.25.md) for the preparation checkpoint and verification scope. [RC24](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.24) was the previously verified public candidate at that checkpoint and remains immutable. Final 1.0 remains held for application soak and explicit owner approval.

**Current roadmap and known issues:** [Next UI 1.0 tracker](https://github.com/QRun-IO/qqq/issues/713). GitHub issues are the source of truth for status and remaining work; see [issue tracking](docs/ISSUE-TRACKING.md).

## Use it in a QQQ application

The dashboard is the default admin UI for QQQ 4.1+. Add the jar (managed by `qqq-bom-pom`) and `QApplicationJavalinServer` serves it at `/`, on the same port and origin as the API:

```xml
<dependency>
    <groupId>com.kingsrook.qqq</groupId>
    <artifactId>qqq-frontend-next</artifactId>
    <version>1.0.0-RC.25</version>
</dependency>
```

The explicit version overrides an older BOM-managed frontend. RC25 requires a published QQQ 4.1 candidate: 4.1.0-RC.1 or later; 4.1.0-RC.2 or later for standalone branding images (QQQ #1009); and **4.1.0-RC.3 or later** for FILE_PREVIEW thumbnails (QQQ #1056) and the instance home app (QQQ #1059); **4.1.0-RC.4 or later** for record developer panels (QQQ #1076); **4.1.0-RC.5 or later** for the record picker (QQQ #1099), form validation limits (QQQ #1100) and date filter presets (QQQ #1115). The Alerts bell appears only with qbit-alerts (0.1.0-RC.1 or later); the notification center needs qbit-alerts 0.1.0-RC.2 or later. The assistant panel appears only with the qbit-assistant backend (0.1.0-RC.3 or later). The SQL Workbench needs the qbit-sql-workbench QBit (1.0.0-RC.1 or later); see the release notes for the verified backend. Select Next explicitly with `-Dqqq.javalin.frontend=next`. This does not release QQQ 4.1.

The jar holds the static export (`pnpm build:export`) under `next-dashboard/`. Deep links such as `/app/person/1` are served from placeholder pages and read their route from the browser path, so no Node.js server is involved. The Material Dashboard remains available: select it with `withServeFrontendMaterialDashboard(true)` or `-Dqqq.javalin.frontend=material`. Material routes are `/<app>/<table>/<id>`; Next routes are `/app/<table>/<id>`.

Feature coverage is recorded in the real-backend acceptance matrix in [`docs/acceptance/feature-matrix.md`](docs/acceptance/feature-matrix.md) ([QRun-IO/qqq#649](https://github.com/QRun-IO/qqq/issues/649)). Run it with `pnpm test:acceptance` (see [`tests/acceptance/README.md`](tests/acceptance/README.md)).

## Adopting in another app

How an existing QQQ backend application (for example one still on QQQ 0.x with the Material Dashboard) switches to, or upgrades, the Next dashboard. The frontend is distributed only as a Maven jar; there is no npm package (`package.json` is `private`).

### Coordinates and compatible versions

| Piece | Coordinates | Version |
|---|---|---|
| Next dashboard | `com.kingsrook.qqq:qqq-frontend-next` | `1.0.0-RC.13` (latest; [all versions](https://repo1.maven.org/maven2/com/kingsrook/qqq/qqq-frontend-next/)) |
| QQQ BOM | `com.kingsrook.qqq:qqq-bom-pom` (import scope) | `4.1.0-RC.3` (manages `qqq-frontend-next` at `1.0.0-RC.11`, so pin `1.0.0-RC.13` explicitly) |
| SQL Workbench QBit (optional) | `com.kingsrook.qbits:qbit-sql-workbench` | `1.0.0-RC.1` (built against QQQ `4.1.0-RC.2`) |
| Container image (optional, separate Node server) | `ghcr.io/qrun-io/qqq-frontend-next` | `1.0.0-RC.13` |

| Next feature | Minimum QQQ | Backend work |
|---|---|---|
| Dashboard at `/` | 4.1.0-RC.1 | Add the jar; `QApplicationJavalinServer` (`qqq-middleware-javalin`) serves it. |
| Standalone branding images | 4.1.0-RC.2 | Branding metadata ([qqq#1009](https://github.com/QRun-IO/qqq/issues/1009)). |
| FILE_PREVIEW thumbnails and lightbox | 4.1.0-RC.3 | Adorn each field with `AdornmentType.FilePreviewValues.newFieldAdornment()` ([qqq#1056](https://github.com/QRun-IO/qqq/issues/1056)). The field value, or `thumbnailUrlField` / `fullSizeUrlField`, must be an http(s) URL or a same-origin path; a BLOB field needs a `FILE_DOWNLOAD` adornment as well. Plain URL fields are never auto-detected. |
| Instance home app | 4.1.0-RC.3 | `qInstance.setHomeAppName("<app>")` ([qqq#1059](https://github.com/QRun-IO/qqq/issues/1059)). Users who may not open that app get Next's `/app` overview. |
| SQL Workbench | 4.1.0-RC.2 + QBit | Produce the QBit (`new SqlWorkbenchQBitProducer().withQBitConfig(...).produce(qInstance)`); it adds the `sqlWorkbench` app with the `SQL_WORKBENCH` widget, five tables and `/qqq/v1/sql-workbench/*` routes. Grant `sqlWorkbench.hasAccess` (and `sqlWorkbench.write` only for write mode) to super-users; configure `readOnlyCredentials` in production. See the [QBit README](https://github.com/QRun-IO/qbit-sql-workbench#readme). |
| Responsive layouts, readable child lists, compact dates | 4.1.0-RC.1 | None; frontend only. Child-record widgets honour `onlyIncludeFieldNames` order. |

### Switching from the Material Dashboard

1. Move the application to QQQ 4.1 (`qqq-bom-pom` `4.1.0-RC.3`). This is a major upgrade from QQQ 0.x; follow the QQQ 4.1 upgrade notes for the backend itself.
2. Add the `qqq-frontend-next` dependency above. When the jar is on the classpath, QQQ serves Next at `/` unless the Material Dashboard is requested explicitly.
3. Choose the dashboard in code with `withServeFrontendNext(true)` / `withServeFrontendMaterialDashboard(true)`, or, when neither is set in code, with `-Dqqq.javalin.frontend=next|material|none`. An app that sets `withServeFrontendMaterialDashboard(false)` and serves Material through its own route provider gets Next at `/` as soon as the jar is added; remove that custom route, or set `withServeFrontendNext(false)` to keep Material.
4. Authentication: keep the existing identity-provider client. OAUTH2 redirects to `{origin}/token` and AUTH_0 to `{origin}/`, as Material did; both use PKCE.
5. URLs change from `/<app>/<table>/<id>` (Material) to `/app/<table>/<id>` (Next). Map old bookmarks and links with `QInstance.redirects` (exact or wildcard paths).
6. Optional: set `homeAppName`, add `FILE_PREVIEW` adornments, add the SQL Workbench QBit (table above). No database migrations are needed for the dashboard itself; the SQL Workbench QBit needs its five tables (DDL in its README).

For a full per-feature checklist (backend upgrade, QBits, migrations, permissions) see the QQQ adoption checklist: https://github.com/QRun-IO/qqq/blob/develop/docs/migration/adoption-checklist.adoc

To upgrade between RCs, change only the `qqq-frontend-next` version and check the minimum QQQ version in the table above and in the [release notes](docs/releases/).

### Configuration

Served from the jar there is nothing to configure in the frontend: it calls the API on the same origin at `/qqq/v1`, and the Javalin server sends the security headers and Content-Security-Policy. External embeds (for example QuickSight frames) need an allowed CSP source, not a disabled policy. The build-time variables under [Environment Variables](#environment-variables) apply only to frontend development and the standalone container image.

### App home navigation grids

App homes show automatic section ("Actions", "Reports", "Data") and child-app ("Apps")
card grids. When the app declares one or more widgets, the "Apps" grid is left out (even if
a declared widget is unavailable to the current user), so widget-based navigation is not
duplicated; the section grids stay.

Set `supplementalAppMetaData.nextUi.showChildGrid` on the app to override this default:
`true` shows both grids alongside widgets; `false` hides both grids, for a home whose
widgets already cover its sections and child apps.
Only boolean values override the default. Existing visibility and permission rules still apply.

### Known limitations

- Release candidates only; final 1.0 is held for application soak and owner approval ([#712](https://github.com/QRun-IO/qqq/issues/712), tracker [#713](https://github.com/QRun-IO/qqq/issues/713)).
- Served at `/` only: sub-path hosting is not supported ([#732](https://github.com/QRun-IO/qqq/issues/732)).
- Material parity is not complete ([#714](https://github.com/QRun-IO/qqq/issues/714)); check the parity ledger for the screens your app relies on.
- Real Auth0, Google Drive and QuickSight integrations are not yet verified end to end ([#713](https://github.com/QRun-IO/qqq/issues/713)).
- The container image fixes the backend origin at build time (`host.docker.internal:8000`); use the jar, or rebuild the image, for another origin.
- WebKit and tablet acceptance runs show intermittent navigation diagnostics ([#985](https://github.com/QRun-IO/qqq/issues/985), [#904](https://github.com/QRun-IO/qqq/issues/904)).

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

Copy `.env.mock` to `.env.local` to run against MSW mocks, or set `NEXT_PUBLIC_MOCK_API=false` and point `NEXT_PUBLIC_API_BASE_URL` at a real backend.

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

## Default query columns

A new query view shows at most six fields: the visible primary key first, then
eligible fields from T1 sections followed by T2 sections, preserving section and
field order within each tier. Tables without sections use metadata field order.
Hidden fields, heavy fields, TEXT/HTML/BLOB/JSON-like types, and CODE_EDITOR or
RENDER_HTML adornments are excluded from the automatic selection (the primary key
is retained unless hidden). Fields outside T1/T2 are initially unchecked.
Other available columns remain selectable in the column picker.

Applications can override this selection with a string-array hint:

```json
{
  "supplementalMetaData": {
    "nextUi": {
      "defaultColumns": ["id", "title", "status"]
    }
  }
}
```

The legacy `supplementalTableMetaData.nextUi.defaultColumns` path is also accepted;
the modern `supplementalMetaData.nextUi` object takes precedence. A valid hint
selects exactly the named available columns, without the six-field cap or automatic
primary-key inclusion. Unknown or unavailable fields are ignored; an empty array
selects no columns, and malformed hints fall back to the automatic selection.
Saved views and legacy stored visibility (including `{}`, meaning all base columns)
are preserved. New View and Reset All Changes on an unsaved view restore these
metadata defaults. Quick search searches only visible string fields. Responsive
card/grid behavior is unchanged.
