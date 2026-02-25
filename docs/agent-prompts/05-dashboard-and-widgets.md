# Agent Prompt: Package 5 — Dashboard and Widgets

## Your Role

You are an implementation agent. Execute Work Package 5. Follow the plan exactly.

## Before Writing Any Code, Read These Files

1. **Your plan:** `docs/implementation-plans/05-dashboard-and-widgets.md`
2. **API contract:** `docs/implementation-plans/shared-context/api-contract.md`
3. **Type definitions:** `docs/implementation-plans/shared-context/type-definitions.md`
4. **Coding conventions:** `docs/implementation-plans/shared-context/coding-conventions.md`
5. **CLAUDE.md**

## Reference Code (Read for Behavior Parity)

From `qqq-frontend-material-dashboard`:
- `src/qqq/components/widgets/Widget.tsx` — Widget container (label, dropdown, reload, export, help)
- `src/qqq/components/widgets/DashboardWidgets.tsx` — Widget grid orchestrator
- `src/qqq/components/widgets/CompositeWidget.tsx` — Multi-widget container
- `src/qqq/components/widgets/ParentWidget.tsx` — Parent managing children
- `src/qqq/components/widgets/RecordGridWidget.tsx` — Embedded DataGrid with CRUD
- `src/qqq/components/widgets/charts/` — All chart components
- `src/qqq/components/widgets/blocks/` — All block renderers
- `src/qqq/pages/apps/AppHome.tsx` — App home page with dashboard layout

## What Previous Packages Provide (Import From Them)

From Package 1: types, API client, context, layout
From Package 2 (reuse):
- `import { DataGrid } from '@/components/query/DataGrid'` — For RecordGridWidget
- Cell renderers for field value display in widgets
From Package 3 (reuse):
- `import { EntityForm } from '@/components/forms/EntityForm'` — For DynamicFormWidget
- `import { fetchPossibleValues } from '@/lib/api/possible-values'` — For widget dropdown options

## What You Must Build

1. **App Home page** at `src/app/(dashboard)/app/[appName]/page.tsx`
   - Dashboard layout with widget grid
   - Widgets loaded from QAppMetaData.widgets

2. **Widget container** — label, dropdown selectors, reload, export, help
   - Dropdown changes trigger cancel-and-replace data fetch (AbortController)

3. **DashboardWidgets orchestrator** — loads multiple widgets, manages lifecycle

4. **Charts (Recharts):** line, bar, horizontal bar, stacked bar, pie/doughnut
   - Use ResponsiveContainer for all charts

5. **Statistics:** MiniStatisticsCard, MultiStatisticsCard, StatisticsCard

6. **All block types:** TextBlock, BigNumberBlock, UpOrDownNumberBlock, ProgressBarBlock, ButtonBlock, IconBlock, ImageBlock, AudioBlock, DividerBlock, InputFieldBlock

7. **RecordGridWidget** — embedded DataGrid (reuse from P2) with add/edit/delete

8. **Composite/Parent widgets**

9. **Specialized widgets:** PivotTableSetup, FilterAndColumnsSetup, StepperCard, CronUI, ScriptViewer, CustomComponent mount point

10. **API function** in `src/lib/api/widgets.ts`: fetchWidgetData with AbortController cancel-and-replace

## Verification

After each step: `pnpm tsc --noEmit`
When done: verify ALL acceptance criteria.
Final: `pnpm build && pnpm test`
Commit your work.
