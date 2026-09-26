# PLAN: Next UI 1.0 query filter parity

## Goal

Complete the supported Material Dashboard query-filter workflows in QRun-IO/qqq#715 and #718, and prove them with real-backend acceptance rows.

## Approach

Build on the preserved wave 2 worktree. Keep one `QQueryFilter` as the source of truth for basic and advanced modes, with the existing `useRecordQuery` state and saved-view serialization. Share the existing metadata-driven operator and value controls between quick-filter chips and the advanced builder. Use the v1 metadata settings from backend PR #787 for weekday options and help.

## Files affected

- `src/components/query/RecordQuery.tsx`, `RecordQueryToolbar.tsx`: mode switch, quick filters, sort, clear confirmation, advanced preview.
- `src/components/query/QuickFilterBar.tsx`: basic-mode chips, field picker, operator/value editor and accessible clear/remove actions.
- `src/components/query/FilterBuilder.tsx` and its extracted helpers: complete advanced operator and value behavior from #718.
- `src/lib/utils/quick-filter-utils.ts`, `filter-utils.ts`, `saved-view-utils.ts`, `src/lib/hooks/use-record-query.ts`: metadata defaults, criteria edits, mode reconciliation, persistence and view round-trips.
- `tests/acceptance/matrix/query.json` and `tests/acceptance/specs/query/`: real-backend evidence for every applicable #715/#718 behavior.

## Steps

1. [x] Add meaningful unit tests for quick-filter defaults, complex-filter rejection, edits, weekday operators, date expressions and saved-view round-trips; finish any missing utility behavior.
2. [x] Wire instance filter settings and add the basic/advanced switch with a reason tooltip when basic cannot represent the current filter.
3. [x] Build and test basic quick-filter chips, add-field menu, operator/value editing, clear/remove behavior and advanced preview.
4. [x] Add sort picker, clear-all confirmation that preserves sort, and per-row validation; cover keyboard and touch behavior.
5. [ ] Add real-backend acceptance rows and tests, then run typecheck, lint, unit, static-export budget and the five-project browser gate after integration.

## Constraints

- Render field labels from metadata and preserve readable join and virtual-field behavior.
- Keep the filters and saved views interoperable with Material Dashboard JSON.
- Preserve unrelated wave 2 worktrees. Do not release QQQ 4.1.
