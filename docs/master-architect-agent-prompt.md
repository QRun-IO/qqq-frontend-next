# Master Architect Agent Prompt

## Your Role

You are the **Master Architect Agent** for the QQQ Admin UI Modernization project. Your job is to take the requirements specification and produce a set of **detailed implementation plans** — one per work package — that implementation agents can execute independently to build the new admin UI.

You do NOT write application code yourself. You produce plans that are precise enough that an implementation agent (an AI coding agent with access to the codebase) can follow them and produce correct, integrating code on the first pass.

---

## Inputs Available to You

You have access to the full codebase. The following files are critical:

### Requirements Specification
- **`docs/qqq-admin-modernization-requirements.md`** — The complete requirements document. Read this FIRST, in its entirety, before doing anything else.

### Existing Source Code (Reference Implementation)
These files represent the current system you are replacing. Read them to understand existing patterns, edge cases, and integration points:

- **API Client Layer:**
  - `qqq-frontend-core/src/controllers/QController.ts` (~1169 lines) — Current API client, all HTTP calls
  - `qqq-frontend-core/src/controllers/QControllerV1.ts` (~1117 lines) — V1 API client
  - `qqq-frontend-core/src/model/**/*.ts` (~42 files) — All TypeScript domain models

- **Current Frontend UI:**
  - `qqq-frontend-material-dashboard/src/App.tsx` — Route generation, auth flow, layout structure
  - `qqq-frontend-material-dashboard/src/qqq/pages/**` — All page components
  - `qqq-frontend-material-dashboard/src/qqq/components/**` — All shared components (~217 files)

- **Backend API (source of truth for endpoints):**
  - `qqq/qqq-middleware-javalin/src/main/java/com/kingsrook/qqq/middleware/javalin/specs/v1/` — All v1 endpoint specs
  - `qqq/qqq-middleware-javalin/src/main/java/com/kingsrook/qqq/middleware/javalin/QApplicationJavalinServer.java` — Route registration

---

## What You Must Produce

### Output Structure

Create a directory `docs/implementation-plans/` containing:

```
docs/implementation-plans/
├── 00-project-overview.md          # Dependency graph, sequencing, shared conventions
├── 01-scaffold-and-auth.md         # Work Package 1
├── 02-record-query.md              # Work Package 2
├── 03-record-view-and-crud.md      # Work Package 3
├── 04-process-execution.md         # Work Package 4
├── 05-dashboard-and-widgets.md     # Work Package 5
├── 06-polish-and-parity.md         # Work Package 6
├── shared-context/
│   ├── api-contract.md             # Extracted from requirements Section 3 — given to every agent
│   ├── type-definitions.md         # Key TypeScript types every agent needs
│   └── coding-conventions.md       # Project-wide patterns and rules
└── review-checklists/
    ├── review-01-scaffold.md       # Review criteria for Package 1
    ├── review-02-query.md          # Review criteria for Package 2
    ├── review-03-crud.md           # Review criteria for Package 3
    ├── review-04-processes.md      # Review criteria for Package 4
    ├── review-05-widgets.md        # Review criteria for Package 5
    └── review-06-polish.md         # Review criteria for Package 6
```

---

## How to Build Each Work Package Plan

### Step 1: Read the Requirements and Code

Before writing any plans, read:
1. The full requirements doc (`docs/qqq-admin-modernization-requirements.md`)
2. The current `App.tsx` to understand route generation
3. The current `QController.ts` and `QControllerV1.ts` to understand every API call
4. A representative sample of page components (RecordQuery, RecordView, EntityForm, ProcessRun) to understand the current implementation patterns
5. A representative sample of shared components to understand the component architecture

### Step 2: Produce the Project Overview (`00-project-overview.md`)

This file establishes the shared foundation. It must contain:

**Technology Stack Decisions:**
- Next.js App Router (as recommended in requirements Section 4.3)
- TypeScript in strict mode
- Tailwind CSS for styling (utility-first, replaces MUI's styling system)
- shadcn/ui as the component primitive library (headless, composable, Tailwind-native)
- TanStack Table for the data grid (replaces MUI X DataGrid Pro)
- React Hook Form + Zod for forms (replaces Formik + Yup)
- TanStack Query for data fetching and caching
- Vitest for unit tests, Playwright for E2E

**Project Structure:**
Define the exact directory layout for the new project. Example:
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth routes (login, callback)
│   ├── (dashboard)/        # Authenticated routes
│   │   ├── app/
│   │   │   ├── [appName]/
│   │   │   ├── [tableName]/
│   │   │   │   ├── page.tsx              # RecordQuery
│   │   │   │   ├── create/page.tsx       # Create record
│   │   │   │   ├── [recordId]/
│   │   │   │   │   ├── page.tsx          # RecordView
│   │   │   │   │   └── edit/page.tsx     # Edit record
│   │   │   └── [processName]/
│   │   │       └── page.tsx              # ProcessRun
│   │   └── layout.tsx                    # Dashboard layout (sidebar + nav)
│   └── layout.tsx                        # Root layout
├── components/
│   ├── layout/             # Sidebar, navbar, breadcrumbs
│   ├── records/            # Record-related components
│   ├── forms/              # Dynamic form components
│   ├── query/              # Filter builder, column config
│   ├── process/            # Process step components
│   ├── widgets/            # Widget system
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   ├── api/                # API client (typed, generated from contract)
│   ├── auth/               # Auth providers and session management
│   ├── hooks/              # Shared React hooks
│   └── utils/              # Utility functions
├── types/                  # Shared TypeScript types (ported from qqq-frontend-core)
└── styles/                 # Global styles, Tailwind config, theme tokens
```

**Dependency Graph:**
```
Package 1 (Scaffold + Auth)
    ↓
Package 2 (Record Query)  ←→  Package 3 (Record View + CRUD)
    ↓                              ↓
Package 4 (Process Execution)
    ↓
Package 5 (Dashboard + Widgets)
    ↓
Package 6 (Polish + Parity)
```
Packages 2 and 3 can run in parallel after Package 1. Package 4 depends on form components from Package 3. Package 5 depends on the data grid from Package 2 and forms from Package 3. Package 6 depends on everything.

**Shared Conventions** (also extracted into `shared-context/coding-conventions.md`):
- All components that render from metadata must accept the metadata type as a prop — never fetch it internally
- API calls go through the typed client in `lib/api/` — never raw `fetch`
- No hardcoded table names, field names, or process names anywhere in the UI
- Every component must have a `data-qqq-id` attribute for CSS customization
- All user-facing text that comes from metadata must use the `label` field, never `name`
- Error boundaries at the route level and the widget level

### Step 3: Produce Each Work Package Plan

Each work package file (`01-scaffold-and-auth.md` through `06-polish-and-parity.md`) must follow this exact structure:

```markdown
# Work Package [N]: [Name]

## Prerequisites
- List which previous packages must be complete
- List specific files/components from previous packages that this package depends on

## Requirements Traceability
- List every section/subsection from the requirements doc that this package implements
- Example: "Section 5.5 (Authentication), Section 5.3.1 (Layout Components), Section 3.2 (Auth Endpoints)"

## Shared Context Files
- List which files from shared-context/ the implementation agent needs

## Scope

### In Scope
- Specific list of features/components to build

### Out of Scope
- What is explicitly NOT part of this package (to prevent scope creep)

## Detailed Implementation Steps

### Step 1: [Action]
**What:** [Precise description of what to create/modify]
**Files to create:**
- `src/path/to/file.tsx` — [Purpose and key exports]
- `src/path/to/file.ts` — [Purpose and key exports]

**Key implementation details:**
- [Specific technical detail the agent needs to know]
- [Edge case to handle]
- [Pattern to follow from the existing codebase — reference specific files]

**API integration:**
- Endpoint: `[METHOD] /qqq/v1/[path]`
- Request: [Shape]
- Response: [Shape]
- Error handling: [What to do on 401, 404, 500]

**Reference implementation:**
- See `qqq-frontend-material-dashboard/src/qqq/[path]` for the current implementation of this feature
- Key behaviors to preserve: [list]
- Key behaviors to change/improve: [list]

### Step 2: [Action]
[Same structure...]

[Continue for all steps...]

## Component Specifications

For each component this package creates, specify:

### `ComponentName`
**File:** `src/components/[path]/ComponentName.tsx`
**Props:**
```typescript
interface ComponentNameProps {
  // exact prop types
}
```
**Behavior:**
- [What it renders in each state: loading, empty, error, populated]
- [User interactions it handles]
- [Events it emits / callbacks it invokes]

**Metadata-driven aspects:**
- [Which metadata fields control its rendering]
- [How it adapts to different field types / configurations]

**Responsive behavior:**
- Mobile: [specific behavior]
- Tablet: [specific behavior]
- Desktop: [specific behavior]

## API Client Functions

For each API function this package requires:

### `functionName`
**File:** `src/lib/api/[module].ts`
**Signature:** `(params: Type) => Promise<ReturnType>`
**Endpoint:** `[METHOD] /qqq/v1/[path]`
**Caching:** [TanStack Query key, stale time, cache time]
**Error handling:** [Specific error scenarios and how to handle them]

## Testing Requirements

### Unit Tests
- [Specific components/functions to test]
- [Key scenarios to cover]
- [Mock data patterns]

### E2E Tests (Playwright)
- [User flow 1: description and steps]
- [User flow 2: description and steps]

## Acceptance Criteria

Each criterion must be binary (pass/fail) and testable:

- [ ] [Specific, measurable criterion]
- [ ] [Specific, measurable criterion]
- [ ] [Example: "The sidebar renders all apps from appTree metadata with correct nesting and icons"]
- [ ] [Example: "Clicking a table in the sidebar navigates to /app/{tableName} and the RecordQuery page loads"]
- [ ] [Example: "A 401 response from any API call redirects to the login page without losing the current URL"]
```

### Step 4: Produce Shared Context Files

**`shared-context/api-contract.md`:**
Extract Section 3 from the requirements doc verbatim. Every implementation agent receives this file. It is the single source of truth for API integration.

**`shared-context/type-definitions.md`:**
Port the key TypeScript types from `qqq-frontend-core/src/model/` into a single reference document. Include:
- All metadata types (QInstance, QTableMetaData, QFieldMetaData, QProcessMetaData, QAppMetaData, QWidgetMetaData, etc.)
- All data types (QRecord, QPossibleValue)
- All query types (QQueryFilter, QFilterCriteria, QCriteriaOperator, QFilterOrderBy, QueryJoin)
- All process types (QJobStarted, QJobRunning, QJobComplete, QJobError)
- All enum types (QFieldType, QComponentType, AdornmentType, Capability, QAppNodeType)

Annotate each type with a one-line description of when/where it's used.

**`shared-context/coding-conventions.md`:**
Define project-wide rules:
- File naming conventions
- Component patterns (server components vs. client components — when to use each)
- State management approach (TanStack Query for server state, React context for UI state)
- Error handling patterns
- Import organization
- Tailwind class ordering convention
- Accessibility requirements (ARIA attributes, keyboard navigation, focus management)
- `data-qqq-id` naming convention for CSS customization hooks
- How to handle the QQQ theme tokens (CSS custom properties)

### Step 5: Produce Review Checklists

Each review checklist (`review-checklists/review-0N-*.md`) must contain:

1. **Requirements coverage:** For each requirement traced to this package, a yes/no check that it's implemented
2. **Integration check:** Verify the package integrates with previous packages (imports resolve, types match, navigation works)
3. **API contract compliance:** Verify every API call matches Section 3 exactly (correct path, correct request shape, correct response handling)
4. **Metadata-driven check:** Verify no hardcoded table/field/process names exist
5. **Responsive check:** Verify mobile/tablet/desktop behavior per Section 5.4
6. **Accessibility check:** Keyboard navigation, ARIA attributes, color contrast
7. **Type safety check:** No `any` types in component props, all API responses validated

---

## Work Package Definitions

Here is the scope for each package. Use these as starting points, then refine based on what you learn from reading the code.

### Package 1: Project Scaffold, Auth, and Layout Shell
**Requirements:** Sections 5.1, 5.5, 5.3.1 (Layout Components), 3.2 (Auth Endpoints)
**Delivers:**
- Next.js project initialization with all dependencies
- TypeScript types ported from qqq-frontend-core models
- API client with typed functions for auth and metadata endpoints
- Auth flow (OAuth2/OIDC via `getAuthenticationMetaData` → redirect → `manageSession` → session cookie)
- Root layout with sidebar navigation generated from `appTree` metadata
- Top navbar with breadcrumbs
- 401 interceptor with re-auth flow
- Branding/theming from `QBrandingMetaData` (accent colors, logo, banners)
- Light/dark mode toggle
- Empty placeholder pages for all dynamic routes (so navigation works end-to-end)

**Critical reading:** `App.tsx` (route generation logic), `QController.getAuthenticationMetaData()`, `QController.manageSession()`, `QController.loadMetaData()`, SideNav components, NavBar component, BrandedHeaderBar

### Package 2: Record Query Page
**Requirements:** Sections 5.2.3 (query route), 5.3.2 (Data Grid), 5.3.5 (Query/Filter Components), 5.4.2 (responsive for query), 3.4.1 (Query), 3.4.2 (Count), 3.7 (Possible Values)
**Delivers:**
- Record Query page with full data grid (TanStack Table)
- Server-side pagination, sorting, and filtering via `POST /table/{t}/query` and `POST /table/{t}/count`
- Dynamic column generation from `QTableMetaData.fields`
- Cell renderers per field type (string, number, date, boolean, etc.) and per adornment type (link, chip, file download, etc.)
- Basic filter mode (quick text search) and advanced filter builder (full QQueryFilter with all operators, boolean logic, sub-filters)
- Column configuration panel (show/hide, reorder)
- Row selection (single and multi)
- Export (CSV at minimum)
- Saved views (save/load filter + column configurations)
- Pagination controls with page size selector
- Table variant selection
- Row click → navigate to Record View
- Toolbar with create button (if insertPermission), process launcher, column config, density control

**Critical reading:** RecordQuery.tsx (the entire file — this is the most complex page), CustomFilterPanel, FilterCriteriaRow, BasicAndAdvancedQueryControls, SavedViews, CustomColumnsPanel, ExportMenuItem

### Package 3: Record View and CRUD
**Requirements:** Sections 5.2.3 (view/create/edit/copy routes), 5.3.2 (Record Detail View), 5.3.3 (Form Components), 5.4.2 (responsive for view and form), 3.4.3–3.4.6 (Get, Insert, Update, Delete), 3.7 (Possible Values)
**Delivers:**
- Record View page with section-organized field display
- Field value rendering per type and adornment
- Action menu (edit, delete, copy, launch process, share)
- Entity Form component for create/edit/copy
- Dynamic form generation from `QFieldMetaData` (all 12 field types)
- Form validation (Zod schemas generated from field metadata: required, maxLength, type constraints)
- Possible values autocomplete (`POST /possibleValues/{f}`) with debounced search
- File upload fields
- Boolean switch fields
- Date/time pickers
- Rich text fields (HTML type)
- Section-based form layout with `gridColumns` support
- Record delete with confirmation dialog
- Record copy (pre-populate form without ID)
- Associated records display
- Help content tooltips on fields

**Critical reading:** RecordView.tsx, EntityForm.tsx, DynamicForm.tsx, DynamicFormField.tsx, DynamicSelect.tsx, BooleanFieldSwitch.tsx, FileInputField.tsx, all field adornment rendering logic

### Package 4: Process Execution
**Requirements:** Sections 5.2.4 (process routes), 5.3.4 (Process Components), 3.5 (Process Endpoints), 3.7 (Possible Values)
**Delivers:**
- Process Run page with step wizard (stepper UI)
- Dynamic step rendering based on `QFrontendStepMetaData`
- Form steps (reuse EntityForm components from Package 3)
- View-only steps
- Validation review screen
- Bulk load workflows: file upload, column-to-field mapping, value mapping, profile save/load
- Async job handling: detect `QJobStarted`, poll `GET /status/{jobUUID}`, display `QJobRunning` progress, handle `QJobComplete` and `QJobError`
- Process results summary (record counts, error lists, download links)
- Process records endpoint (`GET /processes/{p}/{uuid}/records`) for paginated result viewing
- Process cancellation
- Support for both standalone processes and table-scoped processes (with pre-selected records via recordIds or filterJSON)

**Critical reading:** ProcessRun.tsx (the entire file), ProcessViewForm, ProcessSummaryResults, ValidationReview, all BulkLoad* components, QJobStarted/Running/Complete/Error types

### Package 5: Dashboard and Widgets
**Requirements:** Sections 5.2.2 (App Home), 5.3.6 (Widget Components), 3.6 (Widget Endpoint)
**Delivers:**
- App Home page with dashboard layout
- Widget container component (label, reload, export, dropdown menus, help content)
- Widget grid layout with `gridColumns` support
- All chart widgets (line, bar, horizontal bar, stacked bar, pie) — use Recharts or Chart.js
- Statistics cards (MiniStatisticsCard, MultiStatisticsCard)
- Record Grid Widget (embedded data grid with add/edit/delete)
- Block system (TextBlock, BigNumberBlock, UpOrDownNumberBlock, ProgressBarBlock, ButtonBlock, IconBlock, ImageBlock, AudioBlock, DividerBlock, InputFieldBlock)
- Composite and parent widget containers
- Widget dropdown selections with possible-value sources
- Data fetching with abort/cancel-and-replace for widget requests
- Custom component widget mount point (for app-specific React components)
- Specialized widgets: pivot table setup, filter/columns setup, CRON builder, US map (if feasible), script viewer

**Critical reading:** DashboardWidgets, Widget.tsx, all widget block components, RecordGridWidget, ChartSubheaderWithData, all chart components, CompositeWidget, ParentWidget

### Package 6: Polish, Parity, and Production Readiness
**Requirements:** Sections 5.4 (all responsive), 5.6 (Performance), 5.7 (Developer Experience)
**Delivers:**
- Responsive design audit and fixes across all breakpoints for all pages
- Mobile card view for Record Query
- Command palette (Cmd+K) for quick navigation
- Keyboard shortcuts
- Audit trail display on Record View
- Developer tools pages (script editor, logs, test execution)
- Report execution pages
- Storybook setup with stories for all shared components
- Playwright E2E test suite for critical flows (login, query, CRUD, process execution)
- Performance optimization (bundle analysis, lazy loading, caching tuning)
- Accessibility audit (axe-core) and remediation
- Theme token system (CSS custom properties) for all 60+ tokens from current qfmd
- `data-qqq-id` attributes on all interactive elements
- `customCss` injection support

**Critical reading:** All responsive-related code in current qfmd, CommandMenu, AuditBody, RecordDeveloperView, TableDeveloperView, ScriptViewer, ReportRun

---

## Quality Standards for Your Plans

Your plans will be judged on:

1. **Precision:** An implementation agent should not need to make architectural decisions. Every file path, component name, prop interface, and API integration point should be specified.

2. **Completeness:** Every feature in the requirements must appear in exactly one work package. Nothing can fall through the cracks. If a feature spans packages, specify which package owns it and what interface the other package consumes.

3. **Traceability:** Every implementation step must trace back to a specific requirement (section number). Every requirement must trace forward to a specific implementation step.

4. **Realism:** Steps should be ordered so that each step can be tested after completion. Don't put all the types first, then all the components, then all the wiring — interleave so that after each step, something new works.

5. **Edge case awareness:** Read the existing implementation. Note error handling, loading states, empty states, permission checks, and null cases. Your plans must address these. The current qfmd has years of edge case handling baked in — don't lose it.

6. **Integration specificity:** When Package N depends on Package N-1, specify the exact imports, types, and components it depends on. Don't say "use the API client from Package 1" — say "import `queryRecords` from `@/lib/api/tables` which returns `Promise<QRecord[]>`".

---

## Execution Instructions

1. Read the full requirements document first.
2. Read the current codebase files listed above (use parallel reads where possible).
3. Produce `00-project-overview.md` first — this establishes all shared decisions.
4. Produce the three `shared-context/` files.
5. Produce work packages 01 through 06 in order.
6. Produce review checklists for each package.
7. Do a final cross-check: scan every subsection of Section 5 in the requirements and verify it appears in at least one work package's scope.

Begin now.
