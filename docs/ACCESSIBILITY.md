# Accessibility Reference — QQQ Frontend Next

**Standard:** WCAG 2.1 Level AA
**Testing tools:** axe-core (automated), Playwright E2E assertions, manual keyboard testing

---

## WCAG 2.1 AA Compliance Status

The sections below summarise what has been implemented and what remains outstanding,
based on the design review conducted 2026-03-01 (`docs/DESIGN-REVIEW-2026-03-01.md`).

---

## Key Implementations (Resolved Items)

### Skip-to-Content Link (D-L-1)

A visually hidden skip link is rendered as the first element in the dashboard layout
(`src/app/(dashboard)/layout.tsx`). It becomes visible on keyboard focus and links to
`#main-content`, allowing keyboard users to bypass the sidebar on every page navigation.

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 ..."
  data-qqq-id="skip-to-content"
>
  Skip to main content
</a>
```

The target `<main id="main-content" data-qqq-id="main-content">` is present in the same layout.

---

### `aria-sort` on DataGrid Column Headers (D-Q-1)

`src/components/query/DataGrid.tsx` computes an `aria-sort` value for every `<th>` based on
the current TanStack Table sort state:

- Sorted ascending → `aria-sort="ascending"`
- Sorted descending → `aria-sort="descending"`
- Not sorted → `aria-sort="none"` (only on sortable columns; unsortable columns omit the attribute)

Screen readers announce the sort direction when the user focuses or activates a column header.

---

### Row Selection `aria-label` (D-Q-2)

Each row's selection checkbox carries a descriptive label:

```tsx
aria-label={`Select ${row.original.recordLabel ?? 'record'}`}
```

The "select all" header checkbox uses `aria-label="Select all rows on this page"`.

---

### Keyboard-Accessible Column Resize Handles (D-Q-3)

The resize handle on each column header responds to `ArrowLeft` and `ArrowRight` keyboard
events, adjusting the column width by ±10 px per keypress. The handler is implemented in
`handleResizeKeyDown` inside `DataGrid.tsx`:

```typescript
if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
const delta = e.key === 'ArrowRight' ? 10 : -10
```

---

### `aria-live` Region for Fetch-in-Progress (D-Q-6)

The DataGrid wraps the loading progress bar and result count in an `aria-live="polite"` region
so that background re-fetches triggered by sort or filter changes are announced to screen readers
without interrupting the current reading flow.

---

### Focus Management in ProcessRun (D-P-1)

`src/components/process/ProcessRun.tsx` uses a `stepHeadingRef` and a `useEffect` keyed on the
active step name to move focus to the step heading whenever the wizard advances or retreats.
This satisfies WCAG 2.4.3 (Focus Order) by ensuring screen reader users are positioned at the
start of each new step:

```typescript
const stepHeadingRef = useRef<HTMLHeadingElement>(null)

useEffect(() => {
  if (hasRenderedFirstStep.current) {
    stepHeadingRef.current?.focus()
  }
  hasRenderedFirstStep.current = true
}, [activeStepName])
```

The target `<h2>` carries `tabIndex={-1}` and is referenced by `ref={stepHeadingRef}`.

---

### Screen-Reader Text for Trend Indicators (D-W-1)

`src/components/widgets/StatisticsWidget.tsx` renders a visually hidden `<span>` next to each
trend arrow icon so the direction is announced by screen readers:

```tsx
<span className="sr-only">{config.srLabel}</span>
// srLabel values: 'trending up,' | 'trending down,' | 'no change,'
```

The icon itself is `aria-hidden="true"` so it is not double-announced.

---

### Submit Button Disabled While Submitting (D-F-1)

`src/components/forms/EntityForm.tsx` reads `isSubmitting` from React Hook Form's `formState`
and applies it to all action buttons, preventing duplicate submissions:

```tsx
disabled={disabled || isSubmitting}
// Label also changes: isSubmitting ? 'Saving...' : saveButtonLabel
```

---

### Baseline Form Accessibility

All form inputs across `DynamicForm`, `EntityForm`, and individual field components have:

- `<label>` with `htmlFor` wired to the input `id`
- `aria-required={field.isRequired}`
- `aria-invalid={!!errors[field.name]}`
- `aria-describedby` pointing to the error message element
- Required asterisk marked `aria-hidden="true"` to avoid screen-reader repetition
- Help tooltips use Radix Tooltip, which is keyboard-accessible via `Tab` / `Escape`

---

### CSS Media Queries

#### `prefers-reduced-motion` (D-L-2 / D-T-1)

`src/styles/globals.css` collapses all animation and transition durations to near-zero
when the user's OS has reduced motion enabled. This resolves skeleton pulse, sidebar
slide-in, toast fade, and all other CSS transitions:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

#### `prefers-contrast: more` (D-T-2)

A high-contrast media block increases border weights and forces text colors to fully opaque
black, targeting users who have enabled "Increase Contrast" in their OS settings:

```css
@media (prefers-contrast: more) {
  :root {
    --color-border: #000000;
    --color-input: #000000;
    --color-muted-foreground: #000000;
  }

  *,
  ::before,
  ::after {
    border-color: var(--color-border) !important;
  }

  :focus-visible {
    outline: 3px solid #000000 !important;
    outline-offset: 2px !important;
  }
}
```

#### Mobile 16px Font-Size Fix (D-R-1)

iOS Safari auto-zooms any focused input whose `font-size` is below 16px. A mobile-scoped rule
prevents this without affecting desktop appearance:

```css
@media screen and (max-width: 767px) {
  input,
  select,
  textarea {
    font-size: 16px;
  }
}
```

#### Dark-Mode Focus Ring Fix (D-T-5)

The default `color-mix`-based focus ring can disappear on dark backgrounds. A dark-mode
override forces the ring to a solid, fully opaque color:

```css
@media (prefers-color-scheme: dark) {
  :focus-visible {
    outline-color: var(--color-ring);
  }
}
```

---

### Additional Resolved Items (from `What's Working Well`)

| Item | Implementation |
|------|----------------|
| `aria-required`, `aria-invalid`, `aria-describedby` on all form inputs | `DynamicFormField.tsx`, `EntityForm.tsx` |
| `role="status"` + `aria-busy="true"` on skeleton components | All skeleton components |
| `role="status"` + `aria-live="polite"` on `EmptyState` | `EmptyState.tsx` |
| Full keyboard nav in SearchDialog (ArrowUp/Down/Enter/Escape) | `SearchDialog.tsx` |
| Breadcrumbs: `aria-label="Breadcrumb"` + `aria-current="page"` | `Breadcrumbs.tsx` |
| `aria-expanded` on mobile drawer | `Sidebar.tsx` |
| DOMPurify sanitization on all user-controlled HTML output | `FieldValue.tsx`, `BlockWidget.tsx`, `ProcessHtmlStep.tsx` |
| Unsaved-changes guard: `beforeunload` + confirm modal | `EntityForm.tsx` |
| Focus rings on all interactive elements via `:focus-visible` | `globals.css` |
| Muted text darkened to `#5a6270` for WCAG AA contrast margin | `globals.css` |

---

## Automated Testing

### Running axe-core Scans

The helper in `tests/e2e/a11y-helpers.ts` wraps `@axe-core/playwright` and asserts zero
violations against the `wcag2a`, `wcag2aa`, and `wcag21aa` rule sets:

```typescript
import { checkA11y } from './a11y-helpers'

test('page is accessible', async ({ page }) => {
  await page.goto('/app/person')
  await waitForAppReady(page)
  await checkA11y(page)
})
```

`checkA11y` runs on every navigation E2E test in `navigation.spec.ts`. To run all E2E tests
including accessibility assertions:

```bash
pnpm test:e2e
```

To run a single spec with axe output in the terminal:

```bash
pnpm test:e2e -- tests/e2e/navigation.spec.ts
```

### Known Suppressed Violations (with TODOs)

Three rule violations are currently disabled in `checkA11y` because the underlying issues
are not yet fixed. Each has a TODO comment in `a11y-helpers.ts`:

| Rule | Reason suppressed | TODO |
|------|-------------------|------|
| `color-contrast` | Amber banner background (#f59e0b) and indigo sidebar/button states yield contrast ratios just below 4.5:1 | Audit all Tailwind color pairs in Banner, Sidebar, and Button and replace with WCAG AA-compliant pairs |
| `aria-input-field-name` | Some form inputs rendered by `DynamicForm` may have broken `<label htmlFor>` associations when IDs are generated dynamically | Ensure every `<input>` has either a matching `htmlFor` or an `aria-label` |
| `scrollable-region-focusable` | The TanStack Table scrollable wrapper `<div>` has no `tabIndex`, blocking keyboard scrolling | Add `tabIndex={0}` to the scrollable DataGrid wrapper |

---

## Outstanding Work

The following items from the design review are **not yet resolved** and require future work.

### High Priority (WCAG 2.1 AA gaps)

| ID | Area | Description |
|----|------|-------------|
| D-V-1 | Record View | Edit/Delete buttons render regardless of user permissions; they fail with 403 on action instead of being hidden/disabled based on `editPermission`/`deletePermission`. |
| D-L-3 | Layout | Global search is hidden on mobile (`hidden md:block`); mobile users have no access to search. |

### Medium Priority (UX gaps)

| ID | Area | Description |
|----|------|-------------|
| D-L-5 | Layout | Mobile sidebar `aria-expanded` state may not be consistently set on the nav landmark. |
| D-Q-4 | FilterBuilder | Async combobox shows no loading indicator while possible-value options are fetching. |
| D-Q-5 | Pagination | "Go to page" input silently ignores out-of-range values with no user feedback. |
| D-Q-7 | DataGrid | Column visibility toggle changes are not announced via a `role="status"` region. |
| D-P-2 | Process | Completed step indicators in the wizard are not keyboard-navigable for back-navigation. |
| D-P-3 | Process | No timeout message if backend polling runs beyond ~60 seconds. |
| D-P-4 | Process | Validation review result list has no severity filter or field-name search. |
| D-P-5 | Process | File upload step shows no byte-level progress during multipart upload. |
| D-W-2 | Widgets | Widget API call failures show blank space with no error boundary or fallback UI. |
| D-FB-1 | Feedback | Keyboard Shortcuts dialog is not discoverable (no visible `?` hint in the header). |
| D-FB-2 | Feedback | Toasts have no dismiss button; users must wait for auto-timeout. |
| D-FB-3 | Feedback | CommandMenu icon buttons may be below the 44px minimum touch target size. |
| D-R-2 | Responsive | Multiple interactive elements (pagination controls, density buttons) below 44px touch target. |

### Items Deferred Pending Backend Support

| ID | Area | Description |
|----|------|-------------|
| D-V-6 | Record View | "Last modified by / at" audit footer requires backend to expose this data on the record endpoint. |
| D-T-3 | Theme | Dual theming systems (`--qqq-primary-color` and `--color-primary`) need consolidation; depends on coordinating with backend-supplied theme values. |

---

## Checklist for New Component Authors

When adding a new interactive component, verify the following before opening a pull request:

- [ ] Every `<input>`, `<select>`, and `<textarea>` has a `<label htmlFor>` that matches its `id`, or an `aria-label` / `aria-labelledby` attribute.
- [ ] Required inputs have `aria-required={true}`.
- [ ] Invalid inputs have `aria-invalid={true}` and an `aria-describedby` pointing to the error message element.
- [ ] All icon-only buttons have a descriptive `aria-label` (e.g. `aria-label="Close dialog"`).
- [ ] Icon elements that are purely decorative are marked `aria-hidden="true"`.
- [ ] Modals/dialogs trap focus while open and restore it to the triggering element on close (use Radix Dialog for this automatically).
- [ ] All interactive elements are reachable and operable via `Tab` / `Shift+Tab` / `Enter` / `Space` / `Escape`.
- [ ] Interactive elements have a visible `:focus-visible` ring (do not add `outline: none` without a replacement).
- [ ] Any element that announces dynamic state changes uses `aria-live="polite"` (or `role="status"`).
- [ ] Touch targets are at least 44x44px (`min-h-[44px] min-w-[44px]` or equivalent padding).
- [ ] Color is not the only means of conveying information (pair color with text or icon).
- [ ] Text color meets a minimum 4.5:1 contrast ratio against its background for normal-weight text at normal size.
- [ ] The component does not break at 320px viewport width.
- [ ] The component respects `prefers-reduced-motion` (animations driven by CSS transitions inherit the global rule in `globals.css`; JS-driven animations need a manual check).
- [ ] Any rendered HTML that originates from user input or the backend is sanitized with DOMPurify before being set via `dangerouslySetInnerHTML`.
- [ ] Run `pnpm test:e2e` and confirm `checkA11y` passes for any page that includes the new component.
