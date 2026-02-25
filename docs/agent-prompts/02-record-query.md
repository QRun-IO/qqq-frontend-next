# Agent Prompt: Package 2 — Record Query Page

## Your Role

You are an implementation agent. Execute the implementation plan for Work Package 2 and produce working, tested code. Follow the plan exactly — do not make architectural decisions.

## Before Writing Any Code, Read These Files

1. **Your plan:** `docs/implementation-plans/02-record-query.md`
2. **API contract:** `docs/implementation-plans/shared-context/api-contract.md`
3. **Type definitions:** `docs/implementation-plans/shared-context/type-definitions.md`
4. **Coding conventions:** `docs/implementation-plans/shared-context/coding-conventions.md`
5. **Project overview:** `docs/implementation-plans/00-project-overview.md`
6. **CLAUDE.md**

## Reference Code (Read for Behavior Parity)

From `qqq-frontend-material-dashboard`:
- `src/qqq/pages/records/query/RecordQuery.tsx` — THE most complex page. Read the whole thing. Note the 260+ state variables, the page state machine, query deduplication via latestQueryId, localStorage persistence.
- `src/qqq/components/query/FilterCriteriaRow.tsx` — Per-row filter UI with operator selection per field type
- `src/qqq/components/query/BasicAndAdvancedQueryControls.tsx` — Basic/advanced filter toggle
- `src/qqq/components/query/CustomFilterPanel.tsx` — Full filter builder
- `src/qqq/components/query/CustomColumnsPanel.tsx` — Column show/hide/reorder
- `src/qqq/components/misc/SavedViews.tsx` — Saved view CRUD
- `src/qqq/components/query/ExportMenuItem.tsx` — Export to CSV

From `qqq-frontend-core`:
- `src/controllers/QControllerV1.ts` — `query()` and `count()` methods
- `src/model/query/QQueryFilter.ts` — Filter structure
- `src/model/query/QCriteriaOperator.ts` — All 20 operators

## What Package 1 Already Provides (Import From It)

- Types: `import type { QTableMetaData, QFieldMetaData, QRecord, QQueryFilter, QFilterCriteria, QCriteriaOperator } from '@/types'`
- API client: `import apiClient from '@/lib/api/client'`
- Query keys: `import { queryKeys } from '@/lib/query-client'`
- Metadata: `import { loadTableMetaData } from '@/lib/api/metadata'`
- Context: `import { useQContext } from '@/lib/context/q-context'`
- Layout components are in place — your page renders inside the dashboard layout

## What You Must Build

Replace the placeholder at `src/app/(dashboard)/app/[tableName]/page.tsx` with a full Record Query page featuring:
- TanStack Table v8 data grid with dynamic columns from QTableMetaData.fields
- Server-side pagination (offset/limit via POST /table/{t}/query + /count)
- Cell renderers per QFieldType (STRING, INTEGER, DECIMAL, BOOLEAN, DATE, DATE_TIME, etc.)
- Cell renderers per AdornmentType (LINK, CHIP, FILE_DOWNLOAD, etc.)
- Basic filter (quick text search) and advanced filter builder (all 20 operators, AND/OR, sub-filters)
- Column config (show/hide, reorder, persist to localStorage)
- Row selection (checkbox column, single and multi)
- Export to CSV
- Saved views (save/load filter + column configs)
- Pagination with page size selector (10/25/50/100)
- Table variant selection
- Toolbar (create button, process launcher, column config, density, saved views)
- Row click → navigate to record view

## Verification

After each step: `pnpm tsc --noEmit`
When done: verify ALL acceptance criteria in Section 9 of the plan.
Final check: `pnpm build && pnpm test`
Commit your work.

## Important Rules

- All API calls through `src/lib/api/` — create `src/lib/api/tables.ts` for query/count functions
- Use TanStack Table v8 (NOT MUI DataGrid)
- Use TanStack Query v5 for data fetching
- Every component gets `data-qqq-id` attribute
- No hardcoded column names — everything from metadata
- TypeScript strict — no `any` in props
