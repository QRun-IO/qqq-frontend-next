# Next UI agent guide

This is an implementation playbook for coding agents working on the QQQ Next UI. Read the [developer guide](./next-ui-developer-guide.md) for user and integrator behavior, the repository [CLAUDE.md](../../CLAUDE.md) for scoped conventions, and the [real-server feature matrix](../acceptance/feature-matrix.md) plus [Material parity ledger](../acceptance/material-parity.md) before claiming compatibility. This guide reflects `feature/next-1.0` at `3c4b247` (2026-09-26); branch and backend contracts can move. A green subset of tests is evidence for that subset, not proof of complete Material parity or a 1.0 release.

## Operating rule: metadata is the product boundary

QQQ's Java backend owns tables, fields, processes, apps, navigation, widgets, permissions, and human labels. The browser adapts to the metadata of the current user. Never make a QQQ application work by hardcoding its table names, field names, routes, or widget data in a React component. Add general rendering behavior and a real backend fixture, or change the backend metadata producer where the contract originates. Do not invent JSON keys because a frontend type accepts `Record<string, unknown>`; inspect the actual producer, versioned API response, and acceptance fixture.

The UI supports a **versioned** API at `/qqq/v1`. The acceptance diagnostics reject browser calls to legacy unversioned paths. All browser requests should use typed functions in [`src/lib/api`](../../src/lib/api); TanStack Query keys come from [`src/lib/query-client.ts`](../../src/lib/query-client.ts). Treat permission flags as display controls only; the backend must refuse the same forbidden operation.

## Find the right source before editing

| Need | Start here | Why |
|---|---|
| Instance, app, table, field, process, report, widget shapes | [`src/types/metadata.ts`](../../src/types/metadata.ts), [`src/types/enums.ts`](../../src/types/enums.ts) | Frontend contract and enumerated types. |
| Backend HTTP contract | [`src/lib/api`](../../src/lib/api), [`src/lib/api/client.ts`](../../src/lib/api/client.ts) | Versioned routes, typed request/response handling, 401 behavior. |
| Route and sidebar dispatch | [`src/app/(dashboard)/app/[slug]/page.tsx`](../../src/app/%28dashboard%29/app/%5Bslug%5D/page.tsx), [`use-routes.ts`](../../src/lib/hooks/use-routes.ts), [`use-route-params.ts`](../../src/lib/hooks/use-route-params.ts) | Slug precedence, metadata-driven nav, static-export deep links. |
| Query and saved views | [`src/components/query`](../../src/components/query), [`use-record-query.ts`](../../src/lib/hooks/use-record-query.ts), [`use-saved-views.ts`](../../src/lib/hooks/use-saved-views.ts) | URL state, filters, variant, selection, backend saved views. |
| Record display and forms | [`src/components/records`](../../src/components/records), [`src/components/forms`](../../src/components/forms), [`zod-from-metadata.ts`](../../src/lib/utils/zod-from-metadata.ts) | Sections, fields, editors, validation, adornments. |
| Processes and reports | [`src/components/process`](../../src/components/process), [`ReportRun.tsx`](../../src/components/reports/ReportRun.tsx), [`src/lib/api/processes.ts`](../../src/lib/api/processes.ts) | Step components, state transitions, polling, files. |
| Widget entry and dispatch | [`ConnectedWidget.tsx`](../../src/components/widgets/ConnectedWidget.tsx), [`WidgetBlock.tsx`](../../src/components/widgets/WidgetBlock.tsx), [`WidgetRenderer.tsx`](../../src/components/widgets/WidgetRenderer.tsx) | Fetch/params, chrome, data renderer. |
| Widget payload details | [`src/components/widgets`](../../src/components/widgets), [`widget-types.ts`](../../src/components/widgets/widget-types.ts), [`src/mocks/fixtures/widgets`](../../src/mocks/fixtures/widgets) | Concrete canonical and demo shapes; demo fixtures are not production guarantees. |
| Branding and CSS | [`src/lib/theme`](../../src/lib/theme), [`src/styles`](../../src/styles) | Implemented tokens and `data-qqq-id` customization hooks. |
| Owned backend acceptance | [`tests/acceptance`](../../tests/acceptance), [`tests/acceptance/README.md`](../../tests/acceptance/README.md) | QQQ sample fixtures, browser projects, SQL assertions, diagnostics gate. |
| Current gaps and risk | [Material parity ledger](../acceptance/material-parity.md), [security review](../security/next-ui-review.md), [browser matrix](../acceptance/browser-matrix.md) | What has actually been verified and what remains open. |

The repo's [implementation plans](../implementation-plans) explain intended architecture, but some examples predate the current code. Prefer source and executable acceptance evidence. In particular, current `package.json` uses Next.js 16 even though older `CLAUDE.md` and plans mention 15.

## Workflow for a metadata-driven feature

1. **Find the Material behavior and acceptance row.** Search the parity ledger by screen or widget type and identify the owning issue and matrix ID. Read the current Material implementation when the behavior is ambiguous. Preserve negative cases and permissions.
2. **Trace the QQQ producer.** Locate the Java metadata or renderer that emits the relevant response. Record the exact versioned route and response, including whether data is omitted for unauthorized users. Check the real sample fixture. Do not assume the TypeScript interface is a complete backend specification.
3. **Pick the existing frontend seam.** Add an API function for a new endpoint, a query key for server state, a renderer case for a new widget type, or a metadata-driven component for a new field behavior. Keep application identifiers in metadata/fixtures only.
4. **Define behavior for loading, empty, invalid, denied, and failed states.** A malformed widget must not crash neighboring widgets. A denied action must be hidden or disabled and refused by the server. Preserve record identity, selected variant, return path, and unsaved form changes across interactions where applicable.
5. **Add focused unit tests for logic and an acceptance scenario for user behavior.** Acceptance tests use the owned QQQ server and check values or SQL state, not only visibility. Give every acceptance test a matrix ID, and use the `diagnostics` fixture. New rows live in the owning `tests/acceptance/matrix/*.json`; the Markdown matrix is generated from those files.
6. **Run the affected quality gates, then the full release gate when warranted.** Record commands, build/backend revisions, browsers, and results. Do not write “parity complete” while open Partial/Missing rows remain.
7. **Update documentation with verified behavior.** Explain the metadata producer, request/response, UI behavior, and any remaining limitation. Revise this guide's catalog if a widget type changes.

For code changes, follow import order and file naming in [CLAUDE.md](../../CLAUDE.md): React/Next, external packages, types, library, components; PascalCase component filenames, kebab-case utilities, co-located `*.test.ts(x)`. Client components with interactivity use `'use client'`. User text comes from `label` rather than internal `name`. Interactive elements need a stable `data-qqq-id`, an accessible name, keyboard operation, and appropriate focus management. Inspect existing IDs before promising Material selector compatibility: [the parity ledger](../acceptance/material-parity.md) tracks naming and CSS variable gaps.

## Configuration decision map

| Desired behavior | Correct source | Verify |
|---|---|---|
| Add a sidebar entry or nested app | Backend `QInstance.appTree` with `QAppTreeNode.type`; corresponding object in `apps`, `tables`, `processes`, or `reports` | Visible route and `useAppTreeRoutes`; denied user's metadata. |
| Add an app home section | `QAppMetaData.sections` (`tables`, `processes`, `reports` by name) | Labels, order, links and permissions in app home. |
| Place dashboard widgets | `QAppMetaData.widgets` ordered names; matching `QInstance.widgets` metadata | `WidgetGrid`, widget POST, grid span, denied cases. |
| Place a record widget | `QTableSection.widgetName` and compatible record context | Two records render their own values; no cross-record cache leak. |
| Add fields or editors | `QTableMetaData.fields`, sections, adornments, possible-value source | Form, view, validation, server save, keyboard and phone. |
| Add a process screen | `QProcessMetaData.frontendSteps` and a supported `QFrontendComponent.type` | Init, submit, async status, cancel/retry, output and server mutations. |
| Add report | `QInstance.reports`, optional `processName` | CSV/XLSX/JSON and required inputs; actual downloaded bytes. |
| Customize identity | `QInstance.branding` and optional `theme` | Login subset, logo/icon, accent, banners, contrast, CSP. |
| Customize widget chrome | `QWidgetMetaData` fields such as `gridColumns`, `isCard`, `dropdowns`, `showReloadButton`, `showExportButton`, `helpContent`, `icons`, `footerHTML` | Widget response's corresponding lists/CSV and user interaction. |
| Customize application CSS | `branding.customCss` against observed `data-qqq-id`/implemented CSS tokens | Browser rendering and contrast; Material CSS compatibility is incomplete. |
| Switch host mode | `QQQ_NEXT_OUTPUT=export` for Javalin jar, or standalone build with `QQQ_BACKEND_URL` | Root deep link, `/qqq/v1` calls, asset paths, browser refresh. |

The exact type names and optional fields are in [`metadata.ts`](../../src/types/metadata.ts). `supplementalInstanceMetaData`, `supplementalTableMetaData`, and widget `defaultValues` are extension maps, not licenses to invent arbitrary frontend behavior. Inspect each consumer and QQQ backend producer first.

### A safe widget change, end to end

For an existing `statistics` widget, the backend can declare metadata equivalent to this TypeScript value:

```ts
import type { QWidgetMetaData } from '@/types'

const metadata = {
  name: 'openOrders',
  label: 'Open orders',
  type: 'statistics',
  hasPermission: true,
  gridColumns: 4,
  showReloadButton: true,
} satisfies QWidgetMetaData
```

The canonical QQQ renderer then returns a payload such as `{ "type": "statistics", "count": 7, "countContext": "orders awaiting review" }`. `ConnectedWidget` calls the typed widget API, `WidgetBlock` renders the frame, and `WidgetRenderer` selects `QqqStatisticsWidget` because `count` is present. The local demo statistic instead uses `value`; do not copy that shape into a QQQ Java renderer without verifying it. To add a new renderer type, add the dispatcher branch, a focused component, a malformed/empty case, real backend fixture, and a WID acceptance row. For existing types, do not add a duplicate dispatcher path.

For a dropdown, metadata alone is insufficient. The backend payload supplies parallel `dropdownNameList`, `dropdownLabelList`, `dropdownDataList`, and `dropdownDefaultValueList`. The selected option ID is sent back as a widget request parameter. A PVS dropdown uses `possibleValueSourceName` as that parameter name; a `DATE_PICKER` uses its `name`. `storeDropdownSelections` writes a local preference only. Test a stale stored choice and a required selection ([WID-047–WID-050](../acceptance/feature-matrix.md)).

For `customComponent`, metadata `defaultValues.componentName` and `componentSourceUrl` select a trusted external bundle. The browser loads `window[componentName][componentName]`. Before promising Material compatibility, check the missing `window.React`/`window.ReactDOM` globals and QFMD bridge rows in the [parity ledger](../acceptance/material-parity.md); an owned test bundle passing WID-025 does not prove older Material-built bundles work.

## Navigation and route rules

`/app/{slug}` resolves an app, table, process, or report from loaded instance metadata, in that order. Do not create a static page for each QQQ object. New dynamic route shapes must work in both standalone and Javalin static export. The export prerenders `_` placeholder paths; [`useRouteParams`](../../src/lib/hooks/use-route-params.ts) translates them from the browser path. Preserve `trailingSlash` handling and avoid constructing deep links that a static host cannot serve. Use [`material-links.ts`](../../src/lib/utils/material-links.ts) for supported Material-generated URLs, and verify unknown or denied slugs render the correct contained state. Root-path hosting is the documented target; the parity ledger lists base-path support as Missing.

The query URL owns `page`, `pageSize`, `filter`, and `q`; do not move shareable filter state into local storage. Saved views have `/app/{table}/savedView/{id}` and backend persistence. Local storage is for preferences, such as density, column configuration, and widget selections. See [state management](../STATE-MANAGEMENT.md). Put app shell labels, icons, and nested nav in metadata and verify breadcrumb titles against the same tree.

## Security and accessibility review points

- Use the typed API client and same-origin cookie session. Do not put access tokens, passwords, or server secrets in browser storage, public environment variables, widget metadata, or tests.
- Check permission at the UI and the backend. Exercise a denied persona in acceptance; a hidden button alone is insufficient. Do not call widget, process, or record endpoints for an omitted or disabled object.
- Sanitize HTML. Review CSS, external links, iframes, custom bundle URLs, and CSP when adding a new embed. See [security review](../security/next-ui-review.md) and its specific follow-ups.
- Give forms real labels, `aria-required`/`aria-invalid` where relevant, keyboard operation, error text, and a sensible focus target. Dialogs and phone sheets must trap focus and restore it. Check both desktop keyboard and phone/tablet touch interactions.
- Keep errors local when possible: widget failures show a contained retry and leave neighboring widgets usable; route errors and missing records have dedicated states. Never swallow an API failure into a blank page.

## Quality gates and evidence

| Command | Evidence it supplies |
|---|---|
| `pnpm typecheck` | TypeScript contract check. |
| `pnpm lint` | ESLint and license headers. |
| `pnpm test` | Vitest unit/regression behavior. |
| `pnpm test:e2e` | Mocked Playwright UI paths, useful but not real backend compatibility. |
| `pnpm build:export` | Javalin static-export build and dynamic placeholder output. |
| `pnpm perf:budget` | Static-export JS/CSS budget after `build:export`; see [performance guide](../acceptance/performance.md). |
| `QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile,tablet pnpm test:acceptance` | Full real-sample browser and backend gate when `QQQ_SAMPLE_JAR` points to a compatible sample jar. |

Read [acceptance setup](../../tests/acceptance/README.md) and [browser matrix](../acceptance/browser-matrix.md) before running the final gate. Default acceptance runs only Chromium; the five-project command is necessary to claim the stated browser scope. Phone and tablet run tagged tests, with matrix coverage enforced by the gate. Every test title needs its matrix ID; use fixtures with a reset database, verify persisted effects through SQL, and include `diagnostics` for console, network, and CSP failures. Do not loosen a matrix row, skip a failing browser, or declare an external service excluded without the documented approval path.

## Common mistakes to avoid

- **Inventing config from a plan or TypeScript escape hatch.** Read the actual QQQ producer and renderer; `Record<string, unknown>` does not prove a key is honored.
- **Treating mocked widgets as a canonical backend contract.** `statistics.value` and several demo aliases are fixtures; canonical QQQ statistics uses `count`.
- **Editing a route for one table.** The slug route and app tree are generic; change backend metadata or general dispatch behavior.
- **Fetching inside a presentational metadata component.** Keep metadata as a prop where the component pattern expects it; use hooks/API modules at the connected boundary.
- **Calling raw `fetch` for QQQ endpoints.** It bypasses versioned base URL, credentials, and centralized error/session behavior.
- **Using `name` as display text.** It is an internal identifier; use `label` and a deliberate fallback only when metadata is genuinely absent.
- **Claiming Material theme, custom bundle, URL, or workflow parity from a happy path.** Check the parity ledger, negative/permission rows, and actual browser/back-end acceptance evidence.
- **Testing a static deep link on a generic file server.** QQQ Javalin serves placeholder pages for dynamic paths; standalone Next has its own routing path.

## Completion checklist for an agent change

1. The backend metadata or widget/process producer and the frontend consumer agree on names, types, and payload fields.
2. An authorized user can complete the workflow, while an unauthorized user cannot perform it through the API.
3. Loading, empty, malformed, missing, failed, and retry states are addressed where they apply.
4. Keyboard, focus, labels, responsive phone/tablet behavior, and contrast have been checked for changed UI.
5. Focused tests and the applicable real-server matrix row pass. The final browser claim names the projects actually run.
6. Static export or standalone build, as applicable, works on refresh and direct deep link.
7. Docs and the parity ledger reflect the observed behavior; any open Partial/Missing rows remain visible until proven closed.
