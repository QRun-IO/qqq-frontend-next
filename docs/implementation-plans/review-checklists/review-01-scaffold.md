# Review Checklist: Package 1 — Scaffold, Auth, and Layout Shell

### Requirements Coverage
- [ ] Section 3.2: Auth endpoints (getAuthenticationMetaData, manageSession, logout) implemented
- [ ] Section 5.1: Metadata-driven rendering foundation established
- [ ] Section 5.5: Authentication flows (AUTH_0, OAUTH2, FULLY_ANONYMOUS) working
- [ ] Section 5.3.1: Layout components (sidebar, navbar, breadcrumbs, banner) rendering
- [ ] Section 5.5.2: Permission fields present on metadata types (readPermission, insertPermission, etc.)

### Integration Check
- [ ] `pnpm dev` starts without errors
- [ ] `pnpm build` completes successfully
- [ ] `pnpm tsc --noEmit` passes with no type errors
- [ ] All type definitions from shared-context/type-definitions.md present in /src/types/
- [ ] API client base URL configurable via NEXT_PUBLIC_API_BASE_URL
- [ ] TanStack Query provider wraps the app
- [ ] Auth provider wraps the app
- [ ] Theme provider wraps the app

### API Contract Compliance
- [ ] GET /qqq/v1/metaData/authentication — correct path, no auth required
- [ ] POST /qqq/v1/manageSession — multipart/form-data, accessToken field
- [ ] POST /qqq/v1/logout — session cookie sent
- [ ] GET /qqq/v1/metaData — correct path, returns QInstance shape
- [ ] GET /qqq/v1/metaData/table/{tableName} — returns QTableMetaData
- [ ] GET /qqq/v1/metaData/process/{processName} — returns QProcessMetaData
- [ ] 401 responses trigger unauthorized callback

### Metadata-Driven Check
- [ ] Sidebar navigation built from appTree metadata (no hardcoded nav items)
- [ ] Routes generated dynamically from app tree traversal
- [ ] Breadcrumbs use pathToLabelMap from metadata
- [ ] Branding (logo, appName, accentColor) from QBrandingMetaData
- [ ] Banners from branding.banners metadata

### Responsive Check
- [ ] Sidebar collapses to mini-mode on tablet
- [ ] Sidebar becomes off-canvas drawer on mobile (to be finalized in Package 6)
- [ ] Header adapts to screen width
- [ ] Layout doesn't overflow horizontally at any breakpoint

### Accessibility Check
- [ ] Sidebar has role="navigation"
- [ ] All buttons have aria-label or text content
- [ ] Breadcrumbs have aria-current="page" on last item
- [ ] Banner has role="alert"
- [ ] Focus visible on all interactive elements
- [ ] Tab order is logical through sidebar → header → content

### Type Safety Check
- [ ] No `any` types in component props (except values: Record<string, any> from API)
- [ ] All API functions have typed return values
- [ ] QueryClient configured with proper generic types
- [ ] Auth context type is fully defined (no partial types)
