# Work Package 6: Polish, Parity, and Production Readiness

**QQQ Admin UI Modernization — Next.js 15 + React 19 + Tailwind CSS 4**

**Package Status:** FINAL (closes all other packages)
**Estimated Duration:** 6 weeks
**Team Size:** 3–4 engineers
**Blockers:** Packages 1–5 must be complete

---

## 1. Prerequisites

### 1.1 Exact Imports from Package 1

```typescript
// From @/lib/types
import type { QAppMetaData, QTableSection, QTableMetaData } from '@/lib/types'
import type { QRecord, QFieldMetaData, QFieldValue } from '@/lib/types'
import type { QBrandingMetaData, QThemeMetaData } from '@/lib/types'

// From @/lib/api
import { apiClient } from '@/lib/api/client'

// From @/lib/context
import { useQContext } from '@/lib/context/q-context'
import type { QContextValue } from '@/lib/context/q-context'

// From @/lib/auth
import { useAuth } from '@/lib/auth/use-auth'

// From @/components/layout
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { LayoutHeader } from '@/components/layout/layout-header'
import { SideNav } from '@/components/layout/side-nav'

// From @/hooks/use-theme
import { useTheme } from '@/hooks/use-theme'

// From @/hooks/use-keyboard
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
```

### 1.2 Exact Imports from Package 2 (DataGrid)

```typescript
// From @/components/data-grid
import { DataGrid } from '@/components/data-grid/data-grid'
import type { DataGridProps, Column } from '@/components/data-grid/types'
import { usePagination } from '@/components/data-grid/hooks/use-pagination'
```

### 1.3 Exact Imports from Package 3 (Forms)

```typescript
// From @/components/form
import { EntityForm } from '@/components/form/entity-form'
import type { EntityFormProps } from '@/components/form/entity-form'
```

### 1.4 Exact Imports from Package 4 (Processes)

```typescript
// From @/components/process
import { ProcessRun } from '@/components/process/process-run'
import type { ProcessRunProps } from '@/components/process/process-run'
```

### 1.5 Exact Imports from Package 5 (Widgets)

```typescript
// From @/components/widgets
import { WidgetContainer } from '@/components/widgets/widget-container'
import { WidgetGrid } from '@/components/widgets/widget-grid'
import { DashboardWidgets } from '@/components/widgets/dashboard-widgets'
```

### 1.6 External Dependencies

All dependencies from Packages 1–5 PLUS:

```bash
# Accessibility & testing
pnpm add axe-core @axe-core/react axe-playwright

# Command palette & search
pnpm add cmdk

# Code editor
pnpm add @monaco-editor/react

# Performance analysis
pnpm add next-bundle-analyzer

# Lighthouse CI
pnpm add -D @lhci/cli @lhci/server

# Storybook
pnpm add -D storybook @storybook/nextjs @storybook/addon-a11y @storybook/addon-interactions @storybook/addon-viewport
```

---

## 2. Requirements Traceability

### 2.1 Source Requirements

| Requirement | Source | Implementation Step |
|-------------|--------|-------------------|
| Responsive design audit & mobile card view | 5.4 (Responsive Design) | Step 1 |
| Responsive form layouts (single/multi-col) | 5.4 (Responsive Design) | Step 2 |
| Off-canvas sidebar on mobile | 5.4 (Responsive Design) | Step 3 |
| Bottom sheet filter panel on mobile | 5.4 (Responsive Design) | Step 3 |
| 44px touch-friendly tap targets | 5.4 (Responsive Design) | Step 4 |
| Responsive widget grid (1/2/N col) | 5.4 (Responsive Design) | Step 5 |
| Breadcrumb truncation on mobile | 5.4 (Responsive Design) | Step 6 |
| Sticky headers & bottom action buttons | 5.4 (Responsive Design) | Step 6 |
| WCAG 2.1 AA accessibility compliance | 5.1 (Core Principles) | Step 7 |
| axe-core CI audit integration | 5.6 (Testing) | Step 7 |
| Focus management in modals | 5.1 (Core Principles) | Step 8 |
| aria-live regions for dynamic content | 5.1 (Core Principles) | Step 9 |
| Color contrast audit (4.5:1 / 3:1) | 5.1 (Core Principles) | Step 10 |
| Keyboard navigation for all elements | 5.1 (Core Principles) | Step 11 |
| Skip-to-content link | 5.1 (Core Principles) | Step 12 |
| High contrast mode support | 5.1 (Core Principles) | Step 13 |
| Command Palette (Cmd+K / Ctrl+K) | 5.5.4 (Command Palette) | Step 14 |
| Keyboard shortcuts system | 5.5.5 (Keyboard Shortcuts) | Step 15 |
| Audit trail display on Record View | 5.5.2 (Audit Trail) | Step 16 |
| Developer tools pages (table & record) | 5.7.1 (Developer Experience) | Step 17 |
| Script editor & test execution | 5.7.1 (Developer Experience) | Step 18 |
| Report execution pages | 5.2.3 (Report Pages) | Step 19 |
| Storybook setup with all components | 5.6 (Testing) | Step 20 |
| Playwright E2E test suite | 5.6 (Testing) | Step 21 |
| Bundle analysis & lazy loading | 5.6 (Performance) | Step 22 |
| Image optimization & TanStack Query tuning | 5.6 (Performance) | Step 23 |
| Virtual scrolling for large lists | 5.6 (Performance) | Step 24 |
| Lighthouse CI integration | 5.6 (Performance) | Step 25 |
| Complete CSS custom property system | 5.3.1 (Theme System) | Step 26 |
| data-qqq-id verification on elements | 5.1 (Core Principles) | Step 27 |
| Custom CSS injection support | 5.3.1 (Theme System) | Step 28 |
| Session timeout UX with re-auth modal | 5.5.3 (Session Timeout) | Step 29 |
| Preserve form state & scroll across re-auth | 5.5.3 (Session Timeout) | Step 29 |

### 2.2 Non-Functional Requirements

- TypeScript strict mode compliance across all new code
- Mobile-first responsive design (320px to 4K+)
- WCAG 2.1 AA accessibility for all interactive elements
- Performance: LCP <2.5s, FID <100ms, CLS <0.1
- Metadata-driven configuration (100% from QQQ backend)
- Zero breaking changes to existing API client (Packages 1–5)

---

## 3. Shared Context Files Required

### 3.1 Files Delivered by Packages 1–5

```
src/lib/types/index.ts
src/lib/types/auth.ts
src/lib/types/widget.ts
src/lib/context/q-context.tsx
src/lib/api/client.ts
src/lib/api/widget-client.ts
src/components/layout/dashboard-layout.tsx
src/components/layout/layout-header.tsx
src/components/layout/side-nav.tsx
src/components/data-grid/data-grid.tsx
src/components/data-grid/types.ts
src/components/form/entity-form.tsx
src/components/process/process-run.tsx
src/components/widgets/widget-container.tsx
src/components/widgets/widget-grid.tsx
src/components/widgets/dashboard-widgets.tsx
src/hooks/use-theme.ts
```

### 3.2 Shared Context Files (from docs/implementation-plans/shared-context/)

```
api-contract.md         ← All API endpoints
type-definitions.md     ← All TypeScript interfaces
coding-conventions.md   ← File naming, import order, a11y patterns
```

---

## 4. Scope: In and Out

### 4.1 In Scope

**Responsive Design:**
- Mobile card view for Record Query (alternative to DataGrid on <768px)
- Responsive form layouts (single-column mobile, grid tablet+)
- Off-canvas sidebar drawer with hamburger trigger on mobile
- Bottom sheet filter panel on mobile
- Touch-friendly 44px min tap targets
- Responsive widget grid (1 col mobile, 2 col tablet, N col desktop)
- Breadcrumb truncation and responsiveness
- Sticky headers and bottom-anchored action buttons

**Accessibility (WCAG 2.1 AA):**
- axe-core audit in CI/CD pipeline
- Focus trap in modals with restoration on close
- aria-live regions for toasts, loading states, dynamic content
- Color contrast verification (4.5:1 normal, 3:1 large text)
- Full keyboard navigation for all interactive elements
- Skip-to-content link on every page
- High contrast mode media query support (@media (prefers-contrast: more))
- Screen reader testing with NVDA/JAWS patterns

**Command Palette:**
- Cmd+K / Ctrl+K global trigger
- Search: tables (by label), processes, reports, recent records, recent views
- Keyboard navigation (arrow keys, Enter, Escape)
- Recently accessed items section
- Keyboard shortcuts reference modal

**Keyboard Shortcuts:**
- Global: Cmd+K (palette), ? (help), Esc (close)
- Record Query: n (new), / (search), f (filters)
- Record View: n (new), e (edit), c (copy), d (delete), a (audit)
- Process: Enter (next), Esc (cancel)
- Customizable shortcut map in settings

**Audit Trail:**
- Audit log tab/panel on Record View
- Timeline display of all changes
- Field-level tracking (old → new value)
- User attribution and ISO 8601 timestamps
- Date range, user, field filtering

**Developer Tools:**
- `/app/{table}/dev` — Table metadata inspector
- `/app/{table}/:id/dev` — Record developer view
- Script editor with Monaco syntax highlighting
- Script test execution with input/output display
- Script log viewer with filtering

**Report Execution:**
- `/app/{reportName}` — Report run page
- Report-specific chrome (header, parameter form, output display)
- Reuse ProcessRun from Package 4

**Storybook:**
- Complete setup for all shared components from Packages 1–5
- Stories: loading, empty, error, populated, disabled states
- Interactive controls for prop exploration
- Accessibility audit addon (@storybook/addon-a11y)
- Visual regression baseline screenshots

**Playwright E2E Tests:**
- Auth flow: login → dashboard → logout
- Record Query: load, filter, sort, paginate, select, export
- Record CRUD: create → view → edit → delete
- Process execution: init → fill steps → async → results
- Widget rendering: load, dropdown change, re-fetch
- Responsive: mobile/tablet/desktop viewports
- Error handling: 401, 500, 404

**Performance Optimization:**
- Bundle analysis (next-bundle-analyzer)
- Lazy loading: charts, code editor, file upload, rich text
- Route-based code splitting (automatic Next.js)
- Image optimization (next/image)
- TanStack Query cache tuning (stale times, gc times)
- Virtual scrolling for DataGrid >100 rows, dropdowns >50 items
- Lighthouse CI with score thresholds (Performance >90)

**Theme Token System:**
- 60+ CSS custom properties from current qfmd
- Dynamic injection from QThemeMetaData
- Light/dark mode with system detection + manual toggle + localStorage
- data-qqq-id on all interactive elements
- Custom CSS injection from backend

**Session Timeout UX:**
- Non-disruptive re-auth modal (overlay, not full redirect)
- Preserve unsaved form data across re-auth
- Preserve scroll position and filter state
- Configurable timeout warning (5 min before expiry)

### 4.2 Out of Scope

- New features not in current qfmd (parity package only)
- Multi-language localization beyond English
- Web accessibility features beyond WCAG 2.1 AA
- Custom app-specific component implementations
- Client-side analytics or telemetry beyond Lighthouse CI

---

## 5. Detailed Implementation Steps

### Step 1: Mobile Card View for Record Query

**Files Created:**
- `src/components/data-grid/mobile-card-view.tsx`
- `src/components/data-grid/mobile-card.tsx`
- `src/hooks/use-responsive-grid.ts`

**Implementation:**

Create `MobileCardView` component that renders records as a stack of cards on <768px:

```typescript
interface MobileCardViewProps {
  records: QRecord[]
  columns: Column[]
  onRowSelect?: (record: QRecord) => void
  onEdit?: (record: QRecord) => void
  onDelete?: (record: QRecord) => void
  loading?: boolean
}

export function MobileCardView({
  records,
  columns,
  onRowSelect,
  onEdit,
  onDelete,
  loading,
}: MobileCardViewProps) {
  return (
    <div className="flex flex-col gap-2 sm:hidden">
      {records.map((record) => (
        <MobileCard
          key={record.id}
          record={record}
          columns={columns}
          onSelect={onRowSelect}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
```

Each card shows primary field + 2–3 most important fields, with action buttons (view, edit, delete).

Update `RecordQuery` page to conditionally render `MobileCardView` on mobile, `DataGrid` on desktop.

**Acceptance Criteria:**
- Record Query displays cards on mobile (<768px)
- DataGrid displays on tablet+ (≥768px)
- Card shows primary key, 2–3 important fields
- Actions (view, edit, delete) work on cards
- Responsive breakpoint uses Tailwind's `sm:` prefix

---

### Step 2: Responsive Form Layouts

**Files Created:**
- `src/components/form/responsive-form-layout.tsx`
- `src/hooks/use-form-grid.ts`

**Implementation:**

Modify `EntityForm` to support gridColumns metadata:

```typescript
interface ResponsiveFormLayoutProps {
  sections: QTableSection[]
  gridColumns?: {
    mobile?: number  // 1-2
    tablet?: number  // 2-3
    desktop?: number // 3-4
  }
  children: React.ReactNode
}

export function ResponsiveFormLayout({
  sections,
  gridColumns = { mobile: 1, tablet: 2, desktop: 3 },
  children,
}: ResponsiveFormLayoutProps) {
  const colClass = `grid-cols-${gridColumns.mobile} sm:grid-cols-${gridColumns.tablet} lg:grid-cols-${gridColumns.desktop}`
  return <div className={`grid gap-4 ${colClass}`}>{children}</div>
}
```

On mobile: 1 column (full-width fields)
On tablet: 2–3 columns
On desktop: 3–4 columns per metadata

**Acceptance Criteria:**
- Form displays single column on mobile
- Form displays multi-column on tablet+
- Column count respects gridColumns metadata
- Fields stack properly on small screens

---

### Step 3: Off-Canvas Sidebar & Bottom Sheet Filters

**Files Created:**
- `src/components/layout/mobile-sidebar-drawer.tsx`
- `src/components/data-grid/mobile-filter-sheet.tsx`
- `src/hooks/use-mobile-drawer.ts`

**Implementation:**

Create mobile hamburger trigger that opens off-canvas sidebar:

```typescript
interface MobileSidebarDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function MobileSidebarDrawer({
  isOpen,
  onClose,
  children,
}: MobileSidebarDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-64 p-0">
        {children}
      </SheetContent>
    </Sheet>
  )
}
```

Create bottom sheet for filters on mobile:

```typescript
interface MobileFilterSheetProps {
  isOpen: boolean
  onClose: () => void
  filters: FilterExpression[]
  onApply: (filters: FilterExpression[]) => void
}

export function MobileFilterSheet({
  isOpen,
  onClose,
  filters,
  onApply,
}: MobileFilterSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[80vh]">
        <FilterBuilder
          filters={filters}
          onChange={onApply}
          onClose={onClose}
        />
      </SheetContent>
    </Sheet>
  )
}
```

Update `LayoutHeader` to show hamburger icon on mobile (<768px).

**Acceptance Criteria:**
- Hamburger icon visible on mobile, hidden on desktop
- Sidebar drawer opens/closes smoothly
- Filter sheet opens from bottom on mobile
- Drawer/sheet close on backdrop click or close button

---

### Step 4: Touch-Friendly 44px Min Tap Targets

**Files Created:**
- `src/lib/styles/accessibility.css`
- `src/lib/constants/a11y.ts`

**Implementation:**

Define spacing constant:

```typescript
// src/lib/constants/a11y.ts
export const A11Y_CONSTANTS = {
  MIN_TAP_TARGET_SIZE: '44px', // WCAG AA minimum
  MIN_FOCUS_OUTLINE_WIDTH: '2px',
  MIN_FOCUS_OUTLINE_OFFSET: '2px',
}
```

Apply to all buttons, links, and interactive elements:

```typescript
// In components: button, link, input
className={cn(
  'h-11 w-11 min-h-[44px] min-w-[44px]', // 44px minimum
  // ... other classes
)}
```

Add global focus styles:

```css
/* src/lib/styles/accessibility.css */
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

button, a, input, select, textarea {
  min-height: 44px;
  min-width: 44px;
  @apply focus:outline-2 focus:outline-offset-2;
}
```

**Acceptance Criteria:**
- All buttons min 44px × 44px (or equivalent touch area)
- Focus outline visible on all interactive elements
- Focus outline at least 2px wide, 2px offset
- Icon buttons respect min-width/min-height

---

### Step 5: Responsive Widget Grid (1/2/N Column)

**Files Created:**
- Already in Package 5 as `widget-grid.tsx`
- Enhance with mobile support in `src/components/widgets/widget-grid.tsx`

**Implementation:**

Update `WidgetGrid` to use Tailwind responsive classes:

```typescript
interface WidgetGridProps {
  widgets: QWidgetMetaData[]
  gridColumns?: {
    mobile?: number  // 1
    tablet?: number  // 2
    desktop?: number // gridColumns from metadata
  }
}

export function WidgetGrid({
  widgets,
  gridColumns = { mobile: 1, tablet: 2, desktop: 3 },
}: WidgetGridProps) {
  const colClass = `grid-cols-${gridColumns.mobile} sm:grid-cols-${gridColumns.tablet} lg:grid-cols-${gridColumns.desktop}`
  return (
    <div className={`grid gap-4 ${colClass}`}>
      {widgets.map((w) => (
        <WidgetContainer key={w.name} metadata={w} />
      ))}
    </div>
  )
}
```

Mobile: 1 column
Tablet (≥640px): 2 columns
Desktop (≥1024px): gridColumns metadata value

**Acceptance Criteria:**
- Widget grid displays 1 column on mobile
- Widget grid displays 2 columns on tablet
- Widget grid displays N columns on desktop (per metadata)
- No widgets overflow on any viewport

---

### Step 6: Breadcrumb Truncation & Sticky Headers

**Files Created:**
- `src/components/layout/responsive-breadcrumb.tsx`
- `src/components/layout/sticky-header.tsx`

**Implementation:**

Breadcrumb truncation for mobile:

```typescript
export function ResponsiveBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const isMobile = useBreakpoint('sm')

  // On mobile, show only first + last 2 items
  const displayItems = isMobile && items.length > 3
    ? [items[0], { label: '...', disabled: true }, ...items.slice(-2)]
    : items

  return <Breadcrumb items={displayItems} />
}
```

Sticky headers on mobile with safe area inset:

```typescript
export function StickyHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-40 bg-white dark:bg-slate-950 border-b">
      {/* Top safe area for notch/status bar */}
      <div className="h-[env(safe-area-inset-top)]" />
      {children}
    </div>
  )
}
```

Bottom-anchored action buttons (like delete button in Record View):

```typescript
export function BottomActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t p-4 sm:static sm:border-t-0 sm:p-0">
      <div className="pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- Breadcrumb truncates to first + last 2 items on mobile
- Headers sticky at top on mobile with safe area handling
- Action buttons anchored at bottom on mobile, static on desktop
- No content hidden behind sticky elements

---

### Step 7: WCAG 2.1 AA Accessibility Audit & axe-core CI

**Files Created:**
- `.github/workflows/a11y-audit.yml` (or similar CI config)
- `src/lib/utils/a11y-checker.ts`
- `playwright/a11y-tests.spec.ts`

**Implementation:**

Create CI workflow to run axe-core checks:

```yaml
# .github/workflows/a11y-audit.yml
name: Accessibility Audit
on: [pull_request]
jobs:
  axe-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm run test:a11y
```

Create Playwright a11y test:

```typescript
// playwright/a11y-tests.spec.ts
import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

test('homepage has no accessibility violations', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await injectAxe(page)
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  })
})

test('record query page has no violations', async ({ page }) => {
  await page.goto('http://localhost:3000/app/MyApp/Table1')
  await injectAxe(page)
  await checkA11y(page)
})
```

Run in CI on PR: fail if violations found (excluding exceptions).

**Acceptance Criteria:**
- axe-core audit runs in CI on every PR
- All WCAG violations reported in CI output
- False positives documented in exclusion list
- Build fails if critical violations present

---

### Step 8: Focus Management in Modals

**Files Created:**
- `src/hooks/use-focus-trap.ts`
- `src/components/ui/modal-with-focus.tsx`

**Implementation:**

Create focus trap hook:

```typescript
export function useFocusTrap(ref: React.RefObject<HTMLDivElement>) {
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!ref.current) return

    // Store currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement

    // Find all focusable elements
    const focusableElements = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    // Focus first element
    firstElement?.focus()

    // Trap focus with keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift+Tab: move backward
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab: move forward
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    ref.current.addEventListener('keydown', handleKeyDown)

    return () => {
      ref.current?.removeEventListener('keydown', handleKeyDown)
      // Restore focus to previously focused element
      previousActiveElement.current?.focus()
    }
  }, [ref])
}
```

Apply to all modals/dialogs:

```typescript
export function ModalWithFocus({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  useFocusTrap(ref)

  return (
    <Dialog>
      <DialogContent ref={ref} role="dialog" aria-modal="true">
        {children}
      </DialogContent>
    </Dialog>
  )
}
```

**Acceptance Criteria:**
- Tab/Shift+Tab cycles through modal elements only
- Focus restores to trigger element on modal close
- aria-modal="true" set on modal container
- Screen reader announces modal when opened

---

### Step 9: aria-live Regions for Dynamic Content

**Files Created:**
- `src/components/ui/aria-live-region.tsx`
- `src/hooks/use-toast-announcer.ts`

**Implementation:**

Create aria-live region for toasts:

```typescript
interface AriaLiveRegionProps {
  message?: string
  priority?: 'polite' | 'assertive'
  role?: 'status' | 'alert'
}

export function AriaLiveRegion({
  message,
  priority = 'polite',
  role = 'status',
}: AriaLiveRegionProps) {
  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      role={role}
      className="sr-only"
    >
      {message}
    </div>
  )
}
```

Add aria-live to toast container:

```typescript
export function ToastContainer() {
  const { toasts } = useToast()
  const [announced, setAnnounced] = React.useState<string>('')

  React.useEffect(() => {
    if (toasts.length > 0) {
      // Announce latest toast after a brief delay
      setTimeout(() => {
        setAnnounced(toasts[toasts.length - 1].message)
      }, 100)
    }
  }, [toasts])

  return (
    <>
      <AriaLiveRegion message={announced} priority="polite" />
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} />
        ))}
      </div>
    </>
  )
}
```

Add aria-busy to loading states:

```typescript
export function DataGridLoading() {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="flex items-center justify-center p-4"
    >
      <Spinner /> Loading records...
    </div>
  )
}
```

**Acceptance Criteria:**
- Toasts announced to screen readers via aria-live
- Loading states marked with aria-busy="true"
- Dynamic content changes announced after small delay
- sr-only class hides announcements from sighted users

---

### Step 10: Color Contrast Audit (4.5:1 / 3:1)

**Files Created:**
- `src/lib/styles/contrast-checker.ts`
- `playwright/contrast-tests.spec.ts`

**Implementation:**

Create contrast checker utility:

```typescript
// src/lib/styles/contrast-checker.ts
export function getContrastRatio(rgb1: string, rgb2: string): number {
  const lum1 = getRelativeLuminance(rgb1)
  const lum2 = getRelativeLuminance(rgb2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function getRelativeLuminance(rgb: string): number {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number)
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function meetsWCAGAA(ratio: number, isLargeText: boolean): boolean {
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}
```

Create Playwright test:

```typescript
// playwright/contrast-tests.spec.ts
test('text colors meet WCAG AA contrast', async ({ page }) => {
  await page.goto('http://localhost:3000')

  const violations = await page.evaluate(() => {
    const results: Array<{ element: string; ratio: number; required: number }> = []

    document.querySelectorAll('p, span, button, a, label').forEach((el) => {
      const { color, fontSize } = window.getComputedStyle(el)
      const { backgroundColor } = window.getComputedStyle(el.parentElement!)
      const ratio = getContrastRatio(color, backgroundColor)
      const isLarge = parseInt(fontSize) >= 18
      const required = isLarge ? 3 : 4.5

      if (ratio < required) {
        results.push({
          element: el.tagName,
          ratio: Math.round(ratio * 100) / 100,
          required,
        })
      }
    })

    return results
  })

  expect(violations).toHaveLength(0)
})
```

Audit all components in Storybook with contrast checker addon.

**Acceptance Criteria:**
- Normal text (14px) has 4.5:1 contrast ratio minimum
- Large text (18px+) has 3:1 contrast ratio minimum
- All interactive elements meet contrast requirements
- CI warns on contrast violations

---

### Step 11: Full Keyboard Navigation

**Files Created:**
- `src/lib/constants/keyboard-codes.ts`
- `src/components/data-grid/keyboard-navigation.ts`
- `src/hooks/use-keyboard-navigation.ts`

**Implementation:**

Define keyboard codes:

```typescript
// src/lib/constants/keyboard-codes.ts
export const KEYBOARD = {
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  SPACE: ' ',
  TAB: 'Tab',
}
```

Implement keyboard navigation hook:

```typescript
export function useKeyboardNavigation({
  items,
  onSelect,
}: {
  items: any[]
  onSelect: (item: any) => void
}) {
  const [activeIndex, setActiveIndex] = React.useState(0)

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i > 0 ? i - 1 : items.length - 1))
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i < items.length - 1 ? i + 1 : 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onSelect(items[activeIndex])
        break
      case 'Escape':
        setActiveIndex(-1)
        break
    }
  }

  return { activeIndex, handleKeyDown }
}
```

Apply to DataGrid, dropdowns, command palette.

**Acceptance Criteria:**
- Arrow keys navigate grid rows
- Enter/Space activates buttons/links
- Tab moves between focusable elements
- Shift+Tab moves backward
- Escape closes modals/dropdowns

---

### Step 12: Skip-to-Content Link

**Files Created:**
- `src/components/layout/skip-to-content-link.tsx`

**Implementation:**

Add skip link to root layout:

```typescript
export function SkipToContentLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
    >
      Skip to main content
    </a>
  )
}
```

Add to root layout:

```typescript
export default function RootLayout() {
  return (
    <html>
      <body>
        <SkipToContentLink />
        <DashboardLayout>
          <main id="main-content">{/* page content */}</main>
        </DashboardLayout>
      </body>
    </html>
  )
}
```

**Acceptance Criteria:**
- Skip link hidden visually but available to screen readers
- Skip link visible on focus (keyboard navigation)
- Skip link jumps to #main-content on click
- Works with all screen readers

---

### Step 13: High Contrast Mode Support

**Files Created:**
- `src/lib/styles/high-contrast.css`
- `src/hooks/use-high-contrast.ts`

**Implementation:**

Add high contrast CSS:

```css
/* src/lib/styles/high-contrast.css */
@media (prefers-contrast: more) {
  :root {
    --color-text: #000;
    --color-bg: #fff;
    --color-border: #000;
    --color-focus: #000;
  }

  button {
    border: 2px solid currentColor;
    font-weight: 600;
  }

  input, select, textarea {
    border: 2px solid var(--color-border);
  }

  a {
    text-decoration: underline;
  }
}
```

Create hook:

```typescript
export function useHighContrast() {
  const [isHighContrast, setIsHighContrast] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-contrast: more)')
    setIsHighContrast(media.matches)

    const handler = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches)
    }

    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  return isHighContrast
}
```

**Acceptance Criteria:**
- High contrast mode detected via media query
- All text bold and bordered in high contrast mode
- Links underlined in high contrast mode
- Borders at least 2px wide in high contrast mode

---

### Step 14: Command Palette Implementation

**Files Created:**
- `src/components/command/command-palette.tsx`
- `src/hooks/use-command-palette.ts`
- `src/lib/api/command-search.ts`

**Implementation:**

Create command palette using `cmdk`:

```typescript
interface CommandPaletteItem {
  id: string
  label: string
  category: 'table' | 'process' | 'report' | 'recent'
  action: () => void
  icon?: React.ReactNode
  meta?: Record<string, any>
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  items?: CommandPaletteItem[]
}

export function CommandPalette({
  isOpen,
  onClose,
  items = [],
}: CommandPaletteProps) {
  const [search, setSearch] = React.useState('')
  const [metadata, setMetadata] = React.useQuery(
    ['metadata'],
    () => apiClient.getMetadata()
  )

  const allItems = React.useMemo(() => {
    const result: CommandPaletteItem[] = [
      // Build from metadata
      ...(metadata?.tables ?? []).map((t) => ({
        id: `table-${t.name}`,
        label: t.label || t.name,
        category: 'table' as const,
        action: () => {
          router.push(`/app/${t.name}`)
          onClose()
        },
      })),
      ...(metadata?.processes ?? []).map((p) => ({
        id: `process-${p.name}`,
        label: p.label || p.name,
        category: 'process' as const,
        action: () => {
          router.push(`/app/${p.name}/execute`)
          onClose()
        },
      })),
      // Add recent items from localStorage
      ...items,
    ]
    return result
  }, [metadata, items])

  const filtered = React.useMemo(() => {
    if (!search) return allItems
    return allItems.filter((item) =>
      item.label.toLowerCase().includes(search.toLowerCase())
    )
  }, [search, allItems])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command>
          <CommandInput
            placeholder="Search tables, processes, reports..."
            value={search}
            onValueChange={setSearch}
            className="border-b px-4 py-3"
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No results found.</CommandEmpty>
            {['table', 'process', 'report', 'recent'].map((category) => {
              const items = filtered.filter((i) => i.category === category)
              if (items.length === 0) return null
              return (
                <CommandGroup key={category} heading={category}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      onSelect={item.action}
                      className="cursor-pointer px-2 py-1.5"
                    >
                      {item.icon && <span className="mr-2">{item.icon}</span>}
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
```

Create hook to manage palette:

```typescript
export function useCommandPalette() {
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (isMeta && e.key === 'k') {
        e.preventDefault()
        setIsOpen((v) => !v)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { isOpen, setIsOpen }
}
```

Add to root layout with global shortcut handler.

**Acceptance Criteria:**
- Cmd+K / Ctrl+K opens palette
- Palette searches tables, processes, reports
- Recent items shown at bottom of list
- Arrow keys navigate, Enter selects
- Escape closes palette
- Search filters results in real-time

---

### Step 15: Keyboard Shortcuts System

**Files Created:**
- `src/lib/types/shortcuts.ts`
- `src/lib/constants/keyboard-shortcuts.ts`
- `src/components/keyboard/shortcuts-modal.tsx`
- `src/hooks/use-keyboard-shortcuts.ts`

**Implementation:**

Define shortcuts:

```typescript
// src/lib/types/shortcuts.ts
export interface KeyboardShortcut {
  key: string // e.g., 'Cmd+K', 'Ctrl+/'
  description: string
  category: 'global' | 'table' | 'record' | 'process'
  action: () => void
}

// src/lib/constants/keyboard-shortcuts.ts
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'Cmd+K / Ctrl+K',
    description: 'Open command palette',
    category: 'global',
    action: () => commandPalette.open(),
  },
  {
    key: '?',
    description: 'Show keyboard shortcuts',
    category: 'global',
    action: () => shortcutsModal.open(),
  },
  {
    key: 'Esc',
    description: 'Close modal or panel',
    category: 'global',
    action: () => {},
  },
  {
    key: 'n',
    description: 'Create new record',
    category: 'table',
    action: () => router.push(`/app/${table}/create`),
  },
  {
    key: '/',
    description: 'Focus search box',
    category: 'table',
    action: () => searchInput.focus(),
  },
  {
    key: 'f',
    description: 'Toggle filters',
    category: 'table',
    action: () => filterPanel.toggle(),
  },
  {
    key: 'e',
    description: 'Edit current record',
    category: 'record',
    action: () => router.push(`/app/${table}/${id}/edit`),
  },
]
```

Implement hook to bind shortcuts:

```typescript
export function useKeyboardShortcuts() {
  const router = useRouter()
  const { toasts } = useToast()

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey

      // Global shortcuts
      if (e.key === '?') {
        e.preventDefault()
        // Show shortcuts modal
      }

      // Table shortcuts (when in table context)
      if (e.key === 'n' && !isInputFocused()) {
        e.preventDefault()
        // Create new record
      }

      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault()
        // Focus search
      }

      // Record shortcuts (when in record context)
      if (e.key === 'e' && !isInputFocused()) {
        e.preventDefault()
        // Edit record
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router, toasts])
}
```

Create shortcuts help modal:

```typescript
export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {KEYBOARD_SHORTCUTS.map((s) => (
            <div key={s.key} className="flex justify-between">
              <span className="text-sm text-gray-600">{s.description}</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Acceptance Criteria:**
- Global shortcuts work on all pages
- ? opens shortcuts modal with full list
- Shortcuts work only when input not focused
- Shortcuts listed by category in modal
- Customizable via settings (future)

---

### Step 16: Audit Trail Display on Record View

**Files Created:**
- `src/components/record/audit-trail-panel.tsx`
- `src/lib/api/audit-client.ts`
- `src/lib/types/audit.ts`

**Implementation:**

Define audit types:

```typescript
// src/lib/types/audit.ts
export interface AuditEntry {
  id: string
  recordId: string
  timestamp: ISO8601String
  userId: string
  userName: string
  action: 'create' | 'update' | 'delete'
  fieldChanges: Array<{
    fieldName: string
    fieldLabel: string
    oldValue: any
    newValue: any
    valueType: string
  }>
}

export interface AuditTrailFilter {
  startDate?: Date
  endDate?: Date
  userId?: string
  fieldName?: string
}
```

Create API client:

```typescript
// src/lib/api/audit-client.ts
export async function getRecordAuditTrail(
  tableName: string,
  recordId: string,
  filter?: AuditTrailFilter
): Promise<AuditEntry[]> {
  return apiClient.get(
    `/data/${tableName}/${recordId}/audit`,
    { params: filter }
  )
}
```

Create audit trail panel component:

```typescript
interface AuditTrailPanelProps {
  tableName: string
  recordId: string
}

export function AuditTrailPanel({
  tableName,
  recordId,
}: AuditTrailPanelProps) {
  const [filter, setFilter] = React.useState<AuditTrailFilter>({})
  const { data: entries, isLoading } = useQuery(
    ['audit', tableName, recordId, filter],
    () => getRecordAuditTrail(tableName, recordId, filter)
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <Input
          type="date"
          value={filter.startDate?.toISOString().split('T')[0] || ''}
          onChange={(e) =>
            setFilter((f) => ({ ...f, startDate: new Date(e.target.value) }))
          }
          placeholder="From"
        />
        <Input
          type="date"
          value={filter.endDate?.toISOString().split('T')[0] || ''}
          onChange={(e) =>
            setFilter((f) => ({ ...f, endDate: new Date(e.target.value) }))
          }
          placeholder="To"
        />
        <Select
          value={filter.userId || ''}
          onValueChange={(userId) =>
            setFilter((f) => ({ ...f, userId: userId || undefined }))
          }
        >
          <SelectTrigger>All Users</SelectTrigger>
          <SelectContent>
            {/* User options */}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {entries?.map((entry) => (
            <div key={entry.id} className="border-l-2 border-gray-300 pl-4 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{entry.action}</p>
                  <p className="text-sm text-gray-600">
                    by {entry.userName} at{' '}
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              {entry.fieldChanges.length > 0 && (
                <div className="mt-2 space-y-1 text-sm">
                  {entry.fieldChanges.map((change) => (
                    <div key={change.fieldName} className="text-gray-700">
                      <strong>{change.fieldLabel}:</strong>{' '}
                      <span className="line-through">{change.oldValue}</span> →{' '}
                      <span className="font-semibold">{change.newValue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

Add as tab in Record View page:

```typescript
export function RecordViewPage() {
  const [activeTab, setActiveTab] = React.useState('details')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="details">Record</TabsTrigger>
        <TabsTrigger value="audit">Audit Trail</TabsTrigger>
      </TabsList>
      <TabsContent value="details">{/* Record details */}</TabsContent>
      <TabsContent value="audit">
        <AuditTrailPanel tableName={table} recordId={id} />
      </TabsContent>
    </Tabs>
  )
}
```

**Acceptance Criteria:**
- Audit tab visible on Record View page
- Timeline displays all changes chronologically
- Field changes show old → new values
- User name and timestamp displayed for each change
- Filter by date range, user, or field works
- No changes shown if audit disabled on table

---

### Step 17: Developer Tools Pages (Table & Record)

**Files Created:**
- `src/app/(dashboard)/app/[appName]/[tableName]/dev/page.tsx`
- `src/app/(dashboard)/app/[appName]/[tableName]/[id]/dev/page.tsx`
- `src/components/developer/table-metadata-inspector.tsx`
- `src/components/developer/record-developer-view.tsx`

**Implementation:**

Create table dev page:

```typescript
// src/app/(dashboard)/app/[appName]/[tableName]/dev/page.tsx
export default function TableDevPage({
  params: { tableName },
}: {
  params: { tableName: string }
}) {
  const { data: metadata } = useQuery(
    ['table-metadata', tableName],
    () => apiClient.getTableMetadata(tableName)
  )

  if (!metadata) return <Skeleton />

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Table Developer View: {tableName}</h1>

        {/* Metadata Inspector */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <JSONViewer data={metadata} />
          </CardContent>
        </Card>

        {/* Field Definitions */}
        <Card>
          <CardHeader>
            <CardTitle>Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Label</th>
                  <th>Required</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {metadata.fields.map((f) => (
                  <tr key={f.name} className="border-t">
                    <td className="font-mono text-xs">{f.name}</td>
                    <td>{f.fieldType}</td>
                    <td>{f.label}</td>
                    <td>{f.isRequired ? 'Yes' : 'No'}</td>
                    <td className="text-xs">{JSON.stringify(f.permissions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Section Layout */}
        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
          </CardHeader>
          <CardContent>
            {metadata.sections.map((section) => (
              <div key={section.name} className="mb-4 border-l-2 pl-4">
                <h4 className="font-semibold">{section.label}</h4>
                <p className="text-sm text-gray-600">{section.name}</p>
                <ul className="text-sm mt-2">
                  {section.fields.map((f) => (
                    <li key={f} className="text-gray-700">
                      • {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <JSONViewer data={metadata.permissions} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
```

Create record dev page:

```typescript
// src/app/(dashboard)/app/[appName]/[tableName]/[id]/dev/page.tsx
export default function RecordDevPage({
  params: { tableName, id },
}: {
  params: { tableName: string; id: string }
}) {
  const { data: record } = useQuery(
    ['record-dev', tableName, id],
    () => apiClient.getDeveloperRecord(tableName, id)
  )

  if (!record) return <Skeleton />

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Record Developer View</h1>

        {/* Raw Values */}
        <Card>
          <CardHeader>
            <CardTitle>Raw Values</CardTitle>
          </CardHeader>
          <CardContent>
            <JSONViewer data={record} />
          </CardContent>
        </Card>

        {/* Associated Scripts */}
        <Card>
          <CardHeader>
            <CardTitle>Associated Scripts</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Script editor + execution */}
            <ScriptEditor
              recordId={id}
              tableName={tableName}
              scripts={record.scripts || []}
            />
          </CardContent>
        </Card>

        {/* Script Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Script Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Log viewer */}
            <ScriptLogViewer recordId={id} tableName={tableName} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
```

**Acceptance Criteria:**
- Table dev page shows metadata, fields, sections, permissions
- Record dev page shows raw values and associated scripts
- JSON viewer syntax highlights
- Only accessible in development mode or with admin permission
- Script editor and test execution work (Step 18)

---

### Step 18: Script Editor & Test Execution

**Files Created:**
- `src/components/developer/script-editor.tsx`
- `src/components/developer/script-log-viewer.tsx`
- `src/lib/api/script-client.ts`

**Implementation:**

Create script editor with Monaco:

```typescript
interface ScriptEditorProps {
  tableName: string
  recordId: string
  scripts?: ScriptMetadata[]
}

export function ScriptEditor({
  tableName,
  recordId,
  scripts = [],
}: ScriptEditorProps) {
  const [selectedScript, setSelectedScript] = React.useState<string>('')
  const [code, setCode] = React.useState('')
  const [output, setOutput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  const handleTestExecution = async (input: Record<string, any>) => {
    setIsLoading(true)
    try {
      const result = await apiClient.post(
        `/data/${tableName}/${recordId}/developer/associatedScript/${selectedScript}/test`,
        { code, input }
      )
      setOutput(JSON.stringify(result, null, 2))
    } catch (error) {
      setOutput(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Script selector */}
      <Select value={selectedScript} onValueChange={setSelectedScript}>
        <SelectTrigger>Select script</SelectTrigger>
        <SelectContent>
          {scripts.map((s) => (
            <SelectItem key={s.name} value={s.name}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Editor */}
      <Editor
        height="300px"
        language="javascript"
        value={code}
        onChange={(v) => setCode(v || '')}
        options={{ minimap: { enabled: false } }}
      />

      {/* Test button */}
      <Button
        onClick={() => handleTestExecution({})}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Testing...' : 'Test Script'}
      </Button>

      {/* Output */}
      {output && (
        <div className="bg-slate-100 p-4 rounded font-mono text-sm max-h-[200px] overflow-y-auto">
          {output}
        </div>
      )}
    </div>
  )
}
```

Create log viewer:

```typescript
interface ScriptLogViewerProps {
  tableName: string
  recordId: string
}

export function ScriptLogViewer({
  tableName,
  recordId,
}: ScriptLogViewerProps) {
  const [filter, setFilter] = React.useState({ scriptName: '', level: 'all' })
  const { data: logs } = useQuery(
    ['script-logs', tableName, recordId, filter],
    () =>
      apiClient.get(
        `/data/${tableName}/${recordId}/developer/associatedScript/logs`,
        { params: filter }
      )
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <Input
          placeholder="Filter by script..."
          value={filter.scriptName}
          onChange={(e) => setFilter((f) => ({ ...f, scriptName: e.target.value }))}
        />
        <Select value={filter.level} onValueChange={(level) => setFilter((f) => ({ ...f, level }))}>
          <SelectTrigger>All Levels</SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs */}
      <div className="bg-slate-900 text-white p-4 rounded font-mono text-sm max-h-[400px] overflow-y-auto">
        {logs?.map((log) => (
          <div
            key={log.id}
            className={cn(
              'py-1',
              log.level === 'error' && 'text-red-400',
              log.level === 'warn' && 'text-yellow-400'
            )}
          >
            <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- Script editor loads code with syntax highlighting
- Test execution sends script to backend
- Output displayed in panel below editor
- Log viewer filters by script name and level
- Logs displayed in monospace chronologically

---

### Step 19: Report Execution Pages

**Files Created:**
- `src/app/(dashboard)/app/reports/[reportName]/page.tsx`
- `src/components/report/report-run-page.tsx`

**Implementation:**

Create report run page:

```typescript
// src/app/(dashboard)/app/reports/[reportName]/page.tsx
export default function ReportRunPage({
  params: { reportName },
}: {
  params: { reportName: string }
}) {
  const { data: reportMetadata } = useQuery(
    ['report', reportName],
    () => apiClient.getReportMetadata(reportName)
  )

  if (!reportMetadata) return <Skeleton />

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">{reportMetadata.label}</h1>
        <p className="text-gray-600">{reportMetadata.description}</p>

        {/* Report metadata chrome */}
        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Parameter form — reuse EntityForm from Package 3 */}
            <EntityForm
              tableName={reportMetadata.processName}
              formMode="create"
              sections={reportMetadata.parameterSections || []}
              onSubmit={async (values) => {
                // Run report with parameters
              }}
            />
          </CardContent>
        </Card>

        {/* Output display — reuse ProcessRun from Package 4 */}
        <ProcessRun processName={reportMetadata.processName} />
      </div>
    </DashboardLayout>
  )
}
```

Since reports are process-backed (per requirements), reuse ProcessRun component from Package 4.

**Acceptance Criteria:**
- Report page displays parameter form
- Report page displays execution results
- Parameters passed to backend process
- Output rendered according to report type
- Report metadata drives parameter fields

---

### Step 20: Storybook Setup

**Files Created:**
- `.storybook/main.ts`
- `.storybook/preview.ts`
- `.storybook/preview.css`
- `src/components/**/*.stories.tsx` (60+ files)

**Implementation:**

Initialize Storybook:

```bash
npx storybook@latest init --type next
```

Configure:

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  framework: '@storybook/nextjs',
  stories: ['../src/**/*.stories.{js,jsx,ts,tsx}'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
    '@storybook/addon-viewport',
  ],
  webpackFinal: async (config) => {
    return config
  },
}

export default config
```

Create stories for core components:

```typescript
// src/components/data-grid/data-grid.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { DataGrid } from './data-grid'

const meta: Meta<typeof DataGrid> = {
  component: DataGrid,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: {
    columns: [],
    records: [],
    isLoading: true,
  },
}

export const WithData: Story = {
  args: {
    columns: [
      { name: 'id', label: 'ID' },
      { name: 'name', label: 'Name' },
    ],
    records: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ],
  },
}

export const Empty: Story = {
  args: {
    columns: [],
    records: [],
  },
}

export const Error: Story = {
  args: {
    columns: [],
    records: [],
    error: 'Failed to load records',
  },
}
```

Create stories for all components from Packages 1–5:
- Layout components (10–15 stories)
- Form components (15–20 stories)
- Data Grid (10–15 stories)
- Widget components (20–30 stories)

**Acceptance Criteria:**
- Storybook builds successfully
- All components have at least 4 stories (loading, empty, error, data)
- a11y addon checks accessibility in stories
- Controls allow prop exploration
- Visual regression baseline screenshots captured

---

### Step 21: Playwright E2E Test Suite

**Files Created:**
- `playwright.config.ts` (update from Package 1)
- `playwright/fixtures/auth.ts`
- `playwright/fixtures/api.ts`
- `playwright/tests/auth.spec.ts`
- `playwright/tests/record-query.spec.ts`
- `playwright/tests/record-crud.spec.ts`
- `playwright/tests/process.spec.ts`
- `playwright/tests/widgets.spec.ts`
- `playwright/tests/responsive.spec.ts`
- `playwright/tests/error-handling.spec.ts`

**Implementation:**

Create auth fixture:

```typescript
// playwright/fixtures/auth.ts
import { test as base } from '@playwright/test'

type AuthFixtures = {
  authenticatedPage: Page
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login
    await page.goto('http://localhost:3000/auth/login')

    // Mock OAuth flow or use test credentials
    await page.fill('[data-test="email-input"]', 'test@example.com')
    await page.fill('[data-test="password-input"]', 'password')
    await page.click('[data-test="login-button"]')

    // Wait for redirect to app
    await page.waitForURL('/app/**')

    await use(page)

    // Cleanup: logout
    await page.goto('http://localhost:3000/auth/logout')
  },
})
```

Create auth tests:

```typescript
// playwright/tests/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login flow', async ({ page }) => {
    await page.goto('http://localhost:3000')
    expect(page.url()).toContain('/auth/login')

    await page.fill('[data-test="email"]', 'test@example.com')
    await page.fill('[data-test="password"]', 'password')
    await page.click('[data-test="login-button"]')

    await page.waitForURL('/app/**')
    expect(page.url()).toContain('/app')
  })

  test('logout flow', async ({ authenticatedPage: page }) => {
    await page.click('[data-test="user-menu"]')
    await page.click('[data-test="logout-button"]')

    expect(page.url()).toContain('/auth/login')
  })

  test('401 shows re-auth modal', async ({ authenticatedPage: page }) => {
    // Simulate session expiry by deleting cookie
    await page.context().clearCookies()

    // Try to access protected resource
    await page.goto('http://localhost:3000/app/Table1')

    // Should show re-auth modal instead of redirect
    expect(await page.locator('[role="dialog"]').isVisible()).toBe(true)
  })
})
```

Create record query tests:

```typescript
// playwright/tests/record-query.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Record Query', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('http://localhost:3000/app/Table1')
  })

  test('loads table records', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-test="data-grid"]')).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(25, { timeout: 10000 })
  })

  test('filters records', async ({ authenticatedPage: page }) => {
    await page.click('[data-test="filter-button"]')
    await page.selectOption('[data-test="filter-field"]', 'name')
    await page.selectOption('[data-test="filter-operator"]', 'contains')
    await page.fill('[data-test="filter-value"]', 'test')
    await page.click('[data-test="apply-filter"]')

    await expect(page.locator('tbody tr')).toBeLessThan(25)
  })

  test('sorts records', async ({ authenticatedPage: page }) => {
    await page.click('[data-test="column-header-name"]')
    await expect(page.locator('[data-test="sort-indicator"]')).toHaveClass(/ascending|descending/)
  })

  test('paginates records', async ({ authenticatedPage: page }) => {
    await page.click('[data-test="next-page"]')
    await expect(page).toHaveURL(/page=2/)
  })

  test('exports records', async ({ authenticatedPage: page }) => {
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-test="export-button"]')
    await page.click('[data-test="export-csv"]')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('.csv')
  })
})
```

Create CRUD tests:

```typescript
// playwright/tests/record-crud.spec.ts
test.describe('Record CRUD', () => {
  test('create record', async ({ authenticatedPage: page }) => {
    await page.goto('http://localhost:3000/app/Table1/create')

    await page.fill('[data-test="field-name"]', 'New Item')
    await page.fill('[data-test="field-description"]', 'Test description')
    await page.click('[data-test="save-button"]')

    await expect(page).toHaveURL(/\/app\/Table1\/\d+/)
    await expect(page.locator('[data-test="record-name"]')).toContainText('New Item')
  })

  test('edit record', async ({ authenticatedPage: page }) => {
    await page.goto('http://localhost:3000/app/Table1/1')

    await page.click('[data-test="edit-button"]')
    await page.fill('[data-test="field-name"]', 'Updated Name')
    await page.click('[data-test="save-button"]')

    await expect(page.locator('[data-test="record-name"]')).toContainText('Updated Name')
  })

  test('delete record', async ({ authenticatedPage: page }) => {
    await page.goto('http://localhost:3000/app/Table1/1')

    await page.click('[data-test="delete-button"]')
    await page.click('[data-test="confirm-delete"]')

    await expect(page).toHaveURL(/\/app\/Table1($|\?)/i)
  })
})
```

Create responsive tests:

```typescript
// playwright/tests/responsive.spec.ts
test.describe('Responsive Design', () => {
  test('mobile view shows card layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('http://localhost:3000/app/Table1')

    // Card view visible
    await expect(page.locator('[data-test="mobile-card"]')).toBeVisible()
    // Data grid hidden
    await expect(page.locator('[data-test="data-grid"]')).toBeHidden()
  })

  test('tablet view shows grid', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('http://localhost:3000/app/Table1')

    // Data grid visible
    await expect(page.locator('[data-test="data-grid"]')).toBeVisible()
  })

  test('mobile sidebar is drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('http://localhost:3000/app/Table1')

    // Hamburger visible
    await expect(page.locator('[data-test="hamburger-button"]')).toBeVisible()
    // Sidebar hidden
    await expect(page.locator('[data-test="sidebar"]')).toBeHidden()

    // Click hamburger opens drawer
    await page.click('[data-test="hamburger-button"]')
    await expect(page.locator('[data-test="mobile-drawer"]')).toBeVisible()
  })
})
```

**Acceptance Criteria:**
- Auth flow test: login → app → logout
- Record Query tests: load, filter, sort, paginate, export
- CRUD tests: create, view, edit, delete
- Process tests: init, fill steps, async, results
- Widget tests: load, render, re-fetch
- Responsive tests: mobile/tablet/desktop
- Error handling: 401, 500, 404
- All tests pass in CI
- Coverage >80%

---

### Step 22: Bundle Analysis & Lazy Loading

**Files Created:**
- `next.config.ts` (update)
- `src/components/widgets/charts/lazy-charts.tsx`
- `src/components/developer/lazy-code-editor.tsx`
- `playwright/bundle-analysis.spec.ts`

**Implementation:**

Enable bundle analyzer:

```typescript
// next.config.ts
import withBundleAnalyzer from 'next-bundle-analyzer'

const nextConfig = {
  // ... existing config
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      'recharts',
      '@monaco-editor/react',
    ],
  },
}

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withAnalyzer(nextConfig)
```

Lazy load Recharts charts:

```typescript
// src/components/widgets/charts/lazy-charts.tsx
import dynamic from 'next/dynamic'

export const DynamicLineChart = dynamic(
  () => import('./line-chart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Don't render on server
  }
)

export const DynamicBarChart = dynamic(
  () => import('./bar-chart'),
  { loading: () => <ChartSkeleton />, ssr: false }
)

export const DynamicPieChart = dynamic(
  () => import('./pie-chart'),
  { loading: () => <ChartSkeleton />, ssr: false }
)
```

Lazy load Monaco editor:

```typescript
// src/components/developer/lazy-code-editor.tsx
import dynamic from 'next/dynamic'

export const DynamicMonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.Editor),
  {
    loading: () => <EditorSkeleton />,
    ssr: false,
  }
)
```

Update ScriptEditor to use lazy version.

**Acceptance Criteria:**
- Bundle analysis runs on build
- Recharts lazy loaded (not in main bundle)
- Monaco editor lazy loaded
- Code-split by route (automatic Next.js)
- Main bundle <200KB gzipped
- No main bundle growth >10% per PR

---

### Step 23: Image Optimization & TanStack Query Tuning

**Files Created:**
- `src/lib/api/query-config.ts`
- `src/components/ui/optimized-image.tsx`

**Implementation:**

Optimize TanStack Query:

```typescript
// src/lib/api/query-config.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
})
```

Optimize images with Next.js Image:

```typescript
// src/components/ui/optimized-image.tsx
import Image from 'next/image'

interface OptimizedImageProps {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
}: OptimizedImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      loading={priority ? 'eager' : 'lazy'}
    />
  )
}
```

**Acceptance Criteria:**
- TanStack Query cache configured with appropriate stale times
- Images use next/image optimization
- Images lazy loaded by default
- Critical images (above fold) loaded eagerly
- Responsive image sizes via sizes prop

---

### Step 24: Virtual Scrolling for Large Lists

**Files Created:**
- `src/hooks/use-virtual-list.ts`
- `src/components/data-grid/virtualized-data-grid.tsx`
- `src/components/form/virtualized-select.tsx`

**Implementation:**

Add react-window for virtual scrolling:

```bash
pnpm add react-window
```

Create hook:

```typescript
// src/hooks/use-virtual-list.ts
import { useEffect, useRef } from 'react'

export function useVirtualList({
  items,
  itemHeight,
  containerHeight,
  onVisibleRangeChange,
}: {
  items: any[]
  itemHeight: number
  containerHeight: number
  onVisibleRangeChange?: (start: number, end: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return

      const scrollTop = containerRef.current.scrollTop
      const start = Math.floor(scrollTop / itemHeight)
      const end = Math.ceil((scrollTop + containerHeight) / itemHeight)

      onVisibleRangeChange?.(start, Math.min(end, items.length))
    }

    containerRef.current?.addEventListener('scroll', handleScroll)
    return () => containerRef.current?.removeEventListener('scroll', handleScroll)
  }, [itemHeight, containerHeight, items.length])

  return containerRef
}
```

Virtualize DataGrid for >100 rows:

```typescript
export function DataGrid({ records, columns, ...props }: DataGridProps) {
  const shouldVirtualize = records.length > 100

  if (shouldVirtualize) {
    return <VirtualizedDataGrid records={records} columns={columns} {...props} />
  }

  return <StandardDataGrid records={records} columns={columns} {...props} />
}
```

Virtualize select dropdowns for >50 items:

```typescript
export function SelectWithVirtualization({
  options,
  ...props
}: SelectProps) {
  const shouldVirtualize = options.length > 50

  if (shouldVirtualize) {
    return <VirtualizedSelect options={options} {...props} />
  }

  return <StandardSelect options={options} {...props} />
}
```

**Acceptance Criteria:**
- DataGrid virtualized for >100 rows
- Dropdown virtualized for >50 items
- Smooth scrolling performance maintained
- Correct item heights measured
- Visible range updates on scroll

---

### Step 25: Lighthouse CI Integration

**Files Created:**
- `lighthouserc.json`
- `.github/workflows/lighthouse.yml`

**Implementation:**

Configure Lighthouse CI:

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/app",
        "http://localhost:3000/app/Table1",
        "http://localhost:3000/app/Table1/1"
      ],
      "numberOfRuns": 3,
      "settings": {
        "chromeFlags": "--no-sandbox"
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["warn", { "minScore": 0.85 }]
      }
    }
  }
}
```

Create CI workflow:

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm run start &
      - run: sleep 5
      - uses: treosh/lighthouse-ci-action@v10
        with:
          configPath: './lighthouserc.json'
```

**Acceptance Criteria:**
- Lighthouse CI runs on every PR
- Performance score >90
- Accessibility score >95
- Best practices score >85
- Results uploaded and available for review

---

### Step 26: CSS Custom Property System (60+ tokens)

**Files Created:**
- `src/lib/styles/theme-tokens.css`
- `src/lib/hooks/use-css-variables.ts`

**Implementation:**

Define complete CSS custom property system:

```css
/* src/lib/styles/theme-tokens.css */
:root {
  /* Colors — Primary */
  --color-primary: #2563eb;
  --color-primary-dark: #1e40af;
  --color-primary-light: #3b82f6;
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;

  /* Colors — Semantic */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #0ea5e9;

  /* Colors — Neutral */
  --color-text-primary: #1f2937;
  --color-text-secondary: #6b7280;
  --color-text-tertiary: #9ca3af;
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-bg-tertiary: #f3f4f6;
  --color-border: #e5e7eb;
  --color-border-light: #f3f4f6;
  --color-focus: #2563eb;

  /* Typography */
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  --font-family-mono: 'Monaco', 'Courier New', monospace;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-size-4xl: 2.25rem;
  --font-weight-light: 300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  --spacing-3xl: 4rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-base: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-full: 9999px;

  /* Layout */
  --sidebar-width: 256px;
  --sidebar-width-mini: 64px;
  --header-height: 64px;
  --footer-height: 60px;

  /* Transitions */
  --transition-fast: 150ms ease-in-out;
  --transition-base: 250ms ease-in-out;
  --transition-slow: 350ms ease-in-out;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #f3f4f6;
    --color-text-secondary: #d1d5db;
    --color-text-tertiary: #9ca3af;
    --color-bg-primary: #111827;
    --color-bg-secondary: #1f2937;
    --color-bg-tertiary: #374151;
    --color-border: #4b5563;
    --color-border-light: #2d3748;
  }
}

/* High contrast mode */
@media (prefers-contrast: more) {
  :root {
    --color-text-primary: #000;
    --color-bg-primary: #fff;
    --color-border: #000;
    --color-focus: #000;
  }
}
```

Create hook to inject theme variables:

```typescript
// src/lib/hooks/use-css-variables.ts
export function useCSSVariables(theme: QThemeMetaData) {
  React.useEffect(() => {
    const root = document.documentElement

    // Inject theme colors
    if (theme.colors) {
      Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value)
      })
    }

    // Inject custom CSS
    if (theme.customCSS) {
      const style = document.createElement('style')
      style.textContent = theme.customCSS
      document.head.appendChild(style)
      return () => document.head.removeChild(style)
    }
  }, [theme])
}
```

**Acceptance Criteria:**
- 60+ CSS custom properties defined
- Properties follow naming convention (--color-, --font-, etc.)
- Dark mode properties override in media query
- High contrast mode properties override
- Custom CSS from backend injected safely
- All components use custom properties, not hardcoded values

---

### Step 27: data-qqq-id Attribute Verification

**Files Created:**
- `src/lib/utils/data-qqq-id-checker.ts`
- `playwright/data-qqq-id-tests.spec.ts`

**Implementation:**

Create verification utility:

```typescript
// src/lib/utils/data-qqq-id-checker.ts
export function verifyDataQqqIds(root: HTMLElement = document.body): string[] {
  const errors: string[] = []

  // Interactive elements that should have data-qqq-id
  const interactiveSelectors = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[role="menuitem"]',
  ]

  interactiveSelectors.forEach((selector) => {
    root.querySelectorAll(selector).forEach((el) => {
      const id = el.getAttribute('data-qqq-id')
      if (!id) {
        errors.push(`${selector} missing data-qqq-id: ${el.textContent?.slice(0, 30)}`)
      }
    })
  })

  return errors
}
```

Create Playwright test:

```typescript
// playwright/data-qqq-id-tests.spec.ts
test('all interactive elements have data-qqq-id', async ({ page }) => {
  await page.goto('http://localhost:3000/app/Table1')

  const errors = await page.evaluate(() => {
    const interactiveSelectors = [
      'button',
      'a[href]',
      'input',
      'select',
      '[role="button"]',
      '[role="link"]',
    ]

    const missing: string[] = []

    interactiveSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!el.getAttribute('data-qqq-id')) {
          missing.push(`${selector}: ${el.textContent?.slice(0, 20)}`)
        }
      })
    })

    return missing
  })

  expect(errors).toHaveLength(0)
})
```

Apply data-qqq-id to all interactive elements systematically.

**Acceptance Criteria:**
- All buttons have data-qqq-id
- All links have data-qqq-id
- All form inputs have data-qqq-id
- All interactive elements have unique IDs
- CI test verifies coverage on every page

---

### Step 28: Custom CSS Injection Support

**Files Created:**
- `src/lib/api/theme-client.ts`
- `src/lib/hooks/use-theme-injection.ts`

**Implementation:**

Already partially in Step 26, but formalize API:

```typescript
// src/lib/api/theme-client.ts
export async function getCustomCSS(): Promise<string | null> {
  const metadata = await apiClient.getMetadata()
  return metadata?.branding?.customCSS || null
}

export async function injectCustomCSS(css: string) {
  const style = document.createElement('style')
  style.id = 'qqq-custom-css'
  style.textContent = css
  document.head.appendChild(style)
}

export async function removeCustomCSS() {
  document.getElementById('qqq-custom-css')?.remove()
}
```

Create hook:

```typescript
// src/lib/hooks/use-theme-injection.ts
export function useThemeInjection() {
  React.useEffect(() => {
    const inject = async () => {
      const css = await getCustomCSS()
      if (css) {
        injectCustomCSS(css)
        return () => removeCustomCSS()
      }
    }

    const cleanup = inject()
    return cleanup
  }, [])
}
```

Add to root layout to inject custom CSS on app load.

**Acceptance Criteria:**
- Custom CSS loaded from backend branding metadata
- CSS injected safely (no XSS)
- CSS removed on unmount
- Works with light/dark mode
- No layout shift on injection

---

### Step 29: Session Timeout UX with Re-Auth Modal

**Files Created:**
- `src/components/auth/reauthentication-modal.tsx`
- `src/hooks/use-session-timeout.ts`
- `src/lib/api/session-client.ts`

**Implementation:**

Create session timeout hook:

```typescript
// src/hooks/use-session-timeout.ts
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const WARNING_TIME_MS = 5 * 60 * 1000 // 5 minutes before timeout

export function useSessionTimeout() {
  const [isExpired, setIsExpired] = React.useState(false)
  const [isWarning, setIsWarning] = React.useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const warningRef = React.useRef<NodeJS.Timeout | null>(null)

  const resetSession = React.useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)

    // Set warning timer (5 min before expiry)
    warningRef.current = setTimeout(() => {
      setIsWarning(true)
    }, SESSION_TIMEOUT_MS - WARNING_TIME_MS)

    // Set expiry timer
    timeoutRef.current = setTimeout(() => {
      setIsExpired(true)
      setIsWarning(false)
    }, SESSION_TIMEOUT_MS)
  }, [])

  // Reset on user activity
  React.useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']

    const handleActivity = () => {
      setIsWarning(false)
      resetSession()
    }

    events.forEach((event) => {
      document.addEventListener(event, handleActivity)
    })

    resetSession() // Initial set

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [resetSession])

  return { isExpired, isWarning, resetSession }
}
```

Create re-auth modal:

```typescript
// src/components/auth/reauthentication-modal.tsx
export function ReauthenticationModal({
  isOpen,
  onAuthenticate,
}: {
  isOpen: boolean
  onAuthenticate: () => void
}) {
  const [formData, setFormData] = React.useState({ email: '', password: '' })
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await apiClient.post('/manageSession', formData)
      onAuthenticate()
    } catch (err) {
      setError('Authentication failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Session Expired</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600">
          Your session has expired. Please log in again to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
            disabled={isLoading}
          />
          <Input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
            disabled={isLoading}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

Integrate into root layout:

```typescript
// In root layout or auth provider
const { isExpired, isWarning, resetSession } = useSessionTimeout()

return (
  <>
    {isWarning && (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-400 p-4 rounded">
        Your session will expire in 5 minutes. Keep working to extend your session.
      </div>
    )}

    <ReauthenticationModal
      isOpen={isExpired}
      onAuthenticate={resetSession}
    />

    {/* Main app content */}
  </>
)
```

**Acceptance Criteria:**
- 5-minute warning shown before expiry
- Re-auth modal is non-disruptive overlay (not full page)
- Form data preserved across re-auth
- Scroll position preserved
- Filter state preserved
- No session expiry on user activity

---

## 6. Component Specifications (TypeScript Interfaces)

### 6.1 CommandPalette Component

```typescript
interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  items?: CommandPaletteItem[]
}

interface CommandPaletteItem {
  id: string
  label: string
  category: 'table' | 'process' | 'report' | 'recent'
  action: () => void | Promise<void>
  icon?: React.ReactNode
  meta?: Record<string, any>
}

interface CommandPaletteState {
  isOpen: boolean
  search: string
  selectedIndex: number
  filteredItems: CommandPaletteItem[]
}
```

### 6.2 AuditTrailPanel Component

```typescript
interface AuditTrailPanelProps {
  tableName: string
  recordId: string
  filter?: AuditTrailFilter
}

interface AuditEntry {
  id: string
  recordId: string
  timestamp: string // ISO 8601
  userId: string
  userName: string
  action: 'create' | 'update' | 'delete'
  fieldChanges: FieldChange[]
}

interface FieldChange {
  fieldName: string
  fieldLabel: string
  oldValue: any
  newValue: any
  valueType: string
}

interface AuditTrailFilter {
  startDate?: Date
  endDate?: Date
  userId?: string
  fieldName?: string
}
```

### 6.3 DeveloperTableView Component

```typescript
interface DeveloperTableViewProps {
  tableName: string
}

interface TableMetadataInspector {
  name: string
  label: string
  fields: QFieldMetaData[]
  sections: QTableSection[]
  permissions: Record<string, any>
  joins: Array<{ name: string; targetTable: string }>
  capabilities: string[]
}
```

### 6.4 DeveloperRecordView Component

```typescript
interface DeveloperRecordViewProps {
  tableName: string
  recordId: string
}

interface RecordDeveloperData {
  record: QRecord
  scripts?: ScriptMetadata[]
  logs?: ScriptLog[]
}

interface ScriptMetadata {
  name: string
  label: string
  content: string
  lastExecuted?: string
  lastStatus?: 'success' | 'error'
}

interface ScriptLog {
  id: string
  timestamp: string
  level: 'info' | 'error' | 'debug' | 'warn'
  message: string
  scriptName?: string
}
```

### 6.5 ScriptEditor Component

```typescript
interface ScriptEditorProps {
  tableName: string
  recordId: string
  scripts?: ScriptMetadata[]
  onSave?: (script: ScriptMetadata) => Promise<void>
}

interface ScriptEditorState {
  selectedScript: string
  code: string
  output: string
  isLoading: boolean
  error?: string
}
```

### 6.6 MobileCardView Component

```typescript
interface MobileCardViewProps {
  records: QRecord[]
  columns: Column[]
  onRowSelect?: (record: QRecord) => void
  onEdit?: (record: QRecord) => void
  onDelete?: (record: QRecord) => void
  loading?: boolean
  error?: string
}

interface MobileCardProps {
  record: QRecord
  columns: Column[]
  onSelect?: (record: QRecord) => void
  onEdit?: (record: QRecord) => void
  onDelete?: (record: QRecord) => void
}
```

### 6.7 ResponsiveFormLayout Component

```typescript
interface ResponsiveFormLayoutProps {
  sections: QTableSection[]
  gridColumns?: GridColumnConfig
  children: React.ReactNode
}

interface GridColumnConfig {
  mobile?: number
  tablet?: number
  desktop?: number
}
```

### 6.8 KeyboardShortcuts System

```typescript
interface KeyboardShortcut {
  key: string // e.g., 'Cmd+K', 'Ctrl+/', 'n'
  description: string
  category: 'global' | 'table' | 'record' | 'process'
  action: () => void | Promise<void>
  enabled?: boolean
}

interface KeyboardShortcutsContext {
  shortcuts: KeyboardShortcut[]
  register: (shortcut: KeyboardShortcut) => void
  unregister: (key: string) => void
  execute: (key: string) => Promise<void>
  isEnabled: (key: string) => boolean
}
```

### 6.9 SessionTimeout System

```typescript
interface SessionTimeoutConfig {
  timeoutMs: number
  warningTimeMs: number
  onWarning?: () => void
  onExpired?: () => void
}

interface SessionTimeoutState {
  isExpired: boolean
  isWarning: boolean
  timeRemaining: number // milliseconds
  resetSession: () => void
}

interface ReauthenticationModalProps {
  isOpen: boolean
  onAuthenticate: () => void
  preserveState?: {
    formData?: Record<string, any>
    scrollPosition?: number
    filterState?: any
  }
}
```

---

## 7. API Client Functions

All API client functions already defined in Packages 1–5. Additional functions required for Package 6:

```typescript
// Audit Trail
export async function getRecordAuditTrail(
  tableName: string,
  recordId: string,
  filter?: AuditTrailFilter
): Promise<AuditEntry[]>

// Developer Tools
export async function getTableDeveloperMetadata(
  tableName: string
): Promise<TableMetadataInspector>

export async function getRecordDeveloperData(
  tableName: string,
  recordId: string
): Promise<RecordDeveloperData>

export async function testScript(
  tableName: string,
  recordId: string,
  fieldName: string,
  code: string,
  input: Record<string, any>
): Promise<{ output: any; error?: string }>

export async function getScriptLogs(
  tableName: string,
  recordId: string,
  filter?: { scriptName?: string; level?: string }
): Promise<ScriptLog[]>

// Custom CSS
export async function getCustomCSS(): Promise<string | null>

// Session
export async function refreshSession(): Promise<boolean>

export async function extendSessionTimeout(): Promise<void>
```

---

## 8. Testing Requirements

### 8.1 Unit Tests (Vitest)

- **Responsive utilities:** breakpoint detection, column calculation
- **Keyboard shortcuts:** registration, execution, conflict detection
- **Session timeout:** timer management, activity reset
- **Audit trail:** filtering, sorting, field change display
- **Developer tools:** metadata parsing, script execution

### 8.2 Integration Tests

- **Command palette:** search, filtering, navigation, selection
- **Keyboard shortcuts:** global handling, modal focus trapping
- **Session timeout:** warning display, re-auth flow
- **Audit trail:** data fetching, filtering, timeline rendering

### 8.3 Accessibility Tests (axe-core + Playwright)

- All pages pass axe-core audit
- Focus management verified in modals
- aria-live regions announced correctly
- Keyboard navigation works on all pages
- Color contrast >4.5:1 (normal) / >3:1 (large)
- Skip link functional

### 8.4 E2E Tests (Playwright)

- Auth flow: login → app → logout
- Record Query: load, filter, sort, paginate, export, mobile card view
- Record CRUD: create, view, edit, delete
- Process execution: init, fill steps, async, results
- Widget rendering: load, dropdown, re-fetch
- Responsive: mobile, tablet, desktop layouts
- Error handling: 401 re-auth, 500 error page, 404
- Audit trail: display, filter, field changes
- Developer tools: table view, record view, script test
- Keyboard shortcuts: all global/table/record shortcuts
- Session timeout: warning, re-auth modal

---

## 9. Acceptance Criteria (30+ Binary Pass/Fail)

1. **Mobile card view displays for Record Query on <768px** ✓
2. **DataGrid displays for Record Query on ≥768px** ✓
3. **Form displays single column on mobile** ✓
4. **Form displays multi-column on tablet+ per gridColumns metadata** ✓
5. **Off-canvas sidebar drawer opens on hamburger click (mobile)** ✓
6. **Bottom sheet filter panel opens on mobile** ✓
7. **All buttons min 44×44px or equivalent touch area** ✓
8. **Widget grid responsive (1/2/N col per viewport)** ✓
9. **Breadcrumbs truncate to first + last 2 items on mobile** ✓
10. **Sticky headers on mobile with safe area inset** ✓
11. **Bottom action buttons anchored at bottom on mobile** ✓
12. **axe-core audit runs in CI on every PR** ✓
13. **Build fails if critical a11y violations present** ✓
14. **Focus trapped in modal (Tab cycles within modal)** ✓
15. **Focus restored to trigger element on modal close** ✓
16. **aria-live regions announce toasts to screen readers** ✓
17. **aria-busy="true" set on loading states** ✓
18. **Normal text contrast ≥4.5:1** ✓
19. **Large text contrast ≥3:1** ✓
20. **All interactive elements keyboard navigable** ✓
21. **Tab/Shift+Tab cycles through focusable elements** ✓
22. **Escape closes modals and panels** ✓
23. **Skip-to-content link visible on focus** ✓
24. **Skip link jumps to #main-content** ✓
25. **High contrast mode activates on prefers-contrast: more** ✓
26. **Cmd+K / Ctrl+K opens command palette** ✓
27. **Command palette searches tables, processes, reports** ✓
28. **Arrow keys navigate palette results** ✓
29. **Enter selects palette item and navigates** ✓
30. **Audit trail tab displays on Record View page** ✓
31. **Audit timeline shows all changes chronologically** ✓
32. **Audit field changes display old → new values** ✓
33. **Audit entries filter by date range, user, field** ✓
34. **Table dev page displays metadata, fields, sections** ✓
35. **Record dev page displays raw values and scripts** ✓
36. **Script editor syntax highlights code** ✓
37. **Script test execution shows output** ✓
38. **Script logs viewer filters and displays chronologically** ✓
39. **Report page displays parameter form and results** ✓
40. **Storybook builds successfully** ✓
41. **All components have ≥4 stories (loading, empty, error, data)** ✓
42. **a11y addon checks accessibility in Storybook** ✓
43. **Playwright auth flow test passes** ✓
44. **Playwright record query test passes** ✓
45. **Playwright record CRUD test passes** ✓
46. **Playwright responsive tests pass** ✓
47. **Playwright error handling tests pass** ✓
48. **Bundle analyzer configured and runs** ✓
49. **Recharts lazy loaded (not in main bundle)** ✓
50. **Monaco editor lazy loaded** ✓
51. **DataGrid virtualizes for >100 rows** ✓
52. **Dropdown virtualizes for >50 items** ✓
53. **Lighthouse performance score >90** ✓
54. **Lighthouse accessibility score >95** ✓
55. **60+ CSS custom properties defined** ✓
56. **Dark mode CSS variables override in media query** ✓
57. **High contrast CSS variables override in media query** ✓
58. **Custom CSS from backend injected safely** ✓
59. **All interactive elements have data-qqq-id** ✓
60. **Session timeout warning shows 5 min before expiry** ✓
61. **Re-auth modal non-disruptive (overlay, not redirect)** ✓
62. **Form data preserved across re-auth** ✓
63. **Scroll position preserved across re-auth** ✓
64. **Filter state preserved across re-auth** ✓

---

## 10. Deployment & Rollout

### 10.1 Pre-Deployment Checklist

- [ ] All 64+ acceptance criteria pass
- [ ] CI/CD pipeline green (tests, linting, build)
- [ ] Bundle analysis review completed
- [ ] Lighthouse scores meet thresholds
- [ ] axe-core audit zero critical violations
- [ ] Storybook reviewed by design team
- [ ] E2E tests pass in staging environment
- [ ] Performance baseline established
- [ ] Documentation updated (README, CHANGELOG)
- [ ] Release notes prepared

### 10.2 Deployment Strategy

**Stage 1: Canary Deployment (10% traffic)**
- Monitor error rates, Lighthouse scores, user feedback
- 24-hour observation period

**Stage 2: Phased Rollout (50% traffic)**
- Expand to 50% of users
- 48-hour observation period
- Monitor performance metrics

**Stage 3: Full Deployment (100% traffic)**
- Complete rollout to all users
- Ongoing monitoring for 1 week

### 10.3 Rollback Plan

If critical issues found:
1. Revert to previous stable version
2. Create incident ticket with details
3. Root cause analysis and fix
4. Re-test in staging
5. Redeploy with canary strategy

---

## 11. Success Metrics

| Metric | Target | Threshold |
|--------|--------|-----------|
| Lighthouse Performance | >90 | Green |
| Lighthouse Accessibility | >95 | Green |
| axe-core violations (critical) | 0 | Critical |
| E2E test pass rate | 100% | Critical |
| Bundle size (main JS) | <200KB gzipped | Warning >210KB |
| Mobile usability score | >95 | Warning <90 |
| Session timeout correctness | 100% | Critical |
| Keyboard shortcut coverage | 100% interactive elements | Critical |

---

## 12. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Accessibility audit finds many violations | Medium | High | Early axe-core integration, weekly audits |
| Performance regression on mobile | Medium | High | Early Lighthouse CI setup, mobile-first dev |
| Session timeout breaks user workflows | Low | High | Thorough testing, preserve state carefully |
| Keyboard navigation conflicts | Low | Medium | Comprehensive shortcut mapping, test all pages |
| Command palette search too slow | Low | Medium | Debounce search, cache metadata, virtualize results |
| Custom CSS injection XSS vulnerability | Low | Critical | CSP headers, sanitize CSS, no innerHTML |

---

## 13. Timeline & Dependencies

```
Package 6 depends on: Packages 1, 2, 3, 4, 5 (all complete)

Parallel tracks (can run simultaneously):
- Track A: Responsive design (Steps 1–6) — 2 weeks
- Track B: Accessibility (Steps 7–13) — 2 weeks
- Track C: Features (Steps 14–19) — 2.5 weeks
- Track D: Testing & Quality (Steps 20–25) — 3 weeks
- Track E: Theme & Polish (Steps 26–29) — 1 week

Critical path: 6 weeks (Track D is longest)
```

---

## 14. Handoff & Documentation

### 14.1 Deliverables

1. **Codebase:** All 29 implementation steps complete
2. **Test Coverage:** >80% unit + integration, comprehensive E2E
3. **Storybook:** Complete component library with 200+ stories
4. **Accessibility Audit:** axe-core report, WCAG 2.1 AA verified
5. **Performance Report:** Lighthouse CI results, bundle analysis
6. **Documentation:**
   - Implementation runbook
   - Component API documentation
   - Keyboard shortcuts reference
   - Troubleshooting guide
   - Performance tuning guide

### 14.2 Maintenance Handoff

- **Support team:** Trained on new UI, troubleshooting, user-facing changes
- **Ops team:** Lighthouse CI monitoring, performance alerting
- **Frontend team:** Architecture documentation, extension points for future features
- **QA team:** E2E test suite, regression testing process

---

## End of Work Package 6

**Total Implementation Steps:** 29
**Total Files Created/Modified:** 100+
**Total Lines of Code:** ~15,000+
**Estimated Effort:** 6 weeks, 3–4 engineers
**Test Coverage Target:** >80%
**Acceptance Criteria:** 64 binary pass/fail
