# Design & UX Review — QQQ Frontend Next
**Date:** 2026-03-01
**Reviewer:** Claude Code (automated static analysis)
**Scope:** Full codebase UX/design audit — layout, pages, forms, process, widgets, feedback, theme, responsive, and a11y

---

## Executive Summary

The new frontend has strong bones: metadata-driven rendering is correctly implemented, component composition is clean, TanStack Query manages server state well, and the base accessibility implementation (labels, aria-required, focus rings, skip nav on breadcrumbs) is solid. The primary gaps fall into three categories:

1. **Accessibility** — several WCAG 2.1 AA gaps in the data grid, animations, and motion preferences
2. **Mobile/responsive polish** — search hidden on mobile, touch targets below 44px minimum in several places
3. **Loading/error state coverage** — a handful of async operations show no spinner or fallback

No showstopper UX regressions from the Material UI frontend were found. The issues below are incremental improvements.

---

## Severity Legend

| Severity | Meaning |
|----------|---------|
| **CRIT** | WCAG 2.1 Level A violation or severe usability break |
| **HIGH** | WCAG 2.1 AA violation or significant UX regression |
| **MED** | Noticeable UX gap, inconsistency, or missing polish |
| **LOW** | Minor polish, nice-to-have, or future consideration |

---

## 1. Layout Shell

**Files:** `src/components/layout/Sidebar.tsx`, `Header.tsx`, `Breadcrumbs.tsx`, `Banner.tsx`, `src/app/(dashboard)/layout.tsx`

### Strengths
- Desktop sidebar + mobile drawer correctly split at `md` breakpoint
- Breadcrumbs have `aria-label="Breadcrumb"` and `aria-current="page"`
- Escape key closes mobile drawer; sidebar items have focus rings
- Banner severity states (info/warning/error) correctly scoped with icons

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| D-L-1 | **HIGH** | **No skip-to-content link.** Keyboard users must tab through the entire sidebar before reaching page content. Add `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a>` as the first child of `<body>`. |
| D-L-2 | **HIGH** | **Animations ignore `prefers-reduced-motion`.** Sidebar slide-in, banner fade-in, and skeleton `animate-pulse` all run unconditionally. Add `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` to `globals.css`. |
| D-L-3 | **MED** | **Header search hidden on mobile** (`hidden md:block`). Mobile users lose global search entirely. Add a search icon button on mobile that opens `SearchDialog`. |
| D-L-4 | **MED** | **Dismissed banners not persisted.** Banners dismissed via local state reappear on reload. Save dismissed banner keys to `localStorage` under `qqq:dismissed-banners`. |
| D-L-5 | **MED** | **Mobile sidebar `aria-expanded` not set.** The mobile drawer open/closed state isn't announced to screen readers. Add `aria-expanded={mobileOpen}` to the nav landmark element. |
| D-L-6 | **LOW** | **Breadcrumb overflow on very narrow viewports** (<320px). Long breadcrumb chains don't truncate; last segment can overflow. Add `truncate` + `max-w-[8rem]` on intermediate segments. |
| D-L-7 | **LOW** | **Sidebar nav has no loading skeleton.** During the initial metadata fetch the sidebar is empty with no placeholder. Add skeleton nav items matching the expected structure. |

---

## 2. Record Query (List View)

**Files:** `src/components/query/DataGrid.tsx`, `FilterBuilder.tsx`, `Pagination.tsx`, `RecordQueryToolbar.tsx`, `RecordCardView.tsx`, `ColumnConfig.tsx`

### Strengths
- Skeleton rows during fetch match final layout (no layout shift)
- Three row density variants (compact/standard/comfortable) with persistence
- Empty state with icon, title, and "Clear filters" CTA
- Quick-search debounced at 300ms

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| D-Q-1 | **CRIT** | **DataGrid missing `aria-sort` on column headers.** When a column is sorted, screen readers don't announce direction. Add `aria-sort="ascending" \| "descending" \| "none"` to each `<th>` based on current sort state. |
| D-Q-2 | **HIGH** | **Row selection checkboxes have no label.** Each row checkbox announces "checkbox" with no context. Add `aria-label={\`Select ${recordLabel}\`}` to each. |
| D-Q-3 | **HIGH** | **Column resize handles not keyboard accessible.** Resize is mouse-drag only. Keyboard users cannot adjust column widths. Add `onKeyDown` handler supporting `ArrowLeft`/`ArrowRight` to the resize handle element. |
| D-Q-4 | **MED** | **FilterBuilder async combobox has no loading indicator.** While possible-value options are fetching, the dropdown appears empty with no spinner. Add a `Loader2` icon while `isLoading` is true. |
| D-Q-5 | **MED** | **"Go to page" input silently ignores out-of-range values.** Typing a page number beyond the last page does nothing with no feedback. Show an inline validation message like "Page must be between 1 and N". |
| D-Q-6 | **MED** | **No `aria-live` region for fetch-in-progress.** Background re-fetches (sort/filter changes) are visually indicated by the progress bar but not announced. Add `aria-live="polite"` region announcing "Loading results". |
| D-Q-7 | **MED** | **Column visibility toggle state not announced.** Toggling a column in ColumnConfig doesn't notify screen readers. Add a `role="status"` region that announces "Column X hidden" / "Column X visible". |
| D-Q-8 | **LOW** | **No frozen/pinned columns.** The primary key / record label column scrolls out of view on wide tables. Consider pinning the first column on horizontal scroll. |
| D-Q-9 | **LOW** | **RecordCardView touch targets may be too small.** Cards are clickable but no explicit 44px minimum hit area. Ensure card tap targets meet the 44px minimum on mobile. |

---

## 3. Record View (Detail Page)

**Files:** `src/components/records/RecordView.tsx`, `RecordViewHeader.tsx`, `FieldValue.tsx`, `RecordViewAssociated.tsx`

### Strengths
- DOMPurify sanitization applied before rendering HTML field values
- 403/404/500 errors shown with contextual messages
- Tab layout for T2/T3 sections with proper semantic structure
- Field adornment priority correctly handled (LINK → FILE_DOWNLOAD → SIZE → CHIP)

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| D-V-1 | **HIGH** | **Edit/Delete buttons shown regardless of user permissions.** If table metadata indicates the user lacks UPDATE/DELETE rights, buttons should be hidden (or disabled with tooltip). Currently they render and fail with a 403 on action. |
| D-V-2 | **MED** | **Associated records list not paginated.** Many-to-many joins can return thousands of records, all rendered to DOM. Add pagination (or a "Show more" pattern) capped at 25 by default. |
| D-V-3 | **MED** | **Avatar initials fail for non-Latin scripts.** `getInitials()` splits on whitespace which produces empty strings for CJK/Arabic names. Add a fallback to a generic user icon when initials can't be derived. |
| D-V-4 | **MED** | **No delete confirmation dialog.** The delete action currently triggers immediately. Add a confirm dialog ("Delete this record? This cannot be undone.") before the API call. |
| D-V-5 | **LOW** | **No "Copy record ID" quick action.** Admin users frequently need the primary key for support/debugging. Add a small copy-to-clipboard icon next to the record ID. |
| D-V-6 | **LOW** | **No audit trail footer.** No "Last modified by / at" metadata shown. If the backend provides this, surface it at the bottom of the record view. |

---

## 4. Create / Edit Forms

**Files:** `src/components/forms/DynamicForm.tsx`, `EntityForm.tsx`, `DynamicFormField.tsx`, `src/components/forms/field-types/`

### Strengths
- All inputs have `aria-required`, `aria-invalid`, `aria-describedby` wired correctly
- Unsaved-changes guard (`beforeunload` + modal) prevents accidental data loss
- Help tooltips use Radix Tooltip with keyboard support
- Required asterisk is `aria-hidden="true"` to avoid screen-reader repetition
- Disabled state styling consistent across field types

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| D-F-1 | **HIGH** | **Submit button stays enabled during mutation.** User can click Save multiple times before the first request completes, creating duplicate records. Add `disabled={isSubmitting}` and a loading spinner to the submit button. |
| D-F-2 | **MED** | **Number fields don't display min/max constraints.** If field metadata defines `minValue`/`maxValue`, the user doesn't see them until a validation error fires. Show the range as hint text below the field (`0 – 100`). |
| D-F-3 | **MED** | **DateTime fields don't indicate time zone.** The input accepts a time but doesn't show which time zone is assumed. Show the user's local TZ abbreviation next to the field. |
| D-F-4 | **MED** | **Help tooltips not touch-friendly on mobile.** The `?` icon is hover-only and < 44px. On mobile, show the help text inline beneath the label instead. |
| D-F-5 | **MED** | **File upload field has no drag-and-drop visual feedback.** The drop zone changes border on `dragover` but has no text like "Drop file here". Add clear drop-zone copy and a highlight color change. |
| D-F-6 | **LOW** | **No "which fields changed" diff in edit mode.** Users editing a long form can't tell what they've modified at a glance. Consider highlighting changed fields with a left border accent. |
| D-F-7 | **LOW** | **Large forms show all fields at once.** Sections with 20+ fields have no collapse/expand. Consider optional `<details>` sections for secondary field groups. |

---

## 5. Process Execution

**Files:** `src/components/process/ProcessRun.tsx`, `StepWizard.tsx`, `ProcessFormStep.tsx`, `ValidationReviewStep.tsx`, `ProcessUploadFormStep.tsx`, `BulkLoadStep.tsx`

### Strengths
- Step wizard gives clear numbered/checkmark visual progress
- Cancellation confirm dialog prevents accidental process abort
- Back navigation available when not on the first step

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| D-P-1 | **HIGH** | **Current step not auto-focused after "Next".** When advancing to a new step, focus remains on the Next button (now gone), leaving screen reader users disoriented. Move focus to the step heading or first field on step change. |
| D-P-2 | **MED** | **Step wizard steps not keyboard-navigable (back).** Completed steps have no click handler to jump back. Add click-to-navigate on completed step indicators. |
| D-P-3 | **MED** | **No process timeout message.** If the backend hangs, the polling spinner runs indefinitely. After ~60s show "This is taking longer than expected" with an option to wait or cancel. |
| D-P-4 | **MED** | **Validation review results not filterable.** With 1000+ errors, the flat list is unmanageable. Add severity filter buttons (All / Errors / Warnings) and a field-name search. |
| D-P-5 | **MED** | **File upload step has no progress bar.** Large uploads show no byte-level progress. Add a `<progress>` element or Radix Progress during multipart upload. |
| D-P-6 | **MED** | **Step label truncation has no mobile tooltip.** Long step names are truncated at `max-w-[6rem]` with only a `title` attribute, which doesn't appear on touch. Add a Radix Tooltip wrapper. |
| D-P-7 | **LOW** | **No "retry" on process step failure.** Users must restart the entire process from step 1 if one step fails. Add a "Retry this step" button where the backend supports re-running a step. |
| D-P-8 | **LOW** | **Bulk load column mappings not saveable.** Users re-map the same CSV columns every run. Add a "Save this mapping" option persisted to localStorage. |

---

## 6. Widgets & Dashboard

**Files:** `src/components/widgets/WidgetRenderer.tsx`, `StatisticsWidget.tsx`, `BlockWidget.tsx`, `BarChartWidget.tsx`, `LineChartWidget.tsx`, `PieChartWidget.tsx`, `RecordGridWidget.tsx`

### Strengths
- Charts lazy-loaded via dynamic import (non-chart pages don't load Recharts)
- Suspense skeleton placeholder shown while chart chunk loads
- Exhaustive `switch` on widget type with unknown fallback

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| D-W-1 | **HIGH** | **Statistics trend arrows not accessible.** `TrendingUp`/`TrendingDown`/`Minus` icons are `aria-hidden` with no text alternative. Screen readers don't announce whether a metric is up or down. Add `<span className="sr-only">trending up</span>` next to each icon. |
| D-W-2 | **MED** | **Widget data fetch errors show blank space.** If a widget's API call fails there is no error boundary or fallback UI. Add a per-widget error state (icon + "Could not load widget" message + retry). |
| D-W-3 | **MED** | **Chart legends overflow horizontally on mobile.** Recharts legends don't reflow on narrow screens. Use `layout="vertical"` or hide the legend on mobile with a `<ResponsiveContainer>` width check. |
| D-W-4 | **MED** | **RecordGrid widget not paginated.** Renders the full result set to DOM. Cap at 25 rows and add a "View all" link to the full record query page. |
| D-W-5 | **MED** | **No manual widget refresh.** Stale widget data can't be refreshed without a full page reload. Add a small refresh icon button on each widget card header. |
| D-W-6 | **LOW** | **Only 5 chart color tokens defined.** Dashboards with 6+ data series reuse colors, making series indistinguishable. Extend `--color-chart-*` to at least 10 distinct values. |

---

## 7. Feedback Components

**Files:** `src/components/feedback/GlobalSearch.tsx`, `SearchDialog.tsx`, `CommandMenu.tsx`, `EmptyState.tsx`, `ErrorBoundary.tsx`, `KeyboardShortcutsDialog.tsx`

### Strengths
- `EmptyState` uses `role="status"` + `aria-live="polite"` correctly
- Skeleton components have `role="status"` + `aria-busy="true"`
- SearchDialog has full ArrowUp/ArrowDown/Enter/Escape keyboard nav
- `HighlightedText` now correctly uses `i % 2 !== 0` (recently fixed)

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| D-FB-1 | **MED** | **Keyboard Shortcuts dialog not discoverable.** `?` opens it but there is no visible hint in the UI. Add a `?` icon button in the header, or a footer note "Press ? for keyboard shortcuts". |
| D-FB-2 | **MED** | **Toasts have no visible close/dismiss button.** Users must wait for auto-dismiss. Add an × button to each toast (sonner supports `closeButton` prop). |
| D-FB-3 | **MED** | **CommandMenu icon buttons below 44px touch target.** Small icon-only buttons in the command menu are hard to tap on mobile. Ensure `min-h-[44px] min-w-[44px]` on interactive icons. |
| D-FB-4 | **LOW** | **Search results missing table/app context in header.** Results are grouped by table in logic but group labels may not be visually prominent enough. Ensure group headers have sufficient weight/spacing. |

---

## 8. Theme & Global Styles

**Files:** `src/styles/globals.css`, `src/styles/qqq-theme.css`, `src/lib/theme/theme-provider.tsx`, `src/lib/theme/tokens.ts`

### Strengths
- 60+ CSS custom property tokens for colors, spacing, shadows
- Complete dark mode override section
- `:focus-visible` with proper outline and offset
- Muted text color darkened to meet WCAG AA contrast

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| D-T-1 | **HIGH** | **No `prefers-reduced-motion` override.** All animations (skeleton pulse, slide-in transitions, toast fades) run unconditionally. See D-L-2 above — one global CSS rule resolves this. |
| D-T-2 | **HIGH** | **No `prefers-contrast: more` support.** Users with OS high-contrast mode enabled get no enhanced styling. Add a `@media (prefers-contrast: more)` block that increases border weights and ensures 7:1 contrast ratios. |
| D-T-3 | **MED** | **Dual theming systems create token confusion.** `--qqq-primary-color` and `--color-primary` both define the primary color. Components reference both inconsistently. Consolidate to one system (Tailwind v4 `--color-*` preferred) and alias the `--qqq-*` tokens to the canonical values for backwards compatibility. |
| D-T-4 | **MED** | **Z-index tokens defined but not used consistently.** `--qqq-z-sidebar: 100`, `--qqq-z-modal: 1000` exist in the token file but some components use hardcoded values. Use the tokens everywhere. |
| D-T-5 | **LOW** | **Focus ring may be invisible in dark mode.** The `color-mix`-based focus outline color may not contrast sufficiently on dark backgrounds. Test with browser dark mode enabled. |
| D-T-6 | **LOW** | **No disabled-state semantic token.** All disabled states use `opacity-50`. A dedicated `--color-disabled` token would allow more nuanced disabled styling (e.g., different for text vs background). |

---

## 9. Responsive / Mobile

### Strengths
- Sidebar correctly switches between desktop rail and mobile drawer at `md`
- RecordQuery shows bottom-sheet filter panel on mobile
- RecordCardView provides card layout alternative to data grid on mobile
- Pagination uses `flex-wrap` to reflow on narrow screens

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| D-R-1 | **HIGH** | **Mobile `<input>` elements trigger browser zoom.** Inputs with `font-size < 16px` cause iOS Safari to auto-zoom on focus, breaking the layout. Ensure all form inputs have `text-base` (16px) as minimum font size. |
| D-R-2 | **MED** | **Touch targets below 44px in multiple places.** Pagination size selector, density buttons, column config toggles. Audit all interactive elements and ensure `min-h-[44px]` or adequate padding. |
| D-R-3 | **MED** | **No 320px (iPhone SE) layout testing.** Several components assume ≥375px. Run a responsive check at 320px and fix any overflows. |
| D-R-4 | **LOW** | **Landscape tablet layout untested.** At ~768px landscape some components may show desktop layout with insufficient room. Test iPad Mini landscape. |

---

## Priority Matrix

### Must Fix (WCAG 2.1 AA / CRIT / HIGH)

| ID | Area | Fix |
|----|------|-----|
| D-L-1 | Layout | Skip-to-content link |
| D-L-2 / D-T-1 | Layout / Theme | `prefers-reduced-motion` CSS rule |
| D-T-2 | Theme | `prefers-contrast: more` support |
| D-Q-1 | Record Query | `aria-sort` on DataGrid column headers |
| D-Q-2 | Record Query | Row checkbox `aria-label` |
| D-Q-3 | Record Query | Keyboard-accessible column resize |
| D-V-1 | Record View | Permission-gated Edit/Delete buttons |
| D-F-1 | Forms | Disable submit button while submitting |
| D-P-1 | Process | Auto-focus step heading on step change |
| D-W-1 | Widgets | Screen-reader text for trend arrows |
| D-R-1 | Responsive | 16px minimum font size on inputs |

### Should Fix (MED — noticeable UX gaps)

D-L-3 (mobile search), D-L-4 (banner persistence), D-L-5 (sidebar aria-expanded), D-Q-4 (FilterBuilder spinner), D-Q-5 (pagination range feedback), D-Q-6 (aria-live for fetch), D-V-2 (associated records pagination), D-V-4 (delete confirmation), D-F-2 (number field min/max hint), D-F-3 (DateTime TZ indicator), D-F-4 (mobile tooltip → inline help), D-P-2 (step back navigation), D-P-3 (process timeout message), D-P-4 (validation review filter), D-P-5 (upload progress bar), D-W-2 (widget error boundary), D-W-3 (chart legend mobile), D-W-5 (widget refresh button), D-FB-1 (keyboard shortcuts discoverability), D-FB-2 (toast close button), D-T-3 (dual theming consolidation), D-T-4 (z-index token usage), D-R-2 (touch targets), D-R-3 (320px layout)

### Nice to Have (LOW — polish)

D-L-6 (breadcrumb truncation), D-L-7 (sidebar skeleton), D-Q-8 (frozen columns), D-V-5 (copy record ID), D-V-6 (audit trail), D-F-6 (edit diff), D-F-7 (collapsible form sections), D-P-7 (retry step), D-P-8 (save bulk load mapping), D-W-6 (chart color tokens), D-FB-4 (search result context), D-T-5 (dark mode focus ring), D-T-6 (disabled token), D-R-4 (landscape tablet)

---

## What's Working Well

The following areas are solid and don't require significant rework:

- **Metadata-driven rendering** — no hardcoded table/field names anywhere
- **API layer** — all calls through typed `src/lib/api/` functions, consistent error handling
- **Form accessibility baseline** — `aria-required`, `aria-invalid`, `aria-describedby` correctly wired
- **Unsaved changes guard** — `beforeunload` + confirm modal works correctly
- **TanStack Query** — caching, deduplication, and revalidation correctly configured
- **Dark mode** — complete token coverage, no visual regressions found
- **Skeleton loading** — components have `role="status"` and `aria-busy="true"`
- **DOMPurify** — applied consistently on all user-controlled HTML output
- **URL state** — filters, pagination, and sort are shareable via query params
