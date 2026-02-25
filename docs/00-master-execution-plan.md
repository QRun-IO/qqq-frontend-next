# Master Agent Execution Plan — QQQ Frontend Next

## Your Role

You are the **Master Orchestrator Agent**. Your job is to build the entire QQQ admin UI replacement by spawning and controlling implementation sub-agents, one per work package, in the correct dependency order. You delegate all coding work to sub-agents. You verify their output, handle failures, and ensure the full project compiles and integrates at the end.

## Repository

You are working in `qqq-frontend-next` — a new repo for the Next.js replacement of the QQQ admin UI.

### Critical Files in This Repo

```
docs/
├── qqq-admin-modernization-requirements.md    # Full requirements spec
├── master-architect-agent-prompt.md            # How the plans were designed
├── 00-master-execution-plan.md                 # THIS FILE — your instructions
└── implementation-plans/
    ├── 00-project-overview.md                  # Tech stack, directory structure, conventions
    ├── 01-scaffold-and-auth.md                 # Work Package 1 plan
    ├── 02-record-query.md                      # Work Package 2 plan
    ├── 03-record-view-and-crud.md              # Work Package 3 plan
    ├── 04-process-execution.md                 # Work Package 4 plan
    ├── 05-dashboard-and-widgets.md             # Work Package 5 plan
    ├── 06-polish-and-parity.md                 # Work Package 6 plan
    ├── cross-check-report.md                   # Requirements coverage verification
    ├── shared-context/
    │   ├── api-contract.md                     # API spec — give to every agent
    │   ├── type-definitions.md                 # TypeScript types — give to every agent
    │   └── coding-conventions.md               # Coding standards — give to every agent
    └── review-checklists/
        ├── review-01-scaffold.md through review-06-polish.md
```

### Reference Repos (Read-Only)

If accessible, the agents should also reference:
- `qqq-frontend-material-dashboard` — The current UI being replaced (behavior parity)
- `qqq-frontend-core` — TypeScript model types and API client (types to port)
- `qqq` — Backend middleware (API endpoint source of truth)

---

## Execution Phases

### Phase 1: Foundation (BLOCKING — must complete before any other phase)

**Spawn Agent 1: Package 1 — Scaffold + Auth + Layout Shell**

Instruct the agent:
> Read these files before writing any code:
> - `docs/implementation-plans/01-scaffold-and-auth.md` (your implementation plan)
> - `docs/implementation-plans/shared-context/api-contract.md`
> - `docs/implementation-plans/shared-context/type-definitions.md`
> - `docs/implementation-plans/shared-context/coding-conventions.md`
> - `docs/implementation-plans/00-project-overview.md`
> - `CLAUDE.md`
>
> Also read the reference implementations in `qqq-frontend-material-dashboard`:
> - `src/App.tsx` — Route generation, auth dispatch, layout
> - `src/qqq/components/horseshoe/` — SideNav, NavBar, Breadcrumbs
>
> And from `qqq-frontend-core`:
> - `src/model/**/*.ts` — All TypeScript types to port
> - `src/controllers/QController.ts` — Auth methods
>
> Execute every step in the implementation plan (Steps 1-11).
> After each step, verify: `pnpm tsc --noEmit` passes.
> When done, verify ALL acceptance criteria in Section 9.
> Commit your work.

**Verification gate before proceeding:**
```bash
pnpm dev          # Must start without errors
pnpm build        # Must succeed
pnpm tsc --noEmit # Zero errors
pnpm test         # All tests pass
```

If the agent fails, fix the issues before moving to Phase 2.

---

### Phase 2: Core Pages (CAN BE PARALLEL — no file conflicts)

**Spawn Agent 2: Package 2 — Record Query**

Instruct the agent:
> Read these files before writing any code:
> - `docs/implementation-plans/02-record-query.md` (your implementation plan)
> - `docs/implementation-plans/shared-context/api-contract.md`
> - `docs/implementation-plans/shared-context/type-definitions.md`
> - `docs/implementation-plans/shared-context/coding-conventions.md`
> - `docs/implementation-plans/00-project-overview.md`
> - `CLAUDE.md`
>
> Also read the reference implementation:
> - `qqq-frontend-material-dashboard/src/qqq/pages/records/query/RecordQuery.tsx`
> - `qqq-frontend-material-dashboard/src/qqq/components/query/` (all files)
> - `qqq-frontend-core/src/controllers/QControllerV1.ts` (query/count methods)
>
> Execute every step in the implementation plan.
> The foundation from Package 1 is already in place — import from it.
> After each step: `pnpm tsc --noEmit`
> When done: verify ALL acceptance criteria in Section 9.
> Commit your work.

**Spawn Agent 3: Package 3 — Record View + CRUD**

Instruct the agent:
> Read these files before writing any code:
> - `docs/implementation-plans/03-record-view-and-crud.md` (your implementation plan)
> - `docs/implementation-plans/shared-context/api-contract.md`
> - `docs/implementation-plans/shared-context/type-definitions.md`
> - `docs/implementation-plans/shared-context/coding-conventions.md`
> - `docs/implementation-plans/00-project-overview.md`
> - `CLAUDE.md`
>
> Also read the reference implementation:
> - `qqq-frontend-material-dashboard/src/qqq/pages/records/view/RecordView.tsx`
> - `qqq-frontend-material-dashboard/src/qqq/components/forms/` (all files)
> - `qqq-frontend-material-dashboard/src/qqq/components/forms/EntityForm.tsx`
> - `qqq-frontend-material-dashboard/src/qqq/components/forms/DynamicForm.tsx`
> - `qqq-frontend-core/src/controllers/QController.ts` (CRUD methods: get, create, update, delete)
>
> Execute every step in the implementation plan.
> The foundation from Package 1 is already in place — import from it.
> After each step: `pnpm tsc --noEmit`
> When done: verify ALL acceptance criteria in Section 9.
> Commit your work.

**Verification gate before proceeding:**
Both agents must complete. Then:
```bash
pnpm tsc --noEmit  # Zero errors (both packages together)
pnpm test          # All tests pass
pnpm build         # Must succeed
```

If running in parallel on branches, merge both to main and resolve conflicts before Phase 3.

---

### Phase 3: Process Execution (SEQUENTIAL — needs forms from Package 3)

**Spawn Agent 4: Package 4 — Process Execution**

Instruct the agent:
> Read these files before writing any code:
> - `docs/implementation-plans/04-process-execution.md` (your implementation plan)
> - `docs/implementation-plans/shared-context/api-contract.md`
> - `docs/implementation-plans/shared-context/type-definitions.md`
> - `docs/implementation-plans/shared-context/coding-conventions.md`
> - `CLAUDE.md`
>
> Also read the reference implementation:
> - `qqq-frontend-material-dashboard/src/qqq/pages/processes/ProcessRun.tsx`
> - `qqq-frontend-material-dashboard/src/qqq/components/processes/` (all files)
> - `qqq-frontend-core/src/controllers/QController.ts` (process methods)
>
> IMPORTANT: You must reuse form components from Package 3:
> - Import `EntityForm` from `@/components/forms/EntityForm`
> - Import `DynamicFormField` from `@/components/forms/DynamicFormField`
> - Import form hooks and possible-values utilities
>
> Execute every step. After each: `pnpm tsc --noEmit`.
> When done: verify ALL acceptance criteria.
> Commit your work.

**Verification gate:**
```bash
pnpm tsc --noEmit && pnpm test && pnpm build
```

---

### Phase 4: Dashboard + Widgets (needs DataGrid from P2, forms from P3)

**Spawn Agent 5: Package 5 — Dashboard and Widgets**

Instruct the agent:
> Read these files before writing any code:
> - `docs/implementation-plans/05-dashboard-and-widgets.md` (your implementation plan)
> - `docs/implementation-plans/shared-context/api-contract.md`
> - `docs/implementation-plans/shared-context/type-definitions.md`
> - `docs/implementation-plans/shared-context/coding-conventions.md`
> - `CLAUDE.md`
>
> Also read the reference implementation:
> - `qqq-frontend-material-dashboard/src/qqq/components/widgets/` (all files — 60+)
> - `qqq-frontend-material-dashboard/src/qqq/pages/apps/AppHome.tsx`
>
> IMPORTANT: Reuse components from previous packages:
> - DataGrid from Package 2 (`@/components/query/DataGrid`) for RecordGridWidget
> - EntityForm from Package 3 (`@/components/forms/EntityForm`) for DynamicFormWidget
> - Cell renderers from Package 2 for field value display in widgets
>
> Execute every step. After each: `pnpm tsc --noEmit`.
> When done: verify ALL acceptance criteria.
> Commit your work.

**Verification gate:**
```bash
pnpm tsc --noEmit && pnpm test && pnpm build
```

---

### Phase 5: Polish + Parity (needs EVERYTHING)

**Spawn Agent 6: Package 6 — Polish, Parity, and Production Readiness**

Instruct the agent:
> Read these files before writing any code:
> - `docs/implementation-plans/06-polish-and-parity.md` (your implementation plan)
> - `docs/implementation-plans/shared-context/coding-conventions.md`
> - `CLAUDE.md`
>
> Also read the reference implementation for features unique to this package:
> - `qqq-frontend-material-dashboard/src/qqq/components/misc/CommandMenu.tsx`
> - `qqq-frontend-material-dashboard/src/qqq/components/audits/AuditBody.tsx`
> - `qqq-frontend-material-dashboard/src/qqq/pages/records/developer/`
> - `qqq-frontend-material-dashboard/src/qqq/components/scripts/ScriptViewer.tsx`
>
> This is the final package. ALL previous packages are complete.
> Your job is: responsive audit, accessibility fixes, command palette, keyboard shortcuts,
> audit trail, developer tools, Storybook, Playwright E2E, performance optimization,
> theme tokens, and customCss injection.
>
> Execute every step. After each: `pnpm tsc --noEmit`.
> When done: verify ALL acceptance criteria.
> Run: `pnpm build && pnpm test && pnpm lint`
> Commit your work.

---

## Final Verification (Master Agent Does This)

After all 6 agents complete:

1. **Full build check:**
```bash
pnpm tsc --noEmit  # Zero errors
pnpm build         # Production build succeeds
pnpm test          # All unit tests pass
pnpm lint          # Zero lint errors
```

2. **Review checklists:** Read and verify each file in `docs/implementation-plans/review-checklists/`:
   - `review-01-scaffold.md` through `review-06-polish.md`
   - Every checkbox should be satisfiable

3. **Cross-check report:** Read `docs/implementation-plans/cross-check-report.md` — all requirements should show ✅

4. **Integration smoke test:** If a backend is available, verify the app end-to-end:
   - Login → sidebar loads → click table → query page loads → filter → paginate → click row → record view → edit → save → delete → navigate to process → run process → dashboard loads widgets

5. **Commit everything and push:**
```bash
git add -A
git commit -m "Complete QQQ Admin UI Modernization — all 6 work packages implemented"
git push origin main
```

---

## Error Recovery

If an agent fails mid-execution:
1. Read its error output
2. Fix the immediate issue (missing import, type error, etc.)
3. Resume the agent from where it left off (it should be able to continue from the last successful step)
4. If the failure is architectural (wrong approach), read the relevant section of the implementation plan and correct course

If agents produce conflicting code (e.g., both define the same component):
1. The implementation plans are designed to avoid this — each package owns specific files
2. If it happens, the later package's version wins (it has more context)
3. Verify the merged result compiles: `pnpm tsc --noEmit`

---

## Key Constraints for ALL Agents

- **pnpm only** (not npm, not yarn)
- **TypeScript strict** — no `any` in component props
- **Every interactive element** gets `data-qqq-id` attribute
- **All API calls** through `src/lib/api/` — never raw fetch/axios
- **Metadata-driven** — no hardcoded table/field/process names
- **Labels not names** — user-facing text uses `label` from metadata
- **Import order** — React/Next → external libs → types → lib → components
- **Error boundaries** at route level and widget level
- **Loading skeletons** for all async content
- **Empty states** with action buttons for all list/grid views
