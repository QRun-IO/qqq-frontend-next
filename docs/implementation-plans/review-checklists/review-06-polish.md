# Review Checklist: Package 6 — Polish, Parity, and Production Readiness

### Requirements Coverage
- [ ] Section 5.4: Responsive design at all 3 breakpoints for all pages
- [ ] Section 5.1.4: WCAG 2.1 AA accessibility compliance
- [ ] Section 5.6.1: Performance targets (FCP <1.5s, TTI <3s, LCP <2.5s)
- [ ] Section 5.6.2: Caching strategy implemented per endpoint
- [ ] Section 5.6.3: Code splitting, lazy loading, virtual scrolling
- [ ] Section 5.7.1: Storybook with all component stories
- [ ] Section 5.7.2: Playwright E2E test suite for critical flows
- [ ] Section 5.7.3: Build pipeline with lint/format enforcement
- [ ] Section 5.7.4: Strict TypeScript, no `any` in props
- [ ] Section 5.5.3: Session timeout UX with state preservation
- [ ] Section 5.1.5: Theme tokens (60+ CSS custom properties)
- [ ] Section 5.1.5: customCss injection via data-qqq-id selectors
- [ ] Command palette (Cmd+K) implemented
- [ ] Keyboard shortcuts for all pages
- [ ] Audit trail on Record View
- [ ] Developer tools pages (table dev, record dev, script editor)
- [ ] Report execution pages

### Integration Check
- [ ] All Package 1-5 components work together end-to-end
- [ ] Command palette searches across all metadata (tables, processes, reports)
- [ ] Keyboard shortcuts don't conflict across pages
- [ ] Developer view routes render within dashboard layout
- [ ] Report pages reuse ProcessRun from Package 4
- [ ] Theme changes propagate to all components

### API Contract Compliance
- [ ] Developer endpoints: GET /data/{t}/{id}/developer
- [ ] Script endpoints: POST .../associatedScript/{f}, GET .../logs, POST .../test
- [ ] Audit endpoints integrated (if available)
- [ ] All API calls use correct v1 paths

### Metadata-Driven Check
- [ ] Command palette items from metadata (not hardcoded)
- [ ] Developer view shows metadata structure dynamically
- [ ] Theme tokens from QThemeMetaData
- [ ] customCss loaded from backend and injected

### Responsive Check
- [ ] Mobile card view for Record Query verified functional
- [ ] All forms single-column on mobile
- [ ] Off-canvas sidebar drawer on mobile
- [ ] Command palette fullscreen on mobile
- [ ] Touch targets ≥ 44px verified across all pages
- [ ] No horizontal overflow at any breakpoint

### Accessibility Check
- [ ] axe-core CI integration with zero violations
- [ ] Skip-to-content link present
- [ ] Focus trap in all modals/dialogs
- [ ] aria-live regions for toasts and loading states
- [ ] Color contrast ≥ 4.5:1 (normal) and ≥ 3:1 (large)
- [ ] All keyboard shortcuts have visible reference
- [ ] Screen reader tested for critical flows

### Type Safety Check
- [ ] Zero TypeScript errors in `pnpm tsc --noEmit`
- [ ] No `any` types in any component props across all packages
- [ ] All API responses validated at boundary (Zod or equivalent)
- [ ] All event handlers properly typed
- [ ] Exhaustive switch statements for all enum types
