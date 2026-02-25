# Agent Prompt: Package 1 — Scaffold, Auth, and Layout Shell

## Your Role

You are an implementation agent. Your job is to execute the implementation plan for Work Package 1 and produce working, tested code. You do NOT make architectural decisions — the plan specifies everything. Follow it exactly.

## Before Writing Any Code, Read These Files

1. **Your work package plan:** `docs/implementation-plans/01-scaffold-and-auth.md` — This is your primary instruction set. Execute every step.
2. **Shared context — API contract:** `docs/implementation-plans/shared-context/api-contract.md` — Every API call must match this exactly.
3. **Shared context — Type definitions:** `docs/implementation-plans/shared-context/type-definitions.md` — Port these types into `/src/types/`.
4. **Shared context — Coding conventions:** `docs/implementation-plans/shared-context/coding-conventions.md` — Follow these patterns.
5. **Project overview:** `docs/implementation-plans/00-project-overview.md` — Directory structure and shared conventions.
6. **CLAUDE.md** — Project-level conventions.

## Reference Code (Read for Behavior Parity)

Look at the sibling repo `qqq-frontend-material-dashboard` for:
- `src/App.tsx` — Route generation from appTree, auth dispatch, layout structure
- `src/qqq/components/horseshoe/` — SideNav, NavBar, Breadcrumbs, Footer
- `src/qqq/components/misc/Banners.tsx` — Banner rendering

Also look at `qqq-frontend-core` for:
- `src/controllers/QController.ts` — Auth methods (getAuthenticationMetaData, manageSession)
- `src/model/**/*.ts` — All TypeScript model types to port

## What You Must Deliver

Execute Steps 1-11 from the work package plan. After completion:

1. `pnpm dev` runs without errors
2. `pnpm build` succeeds
3. `pnpm tsc --noEmit` — zero errors
4. `pnpm test` — all unit tests pass
5. Sidebar renders navigation from metadata (use mock data if no backend)
6. Auth flow initializes (AUTH_0, OAUTH2, FULLY_ANONYMOUS)
7. All placeholder pages exist and render within the dashboard layout
8. Theme system injects CSS custom properties
9. 401 interceptor triggers redirect
10. Breadcrumbs render from pathname

## Verification

After completing all steps, check every acceptance criterion in Section 9 of the work package plan. Every criterion must pass before this package is done.

## Important Rules

- Use `pnpm` (not npm or yarn)
- TypeScript strict mode — no `any` in component props
- Every interactive element gets a `data-qqq-id` attribute
- All API calls go through `src/lib/api/` — never raw fetch
- Follow the import order convention from CLAUDE.md
- Commit after each major step so progress isn't lost
