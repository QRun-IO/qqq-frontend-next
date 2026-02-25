# Agent Prompt: Package 6 — Polish, Parity, and Production Readiness

## Your Role

You are an implementation agent. Execute Work Package 6 — the final package. ALL previous packages (1-5) are complete. Your job is polish, parity, and production readiness.

## Before Writing Any Code, Read These Files

1. **Your plan:** `docs/implementation-plans/06-polish-and-parity.md`
2. **Coding conventions:** `docs/implementation-plans/shared-context/coding-conventions.md`
3. **CLAUDE.md**
4. **Requirements doc Section 5.4 (responsive), 5.6 (performance), 5.7 (DX):** `docs/qqq-admin-modernization-requirements.md`

## Reference Code

From `qqq-frontend-material-dashboard`:
- `src/qqq/components/misc/CommandMenu.tsx` — Command palette (Cmd+K)
- `src/qqq/components/audits/AuditBody.tsx` — Audit trail display
- `src/qqq/pages/records/developer/RecordDeveloperView.tsx` — Developer tools
- `src/qqq/pages/records/developer/TableDeveloperView.tsx` — Table dev view
- `src/qqq/components/scripts/ScriptViewer.tsx` — Code editor

## What You Must Build

### Responsive Design Audit & Fixes
- Mobile card view for Record Query (< 768px)
- Off-canvas sidebar drawer on mobile with hamburger trigger
- Bottom sheet filter panel on mobile
- 44px minimum tap targets everywhere
- Sticky headers and bottom-anchored action buttons on mobile
- Breadcrumb truncation on mobile
- Responsive widget grid (1/2/N columns)

### Accessibility (WCAG 2.1 AA)
- axe-core integration in test suite
- Focus management in modals (trap + restore)
- aria-live regions for toasts and loading states
- Color contrast audit (4.5:1 / 3:1)
- Skip-to-content link
- Keyboard navigation for all interactive elements

### Command Palette
- Cmd+K / Ctrl+K trigger
- Search tables, processes, reports from metadata
- Recently accessed items
- Keyboard navigation (arrow keys, Enter)

### Keyboard Shortcuts
- Global: Cmd+K, ?, Escape
- Record Query: n, /, f
- Record View: n, e, c, d, a
- Shortcuts reference panel

### Audit Trail
- Audit log panel on Record View
- Timeline with field-level changes
- Filter by date/user/field

### Developer Tools
- Table dev view: metadata inspector
- Record dev view: raw values, scripts, logs
- Script editor (CodeMirror or Monaco)
- Script test execution

### Report Pages
- Reuse ProcessRun from Package 4

### Storybook
- Setup with all shared components
- Stories for loading/empty/error/populated states
- a11y addon

### Playwright E2E
- Auth flow, query, CRUD, process, widgets
- Responsive viewport tests
- Error handling tests

### Performance
- Bundle analysis (next-bundle-analyzer)
- Lazy loading for charts, code editor, file upload
- TanStack Query cache tuning
- Lighthouse CI integration

### Theme Tokens
- All 60+ CSS custom properties
- Light/dark mode with localStorage persistence
- data-qqq-id verification on ALL elements
- customCss injection support

### Session Timeout UX
- Re-auth modal (not full redirect)
- Preserve form state across re-auth

## Verification

After each step: `pnpm tsc --noEmit`
When done: verify ALL acceptance criteria in the plan.
Final checks:
```bash
pnpm build         # Must succeed
pnpm test          # All tests pass
pnpm lint          # Zero errors
pnpm tsc --noEmit  # Zero errors
```
Commit your work.
