# Material Dashboard parity (QRun-IO/qqq#714)

This is the full inventory of what the Material Dashboard can do and where each ability stands in Next. The audit covered Material `origin/develop` at `8ec1be7a`: every route, page, component, widget, block, process component, supplemental metadata class and theme property. It compared them with Next on branch `feature/next-1.0-parity`.

Each row gives the Material source (`material:` is the Material repo root; `qqq:` is the backend repo root), the Next implementation (paths relative to this repo), the acceptance rows in `tests/acceptance/matrix/*.json` that cover it, and a status. Every Partial or Missing row names the issue that tracks it. A row that came up in more than one area is listed once, in the most specific area.

## Status legend

- **Done**: works in Next, possibly with a different layout.
- **Done (different UX)**: the same outcome through a deliberately different interaction.
- **Partial**: some of the ability exists; the status note says what is missing.
- **Missing**: no equivalent in Next.
- **N/A**: dead code, template internals, not user-visible, or unreachable in Material.

## Summary

| Area | Done | Done (different UX) | Partial | Missing | N/A | Total |
|---|---|---|---|---|---|---|
| Shell and navigation | 69 | 2 | 11 | 22 | 7 | 111 |
| Query | 66 | 0 | 30 | 32 | 3 | 131 |
| Records | 84 | 1 | 16 | 29 | 8 | 138 |
| Processes and reports | 93 | 2 | 21 | 10 | 2 | 128 |
| Widgets and blocks | 126 | 0 | 36 | 70 | 4 | 236 |
| Supplemental metadata and theme | 1 | 0 | 5 | 36 | 9 | 51 |
| **Total** | **439** | **5** | **119** | **199** | **33** | **795** |
| Windows, menus, dialogs, popovers, drawers and modals (cross-cutting view, not in the total) | 47 | 5 | 27 | 36 | 12 | 127 |

The overlay section repeats abilities from the area sections from the point of view of each window, menu or dialog, so its rows are not added to the total or to the issue counts.

## Fixed by the parity stream

These gaps were closed on `feature/next-1.0-parity` during the audit. The area tables below show them with their new status and rows.

- Page keyboard shortcuts: query `n`/`r`/`f`, record `n`/`e`/`c`/`d`/`a`, suppressed in text entry and open overlays (QRY-065, REC-055).
- Record-view hash links `#audit`, `#/launchProcess=`, `#/createChild=`, section anchors, and the create page's `#/defaultValues=` / `#/disabledFields=` presets (REC-050, REC-051).
- Material table-scoped URLs `/app/{table}/{process}` and `/app/{table}/{id}/{process}` resolve, and process runs return to the launching record or query (NAV-034, NAV-035). Material ran these processes as a modal over the screen; Next runs them as a full page that returns to the caller, so those rows are Done (different UX). The table-scoped report URL `/app/{table}/{report}` stays Partial: the backend report metadata (QFrontendReportMetaData) has no tableName, so no report can match (#732).
- The child record list "Add new" opens a create dialog over the parent with the join fields preset and locked (RPT-012).
- The table variant is sent on process init, every process step and record requests (QRY-066).
- Material app-home settings `showAppLabelOnHomeScreen` and `includeTableCountsOnHomeScreen` (NAV-036).
- Single leaf-block widget payloads render (WID-066).
- Go To record dialog from `gotoFieldNames` on the query toolbar and the record view header, auto-opened and not closable for tables that can be read but not queried (QRY-067).
- Processes the instance adds to every query and record screen (`processNamesToAddToAllQueryAndViewScreens`, PRC-048).
- Dependent possible-value filters: the other form values are sent with possible-value searches on record forms (REC-052) and process screens (PRC-049).
- Table developer view API docs and playground with API and version selectors (REC-053). The sample application has no qqq-middleware-api, so acceptance covers the no-API state (#738).
- Record developer view associated scripts: code, versions, edit and save a new version, test run, logs, docs and script creation (REC-054).
- A process run with no records no longer fails its validation review when the backend omits the empty records list (PRC-003).

Every cited row exists in `tests/acceptance/matrix/*.json`.

## Shell and navigation

This area covers routing, auth and session handling, context and extension points, analytics, the command palette, header recents, sidebar, banners and branding, breadcrumbs, error boundaries and the app home. Page keyboard shortcuts are listed under Query and Records, process-over-screen routes under Processes, theme metadata and CSS/test hooks in the theme area, and field, section, process and widget help rows in their own areas.

### Routing

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| App home route for each APP node | material:src/App.tsx:275-280 | src/app/(dashboard)/app/[slug]/page.tsx (isApp→AppHome) | NAV-008, NAV-010, NAV-018 | Done: flat `/app/{app}` instead of the nested path |
| Table query route | material:src/App.tsx:294-302 | src/app/(dashboard)/app/[slug]/page.tsx (isTable→RecordQuery) | NAV-001, NAV-018, QRY-001 | Done: flat URL |
| Saved-view route `{table}/savedView/:id` | material:src/App.tsx:304-309 | src/app/(dashboard)/app/[slug]/savedView/[viewId]/page.tsx | QRY-050, NAV-018 | Done |
| Create route `{table}/create` | material:src/App.tsx:311-316 | src/app/(dashboard)/app/[slug]/create/page.tsx | REC-005, REC-006, NAV-018 | Done |
| Record view `{table}/:id` | material:src/App.tsx:335-340 | src/app/(dashboard)/app/[slug]/[recordId]/page.tsx | REC-001, NAV-018 | Done |
| Edit `{table}/:id/edit` | material:src/App.tsx:349-354 | src/app/(dashboard)/app/[slug]/[recordId]/edit/page.tsx | REC-009, NAV-018 | Done |
| Copy `{table}/:id/copy` | material:src/App.tsx:356-361 | src/app/(dashboard)/app/[slug]/[recordId]/copy/page.tsx | REC-013, SEC-006 | Done |
| Lookup by unique key `{table}/key?f=v` | material:src/App.tsx:342-347 | src/app/(dashboard)/app/[slug]/key/page.tsx | NAV-023 | Done |
| App-tree PROCESS route | material:src/App.tsx:457-466 | src/app/(dashboard)/app/[slug]/page.tsx (isProcess→ProcessRun) | PRC-004, NAV-018 | Done |
| App-tree REPORT route | material:src/App.tsx:467-476 | src/app/(dashboard)/app/[slug]/page.tsx (isReport→ReportRun) | RPT-008, NAV-028 | Done |
| No-apps route and page | material:src/App.tsx:547-558; material:src/qqq/pages/apps/NoApps.tsx:36-41 | src/app/(dashboard)/app/page.tsx:315; src/lib/hooks/use-routes.ts:199 | NAV-029 | Done |
| Default landing is the first permitted app | material:src/App.tsx:282-292,856 | src/app/page.tsx → `/app` dashboard | NAV-016, NAV-017 | Done (different UX): synthetic dashboard, by design |
| Unknown path redirects to the default route | material:src/App.tsx:856 | src/app/not-found.tsx; src/components/layout/NotFoundState.tsx | NAV-021, NAV-022 | Done (different UX): not-found page instead of a silent redirect |
| Backend `metaData.redirects` (from/to, wildcard, replace) | material:src/App.tsx:603-613,801-806,857 | none | none | Missing: instance redirect rules ignored; #732 |
| Legacy nested Material URLs (bookmarks, backend-built links) | material:src/App.tsx:264 | src/lib/utils/material-links.ts; src/app/(dashboard)/app/[slug]/[recordId]/[action]/page.tsx; src/components/widgets/ChildRecordListWidget.tsx:115 | NAV-022, NAV-034, NAV-035 | Partial: table-scoped Material URLs now resolve (NAV-034, NAV-035); other legacy nested app-path URLs still 404; #732 |
| Hosting under a base path (`<base>`/script detection, router basename, `resolveAssetUrl`) | material:src/qqq/utils/PathUtils.ts:131-156; material:src/index.tsx:104; material:src/App.tsx:490,846-847 | none (next.config.ts has no basePath; branding URLs used raw) | none | Missing: sub-path deploys break; unverified whether they are a required target; #732 |
| Scroll to top on route change | material:src/App.tsx:647-651 | none found (no scrollTop reset in src/app or src/components/layout) | none | Missing: unverified; content scrolls in `#main-content` with no reset found; #732 |

### Auth, session, 401

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Auth module chosen by `QAuthenticationMetaData.type` | material:src/index.tsx:55,101-124; material:src/App.tsx:105-134 | src/lib/auth/auth-provider.tsx:establishSession | SEC-020, SEC-025, SEC-029, SEC-031 | Done |
| Unknown auth type reported | material:src/index.tsx:125-130 | src/lib/auth/auth-provider.tsx:232 → login error | SEC-032 | Done |
| Auth metadata localStorage cache; `?clearAuthenticationMetaDataLocalStorage` | material:src/index.tsx:49-52 | src/lib/api/auth.ts:getAuthenticationMetaData (10-minute TTL) | none | Partial: no URL flag to force-clear; #732 |
| MOCK / FULLY_ANONYMOUS session | material:src/qqq/authorization/anonymous/useAnonymousAuthenticationModule.tsx:47-69 | src/lib/auth/auth-provider.tsx:217-218; src/lib/auth/auth-storage.ts | SEC-020, SEC-031 | Done |
| Full `sessionValues` persisted | material:src/qqq/authorization/anonymous/useAnonymousAuthenticationModule.tsx:57; material:src/qqq/authorization/oauth2/useOAuth2AuthenticationModule.tsx:189,269; material:src/qqq/authorization/auth0/useAuth0AuthenticationModule.tsx:147-199 | src/lib/auth/auth-storage.ts:storeUser (name and email only) | none | Partial: other session values dropped (needed for analytics identity); #730 |
| OAUTH2 authorization code + PKCE, `/token` callback | material:src/qqq/authorization/oauth2/useOAuth2AuthenticationModule.tsx:147-221,475 | src/lib/auth/oidc.ts; src/app/(auth)/token/page.tsx; src/lib/auth/auth-provider.tsx:handleOAuthCallback | SEC-025 | Done |
| OAUTH2 resumes an existing sessionUUID cookie | material:src/qqq/authorization/oauth2/useOAuth2AuthenticationModule.tsx:256-285 | src/lib/auth/auth-provider.tsx:220-230 | SEC-025 | Done |
| Return to the pre-sign-in page | material:src/qqq/authorization/oauth2/useOAuth2AuthenticationModule.tsx:209-220,297-306 | src/lib/auth/oidc.ts:196; src/lib/auth/return-to.ts:safeReturnTo | SEC-022, SEC-024 | Done: Next adds an open-redirect guard |
| OAUTH2 authority = `externalBaseUrl` or `baseUrl` | material:src/qqq/authorization/oauth2/useOAuth2AuthenticationModule.tsx:435 | src/lib/auth/oidc.ts:requireValues (baseUrl only) | none | Missing: split internal/external IdP deployments break; #732 |
| OAUTH2 scopes from metadata | material:src/qqq/authorization/oauth2/useOAuth2AuthenticationModule.tsx:470 | src/lib/auth/oidc.ts:36,175 | SEC-025 | Done: unverified whether SEC-025 asserts scopes |
| OAUTH2 missing or unknown state recovery | material:src/qqq/authorization/oauth2/useOAuth2AuthenticationModule.tsx:228-245 | src/app/(auth)/callback/CallbackContent.tsx | SEC-026 | Done: always errors, even with a valid cookie (minor) |
| OAUTH2/Auth0 misconfiguration error | material:src/qqq/authorization/oauth2/useOAuth2AuthenticationModule.tsx:445-448; material:src/qqq/authorization/auth0/useAuth0AuthenticationModule.tsx:266 | src/lib/auth/oidc.ts:125-126 | none | Done: no acceptance row |
| OAUTH2 logout (backend logout, cookies, `oidc.*` keys, end-session) | material:src/qqq/authorization/oauth2/useOAuth2AuthenticationModule.tsx:353-405 | src/lib/auth/auth-provider.tsx:handleLogout; src/lib/auth/oidc.ts:buildEndSessionUrl | SEC-027, SEC-033 | Done |
| AUTH_0 sign-in | material:src/qqq/authorization/auth0/useAuth0AuthenticationModule.tsx:147-199,261,291 | src/lib/auth/oidc.ts:exchangeAuth0Code | SEC-029, SEC-030 | Partial: redirect URI moved from `{origin}/` to `{origin}/token`; Auth0 app registrations need updating; #732 |
| AUTH_0 token cache and JWT-claims comparison | material:src/qqq/authorization/auth0/useAuth0AuthenticationModule.tsx:56-100 | Cookie resume instead | none | N/A: different mechanism, same visible result |
| AUTH_0 `?error=` shows `error_description`, then logout | material:src/qqq/authorization/auth0/useAuth0AuthenticationModule.tsx:228-235; material:src/HandleAuthorizationError.tsx:33-48 | src/app/(auth)/callback/CallbackContent.tsx; src/app/(auth)/login/page.tsx:CALLBACK_ERRORS | SEC-029, SEC-026 | Partial: provider text only logged to the console; user sees a generic message; #732 |
| AUTH_0 ProtectedRoute and Loader | material:src/qqq/authorization/auth0/ProtectedRoute.tsx; material:src/qqq/authorization/auth0/Loader.tsx | src/app/(dashboard)/layout.tsx; src/app/(auth)/login/page.tsx | SEC-029 | Done |
| AUTH_0 logout | material:src/qqq/authorization/auth0/useAuth0AuthenticationModule.tsx:206-211 | src/lib/auth/auth-provider.tsx:handleLogout | SEC-029, SEC-033 | Done |
| Auth0 Profile and CodeSnippet components | material:src/qqq/authorization/auth0/Profile.tsx; material:src/qqq/authorization/auth0/CodeSnippet.tsx | none | none | N/A: dead code |
| Global 401 handling | material:src/qqq/utils/qqq/Client.ts:handleException; material:src/App.tsx:100 | src/lib/api/client.ts (interceptor); src/lib/auth/auth-provider.tsx:250-261 | SEC-022, SEC-028, PRC-041 | Done: re-authenticates and returns to the page (Material logged out); loop guard |
| 401 while loading metadata | material:src/App.tsx:580-596 | src/lib/api/client.ts; src/lib/auth/auth-provider.tsx:250-260 | SEC-022 | Done |
| Logout clears per-user client data | material:src/App.tsx:149-169 | src/lib/auth/auth-storage.ts:clearUserClientData | SEC-021 | Done: analytics reset is covered in the Analytics rows |
| User entry: name, Gravatar (`gravatarDefault`), or "Anonymous" | material:src/App.tsx:514-530 | src/components/layout/Sidebar.tsx:UserFooter (initial letter) | SEC-020, SEC-031 | Partial: no Gravatar or gravatarDefault (the backend field exists); no "Anonymous" label; #732 |
| Log Out button | material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:384 | src/components/layout/Sidebar.tsx:UserFooter (menu-item-logout) | SEC-021, SEC-027 | Done: two clicks |
| MUI X license key | material:src/App.tsx:136-144 | none | none | N/A: MUI-specific |

### Context and extensibility

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| pageHeader / setPageHeader | material:src/QContext.tsx:30-31 | src/lib/context/q-context.tsx | NAV-015 | Done |
| pageHeaderRightContent | material:src/QContext.tsx:32-33; material:src/qqq/components/horseshoe/NavBar.tsx:276 | none | none | N/A: setter never called in Material |
| dotMenuOpen, keyboardHelpOpen, modalStack | material:src/QContext.tsx:41-50; material:src/App.tsx:761-793 | src/lib/context/q-context.tsx | NAV-024, INT-004 | Done |
| tableMetaData / tableProcesses in context | material:src/QContext.tsx:52-56 | src/lib/context/q-context.tsx | none | Done: unused by the palette (see the palette Actions rows) |
| pathToLabelMap for breadcrumbs | material:src/App.tsx:560-566 | src/lib/hooks/use-routes.ts:buildRouteMap | NAV-014 | Done |
| `?helpHelp` mode shows help-slot keys | material:src/App.tsx:705; material:src/qqq/components/misc/HelpContent.tsx:133-141; material:src/qqq/utils/qqq/QFMDBridge.tsx:80-92 | src/lib/context/q-context.tsx:230 (hard-coded false) | none | Missing: flag does nothing; #732 |
| `window.React` / `window.ReactDOM` globals | material:src/index.tsx:44-45 | none | WID-025 | Missing: Material-built bundles that use the globals fail; unverified whether the WID-025 bundle needs them; #728 |
| Dynamic custom-component loader | material:src/qqq/utils/qqq/useDynamicComponents.tsx | src/components/widgets/QqqContainerWidgets.tsx:loadBundle | WID-025, WID-062 | Done |
| QFMD bridge (makeAlert/Button/Form/Modal/Widget) and live qContext | material:src/qqq/utils/qqq/QFMDBridge.tsx:53-60,402-434 | src/components/widgets/QqqContainerWidgets.tsx:274 (empty objects) | none | Missing: bridge-using components break; #728 |
| DeveloperModeUtils.revToColor | material:src/qqq/utils/DeveloperModeUtils.tsx | none | none | N/A: cosmetic |

### Analytics

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Analytics set up after auth; providers from `environmentValues.ANALYTICS_PROVIDERS` | material:src/App.tsx:714-720; material:src/qqq/utils/analytics/AnalyticsUtils.ts:32,159-160 | none | none | Missing: no analytics at all; #730 |
| Google Analytics 4 | material:src/qqq/utils/analytics/GoogleAnalyticsProvider.ts:42,74,79 | none | none | Missing: no GA4 provider; #730 |
| PostHog (key, host, identify, reset) | material:src/qqq/utils/analytics/PostHogAnalyticsProvider.ts:83,139,230 | none | none | Missing: no PostHog provider; #730 |
| `window.QQQAnalytics` plugin registry and plugin scripts | material:src/qqq/utils/analytics/AnalyticsPluginRegistry.ts:105; material:src/qqq/utils/analytics/AnalyticsUtils.ts:104 | none | none | Missing: integrator extension point gone; #730 |
| Page views (App/Query/View/New/Edit/Copy/Process/Developer Mode) | material:src/qqq/pages/apps/Home.tsx:93; material:src/qqq/pages/records/query/RecordQuery.tsx:2752; material:src/qqq/pages/records/view/RecordView.tsx:596; material:src/qqq/components/forms/EntityForm.tsx:938; material:src/qqq/pages/processes/ProcessRun.tsx:1876; material:src/qqq/pages/records/view/RecordDeveloperView.tsx:90 | none | none | Missing: no page-view events; #730 |
| About 15 events (app, table, process, `dotMenuKeyboardShortcut`) | material:src/qqq/pages/apps/Home.tsx:94; material:src/qqq/pages/records/query/RecordQuery.tsx:1066,1879,1896; material:src/qqq/pages/records/view/RecordView.tsx:660,843; material:src/qqq/components/forms/EntityForm.tsx:954,994,1387,1431; material:src/qqq/components/query/ExportMenuItem.tsx:54; material:src/qqq/pages/processes/ProcessRun.tsx:1877,1955,1975; material:src/CommandMenu.tsx:90 | none | none | Missing: no analytics events; #730 |
| recordAnalytics in context; reset on logout | material:src/QContext.tsx:61; material:src/App.tsx:725-728,149-169 | none | none | Missing: no recordAnalytics and no logout reset; #730 |

### Command palette and keyboard shortcuts

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| `.` opens the palette (ignored in inputs) | material:src/CommandMenu.tsx:79-92 | src/app/(dashboard)/layout.tsx:handleGlobalKeyDown | NAV-024, INT-004 | Done: Next adds Cmd/Ctrl+K and `/` |
| `?` opens the keyboard-shortcuts dialog | material:src/CommandMenu.tsx:93-97,476-509 | src/components/feedback/KeyboardShortcutsDialog.tsx | INT-004 | Done: Next also has a header button |
| Help dialog lists Global, Table Query and Record View keys | material:src/CommandMenu.tsx:482-502 | src/components/feedback/KeyboardShortcutsDialog.tsx:shortcutSections | INT-004 | Done: text aligned to Material |
| Palette "{Table} Actions": New, Copy, Edit, Audit (gated; hidden on edit/create/copy/audit) | material:src/CommandMenu.tsx:217-251 | none (src/components/feedback/CommandMenu.tsx has only a Navigation group) | none | Missing: palette ignores the current table; #729 |
| Palette Actions: the current table's processes | material:src/CommandMenu.tsx:252-257 | none | none | Missing: no current-table processes in the palette; #729 |
| Palette Tables group | material:src/CommandMenu.tsx:268-294 | src/components/feedback/CommandMenu.tsx (navTargets) | NAV-024, NAV-006 | Done: one group with type labels; adds processes and reports |
| Palette Apps group with full path | material:src/CommandMenu.tsx:146-169,300-328 | src/components/feedback/CommandMenu.tsx:193-213 | NAV-024 | Done |
| Palette "Recently Viewed Records" group | material:src/CommandMenu.tsx:334-367 | Not in the palette (src/components/feedback/SearchDialog.tsx and src/components/layout/GlobalSearch.tsx have recents) | NAV-025 | Partial: the `.`/Cmd+K palette has no recents (NAV-025 covers search, not the palette); #729 |
| Palette filter: per-word substring, starts-with first ranking | material:src/CommandMenu.tsx:177-211,394-451 | cmdk default scorer | NAV-024 | Partial: match and ranking differ; optional; #729 |
| Palette chrome (placeholder, close, "No results found.") | material:src/CommandMenu.tsx:458-466 | src/components/feedback/CommandMenu.tsx:150-182 | NAV-024 | Done: adds focus trap and restore |
| Selecting navigates and closes | material:src/CommandMenu.tsx:126-135 | src/components/feedback/CommandMenu.tsx:handleSelect | NAV-024 | Done: pushes history instead of replace |
| Navbar search icon opens the palette | material:src/qqq/components/horseshoe/NavBar.tsx:262-266 | src/components/layout/Header.tsx:96,102 (search, not the palette) | NAV-025 | Partial: no pointer control opens the palette itself; #729 |

### Header and recently viewed

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Navbar "Recently Viewed Records" dropdown | material:src/qqq/components/horseshoe/NavBar.tsx:117-188 | src/components/layout/GlobalSearch.tsx; src/components/layout/NavigationSearchResults.tsx | NAV-025 | Done: clock glyph instead of the table icon; table icons tracked on #729 |
| History store (`qqq.history`, cap 20, dedupe) | material:src/qqq/utils/HistoryUtils.tsx:38-69; material:src/qqq/pages/records/view/RecordView.tsx:699 | src/lib/utils/recent-records.ts (`qqq-recent-records`, cap 20) | NAV-025 | Done: different key, no migration |
| Remove a 404'd path from history | material:src/qqq/utils/HistoryUtils.tsx:92-105; material:src/qqq/pages/records/view/RecordView.tsx:668 | none | none | Missing: deleted or denied records stay in recents; #729 |
| Navbar right half hidden below md | material:src/qqq/components/horseshoe/NavBar.tsx:232-240 | src/components/layout/Header.tsx:102 (`hidden md:block`) | NAV-026 | Done: plus a mobile search button |

### Sidebar

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Permitted apps from appTree (label, order, icons) | material:src/App.tsx:538-575; material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:212-306 | src/lib/hooks/use-routes.ts:buildRouteMap; src/components/layout/Sidebar.tsx | NAV-002, NAV-005 | Done: Next also lists leaves |
| Nested apps (Material caps at depth 2) | material:src/App.tsx:196-258 | src/lib/hooks/use-routes.ts:visit (unlimited) | NAV-003 | Done: more than Material |
| `hideChildrenFromNavigation` | material:src/App.tsx:210 | none | none | Missing: children still shown; #732 |
| Expand/collapse groups; the current route's group opens | material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:110-114,166-188,256-269 | src/components/layout/Sidebar.tsx:activeGroupPaths, toggleCollapse | NAV-003, NAV-004 | Done: several groups open vs accordion |
| Active-entry highlighting | material:src/qqq/components/horseshoe/sidenav/SideNavCollapse.tsx:64; material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:178,200-204,232 | src/components/layout/Sidebar.tsx (aria-current) | NAV-004 | Done |
| Logo or appName, click goes home | material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:353-368 | src/components/layout/Sidebar.tsx:SidebarBranding | NAV-012 | Done: links to `/app` |
| Mini sidebar rail (96px, icon, hover-to-expand) | material:src/qqq/components/horseshoe/sidenav/SideNavRoot.tsx:79-91; material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:119-136,358-361; material:src/App.tsx:618-636 | none | none | N/A: unreachable in Material (below 1200px mini means the drawer; at 1200px and up it is forced off) |
| Responsive off-canvas drawer | material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:116-140,340-352; material:src/qqq/components/horseshoe/NavBar.tsx:110,252; material:src/qqq/components/horseshoe/Styles.ts:179-186 | src/components/layout/Sidebar.tsx (drawer; :202 closes on route change); src/components/layout/Header.tsx:82 | NAV-026, INT-008 | Done: breakpoint 768px vs 1200px |

### Banners and branding

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| QFMD_TOP_OF_SITE banner | material:src/App.tsx:743-756 | src/app/(dashboard)/layout.tsx:291 | NAV-013 | Done |
| QFMD_TOP_OF_BODY banner | material:src/qqq/layouts/BaseLayout.tsx:88-100 | src/app/(dashboard)/layout.tsx:350 | NAV-013 | Done: below the header (Material: above the navbar) |
| QFMD_SIDE_NAV_UNDER_LOGO banner | material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:321-327 | src/components/layout/Sidebar.tsx:244 | NAV-013 | Done |
| Banner content (HTML/text, severity, colors, additionalStyles) | material:src/qqq/components/misc/Banners.tsx:39-96 | src/components/layout/Banner.tsx | NAV-013 | Done: sanitized; fixes Material's textColor bug |
| Deprecated `environmentBannerText`/`Color` | material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:311-319 | none | none | N/A: removed from the backend in 4.0 (BREAK-04-13) |
| Favicon and apple-touch-icon from `branding.icon` | material:src/App.tsx:486-495 | src/app/(dashboard)/layout.tsx:134-142 | NAV-012 | Done: no base-path resolution (see the base-path row) |
| accentColor / accentColorLight | material:src/App.tsx:496-503 | src/app/(dashboard)/layout.tsx:106-132 | NAV-012 | Done: unverified whether components use accentColorLight |
| Footer "© year, companyName" linking to companyUrl | material:src/qqq/components/horseshoe/Footer.tsx:76-99; material:src/qqq/layouts/BaseLayout.tsx:109 | none (schema only: src/lib/api/schemas.ts:140) | none | Missing: company footer not rendered; #719 |

### Breadcrumbs, title, page header

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Home-icon crumb | material:src/qqq/components/horseshoe/Breadcrumbs.tsx:146-148 | none | NAV-014 | Partial: no home crumb (NAV-014 does not assert it); #732 |
| App-hierarchy crumbs, linked | material:src/qqq/components/horseshoe/Breadcrumbs.tsx:88-122,149-153 | src/components/layout/Breadcrumbs.tsx:buildBreadcrumbs | NAV-014 | Done |
| savedView crumb trimming | material:src/qqq/components/horseshoe/Breadcrumbs.tsx:95-113 | src/components/layout/Breadcrumbs.tsx:101-103 | none | Done: shows Table > "Saved View" |
| Humanized fallback crumb labels | material:src/qqq/components/horseshoe/Breadcrumbs.tsx:36-57 | src/components/layout/Breadcrumbs.tsx (SEGMENT_LABELS, decodeSegment) | none | Partial: unmapped segments show raw; #732 |
| Document title "Page \| apps \| appName" | material:src/qqq/components/horseshoe/Breadcrumbs.tsx:90,124 | src/components/layout/Breadcrumbs.tsx:buildDocumentTitle; src/lib/hooks/use-document-title.ts | NAV-015 | Done |
| Page header title plus actions | material:src/qqq/components/horseshoe/NavBar.tsx:270-278 | Page-level headers (e.g. src/components/records/RecordViewHeader.tsx) | REC-001 | Done: unverified whether REC-001 asserts the header |

### Error boundaries and help content

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| ErrorBoundary around help content | material:src/qqq/components/misc/HelpContent.tsx:154-156 | src/components/records/HelpContent.tsx (DOMPurify) | none | Done: equivalent |
| Widget-level error isolation | none (Material has none) | src/components/widgets/WidgetErrorBoundary.tsx | WID-051, WID-053 | Done: Next goes further |
| Help formats TEXT / HTML / MARKDOWN | material:src/qqq/components/misc/HelpContent.tsx:44-56 | src/components/records/HelpContent.tsx:47-67 | REC-039, REC-040, WID-044 | Done |
| Help role priority | material:src/qqq/components/misc/HelpContent.tsx:62-88 | src/lib/utils/help-utils.ts:41-48 | REC-039 | Done |
| Instance-level help slots | material:src/qqq/components/query/FilterCriteriaPaster.tsx:359-361 | none | none | Missing: v1 lacks instance helpContent; #732 |
| App home "header" help | material:src/qqq/pages/apps/Home.tsx:230-241,313 | none | none | Missing: v1 AppMetaData lacks helpContent; #732 |

### App home

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| App home widgets in order and sizing | material:src/qqq/pages/apps/Home.tsx:317-320 | src/components/widgets/AppHome.tsx:231-238 | NAV-011, WID-040 | Done |
| App home sections and groups | material:src/qqq/pages/apps/Home.tsx:321-503 | src/components/widgets/AppHome.tsx:241-257 | NAV-008, NAV-005 | Done |
| Disabled cards for denied items | material:src/qqq/pages/apps/Home.tsx:356-370,395-411,478-496 | src/components/widgets/AppHome.tsx:150-160 | SEC-008, SEC-002 | Done |
| Table record counts | material:src/qqq/pages/apps/Home.tsx:130-181,462-467 | src/components/widgets/AppHome.tsx:107-124 | NAV-009 | Done |
| `includeTableCountsOnHomeScreen = false` | material:src/qqq/pages/apps/Home.tsx:81-87,176-187 | src/components/widgets/AppHome.tsx:226 | NAV-036 | Done |
| `showAppLabelOnHomeScreen = false` | material:src/qqq/pages/apps/Home.tsx:84-86,307-314 | src/components/widgets/AppHome.tsx:225 | NAV-036 | Done |
| Section `apps` list | material:src/qqq/pages/apps/Home.tsx:424-450 | none (src/types/metadata.ts:340-353 has no `apps`) | none | Missing: v1 AppSection lacks apps; #732 |
| Child-app cards; empty app home | material:src/qqq/pages/apps/Home.tsx:248-302 | src/components/widgets/AppHome.tsx:260-277 | NAV-010, NAV-003 | Done |

## Query

The record query screen: header and toolbar, Go To, Actions menu, alerts, grid columns and column menu, pagination and selection, basic and advanced filters, operators and value inputs, saved views, and column statistics. Rows 1-4 and 25-27 of the supplemental-metadata draft (gotoFieldNames, variant Go To, defaultQuickFilterFieldNames, queryScreenCopyFullQueryColumnValuesLimit, weekdayCriteriaSettings) are merged in here; process-launch rows live in Processes and analytics in Shell.

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Header "Table / SavedView label" | material:src/qqq/pages/records/query/RecordQuery.tsx:651-658 | src/components/query/SavedViewsMenu.tsx (label on Views button) | QRY-050 | Partial: no "Table / View" title; breadcrumb shows "Saved View"; #717 |
| Header join tooltip listing joined tables | material:src/qqq/pages/records/query/RecordQuery.tsx:660-701 | none | none | Missing: no join-info icon/tooltip; #717 |
| Export menu CSV/XLSX/JSON | material:src/qqq/pages/records/query/RecordQuery.tsx:627-640 | src/components/query/ExportButton.tsx | QRY-040, QRY-041 | Done: in toolbar rather than header icon |
| Export gated by TABLE_EXPORT | material:src/qqq/pages/records/query/RecordQuery.tsx:591-600 | src/components/query/ExportButton.tsx (allowed) | QRY-062 | Done: disabled button with title instead of click alert |
| Export: disabled at 0 rows; visible cols in order; filename; POST export | material:src/qqq/components/query/ExportMenuItem.tsx:51-111 | src/components/query/ExportButton.tsx:runExport; src/lib/api/tables.ts:exportRecords | QRY-040, QRY-041, QRY-042 | Done: in-page blob download; no "Generating file… N records" tab |
| Variant header "<variantTableLabel>: name" + change icon | material:src/qqq/pages/records/query/RecordQuery.tsx:716-726 | src/components/query/RecordQueryToolbar.tsx (variant chip) | QRY-060 | Partial: chip lacks "<variantTableLabel>:" prefix and settings icon; #717 |
| Variant dialog; LS qqq.tableVariant.<t>; required before query | material:src/qqq/components/query/TableVariantDialog.tsx; material:src/qqq/pages/records/query/RecordQuery.tsx:1039,2963 | src/components/query/VariantPicker.tsx; src/components/query/RecordQuery.tsx:readStoredVariant | QRY-060, QRY-061 | Partial: Enter does not select; otherwise equivalent (same LS key); #717 |
| "Go To…" dialog (PK + gotoFieldNames unique keys, Enter, not-found / more-than-1 errors, /key lookup) | material:src/qqq/components/misc/GotoRecordDialog.tsx:63-371; material:src/qqq/pages/records/query/RecordQuery.tsx:3193; material:src/main/java/.../model/metadata/MaterialDashboardTableMetaData.java:58 | src/components/records/GotoRecordDialog.tsx; src/lib/utils/goto-utils.ts (query toolbar and record view header) | QRY-067 | Done |
| No QUERY but GET capability: auto-open non-closable Go To | material:src/qqq/pages/records/query/RecordQuery.tsx:2993-3018 | src/components/query/RecordQuery.tsx; src/components/records/GotoRecordDialog.tsx (mayClose=false) | QRY-067 | Done |
| Variant tables: Go To auto-opens with the variant picker sub-header, not closeable | material:src/qqq/pages/records/query/RecordQuery.tsx:3006-3016 | none (src/components/query/VariantPicker.tsx exists) | QRY-060 | Missing: no Go To plus variant picker combination; #717 |
| Actions menu: bulk items gated; processes sorted by label w/ icons; extra processes; Developer Mode; "No actions" | material:src/qqq/components/query/QueryScreenActionMenu.tsx:73-160 | src/components/query/ProcessLauncherMenu.tsx:buildActionEntries | QRY-034, QRY-035, QRY-062, QRY-063, PRC-048 | Partial: no Developer Mode entry, generic icons; #717 |
| Create New gated by insert capability + permission | material:src/qqq/pages/records/query/RecordQuery.tsx:3210 | src/components/query/RecordQueryToolbar.tsx (button-create) | QRY-035, QRY-062 | Done: labelled "Create" |
| Bulk with no selection / missing-process alerts | material:src/qqq/pages/records/query/RecordQuery.tsx:1697-1753 | src/components/query/ProcessLauncherMenu.tsx:blockedMessage | QRY-031 | Done: missing process hides item |
| Process min/maxInputRecords alerts | material:src/qqq/pages/records/query/RecordQuery.tsx:1759-1780 | src/components/query/ProcessLauncherMenu.tsx; src/components/process/ProcessRun.tsx:inputRecordBoundsMessage | PRC-006 | Done: query-menu path not acceptance-tested |
| Alerts: error, count error, deleted success, state.warning, copy success/info | material:src/qqq/pages/records/query/RecordQuery.tsx:249-265,3226-3274 | src/components/query/RecordQuery.tsx (query-alert); src/components/query/RecordQueryContent.tsx (grid-error) | QRY-007 | Partial: no separate "Cannot count records"; no state.warning; grid error not dismissable; #717 |
| Warnings for removed fields / misconfigured boolean operator | material:src/qqq/pages/records/query/RecordQuery.tsx:2094-2106 | none | none | Missing: no reconcile warnings; #717 |
| Reconcile view w/ metadata (add new cols, drop deleted fields) | material:src/qqq/pages/records/query/RecordQuery.tsx:1970-2092 | src/lib/utils/saved-view-utils.ts:viewToState; src/lib/utils/query-columns.ts:orderColumns | none | Partial: criteria/orderBys on deleted fields not dropped; #717 |
| No read permission message | material:src/qqq/pages/records/query/RecordQuery.tsx:2700-2707 | src/components/query/RecordQuery.tsx (query-no-permission) | SEC-002 | Done |
| Metadata load error | material:src/qqq/pages/records/query/RecordQuery.tsx:2766-2771 | src/app/(dashboard)/app/[slug]/page.tsx | none | Done: no backend detail |
| ErrorBoundary "click here to fix it" (clears LS view + view id) | material:src/qqq/pages/records/query/RecordQuery.tsx:132-180 | src/components/query/RecordQueryContent.tsx (ErrorBoundary) | none | Partial: Try Again only; no state reset; #717 |
| Loading overlay / slow "Loading…" | material:src/qqq/pages/records/query/RecordQuery.tsx:1805,3185 | src/components/query/DataGrid.tsx (skeleton + isFetching bar) | INT-009 | Done |
| Grid fills viewport height | material:src/qqq/pages/records/query/RecordQuery.tsx:3160-3175 | none | none | Missing: grid does not fill the viewport (cosmetic); #717 |
| Stale-query guard | material:src/qqq/pages/records/query/RecordQuery.tsx:1098,1211 | src/lib/hooks/use-record-query.ts (TanStack query keys) | none | Done: inherent |
| Scroll to top on page change | material:src/qqq/pages/records/query/RecordQuery.tsx:2691-2695 | none | none | Missing: router.replace uses scroll:false; #717 |
| Embedded usages (reportSetup/isModal/isPreview/initial filter+columns/allowVariables/Open In New Window) | material:src/qqq/pages/records/query/RecordQuery.tsx:92-106,210,997-1003 | none (src/components/widgets/FilterAndColumnsSetupWidget.tsx is read-only) | none | Missing: no embedded query screen; #722 |
| Key 'n' = create | material:src/qqq/pages/records/query/RecordQuery.tsx:740-744 | src/components/query/RecordQuery.tsx:usePageShortcuts | QRY-065 | Done |
| Key 'r' = refresh | material:src/qqq/pages/records/query/RecordQuery.tsx:745-749 | src/components/query/RecordQuery.tsx:usePageShortcuts | QRY-065 | Done |
| Key 'f' = filter builder | material:src/qqq/pages/records/query/RecordQuery.tsx:758-767 | src/components/query/RecordQuery.tsx:usePageShortcuts | QRY-065 | Done: no basic/advanced gate since Next has no basic mode |
| Shortcuts suppressed in inputs/modals | material:src/qqq/pages/records/query/RecordQuery.tsx:735-738 | src/lib/hooks/use-page-shortcuts.ts | QRY-065 | Done |
| Default sort PK descending | material:src/qqq/pages/records/query/RecordQuery.tsx:1426,1493 | src/lib/hooks/use-record-query.ts:defaultSort | QRY-001 | Done |
| Sort via column menu / server sort | material:src/qqq/pages/records/query/RecordQuery.tsx:1405-1444,3360 | src/components/query/DataGrid.tsx:handleSortColumn | QRY-003 | Done: header click cycles asc/desc/default (Material used the menu) |
| "Sort: <Field>" picker w/ direction toggle in filter bar | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:103-117,543-640 | none | none | Missing: no sort picker; #715 |
| Sorting by a join field activates that join | material:src/qqq/pages/records/query/RecordQuery.tsx:970-991 | src/lib/hooks/use-record-query.ts (referencedFieldNames incl. sort) | QRY-020 | Done: join added; column not auto-shown |
| Default columns: PK first/pinned, alphabetical, joins hidden, heavy skipped, querySelectable virtuals | material:src/qqq/models/query/QQueryColumns.ts:72-110; material:src/qqq/utils/DataGridUtils.tsx:273-295 | src/lib/utils/query-columns.ts:getQueryColumns | QRY-001 | Partial: metadata order; no PK pin; no virtual fields; #716 |
| Default column order by sections (each field once), then fields no section lists | material:src/qqq/utils/DataGridUtils.tsx:145-262 (setupGridColumns bySection) | src/lib/utils/query-columns.ts:fieldsInSectionOrder | QRY-068 | Done |
| Default widths by type / SIZE adornment | material:src/qqq/utils/DataGridUtils.tsx:389-437 | src/components/query/DataGrid.tsx:sizeWidth (else 150) | none | Partial: no per-type defaults; #716 |
| PK cell links to record | material:src/qqq/utils/DataGridUtils.tsx:308-313 | src/components/query/DataCell.tsx (Link) | REL-001 | Done |
| Field help tooltip on column header | material:src/qqq/utils/DataGridUtils.tsx:368-380 | none | none | Missing: no column-header help; #716 |
| "Columns (N)" menu: search, per-table switch + counts, collapse | material:src/qqq/pages/records/query/RecordQuery.tsx:3058-3139; material:src/qqq/components/query/FieldListMenu.tsx | src/components/query/ColumnConfig.tsx | QRY-004 | Partial: groups + all/none only; no search/counts/"(N)"; #716 |
| Columns button clean/dirty styling | material:src/qqq/pages/records/query/RecordQuery.tsx:3063-3100 | none | none | Missing: no clean/dirty styling; #716 |
| Column reorder persisted | material:src/qqq/pages/records/query/RecordQuery.tsx:1375-1386 | src/components/query/ColumnConfig.tsx (drag/arrows); src/lib/hooks/use-column-config.ts (LS qqq-<t>-column-order) | QRY-004 | Done: panel only, not header drag |
| Column resize persisted | material:src/qqq/pages/records/query/RecordQuery.tsx:1392-1398 | src/components/query/DataGrid.tsx:handleResizeMouseDown (LS qqq-<t>-column-widths) | QRY-005 | Done |
| Pin column left/right, persisted | material:src/qqq/pages/records/query/RecordQuery.tsx:1296-1304,2359 | none | none | Missing: no pinning; saved-view pinned not rendered; #716 |
| Hide column from column menu | material:src/qqq/pages/records/query/RecordQuery.tsx:2356 | src/components/query/ColumnConfig.tsx | QRY-004 | Partial: hide via panel only; no column menu; #716 |
| Column menu "Filter" | material:src/qqq/pages/records/query/RecordQuery.tsx:2113-2144 | none | none | Missing: no filter from column; #716 |
| Copy page values | material:src/qqq/pages/records/query/RecordQuery.tsx:2151-2185 | none | none | Missing: no copy page values; #716 |
| Copy full query values (TSV export, limit setting) | material:src/qqq/pages/records/query/RecordQuery.tsx:2190-2270,2392; material:src/main/java/.../model/metadata/MaterialDashboardInstanceMetaData.java:40,145-159 | none | none | Missing: no copy full values; queryScreenCopyFullQueryColumnValuesLimit unused; #716 |
| Column statistics entry point | material:src/qqq/pages/records/query/RecordQuery.tsx:2276-2300 | src/components/query/DataGrid.tsx (header BarChart3) -> src/components/query/ColumnStatsDialog.tsx | QRY-022, QRY-023 | Done: header icon instead of menu |
| Virtual fields: no sort/filter when not queryCriteria | material:src/qqq/pages/records/query/RecordQuery.tsx:2322-2336 | none | none | Missing: virtual fields unsupported entirely; #716 |
| Header filter icon for active criteria | material:src/qqq/pages/records/query/RecordQuery.tsx:2413-2445 | none | none | Missing: no active-filter header icon; #716 |
| Density selector, LS qqq.density (global) | material:src/qqq/pages/records/query/RecordQuery.tsx:1309-1316,2586 | src/lib/hooks/use-record-query.ts (LS qqq-<t>-density); src/components/query/RecordQueryToolbar.tsx | QRY-005 | Partial: per-table, different key; #717 |
| Even/odd striping | material:src/qqq/pages/records/query/RecordQuery.tsx:3362 | none | none | Missing: no striping (cosmetic, not fully checked); #717 |
| Long values trimmed to 2048 + "…" | material:src/qqq/utils/DataGridUtils.tsx:75-88 | src/components/query/DataCell.tsx (CSS truncate) | none | Partial: display truncate only; #717 |
| Row click opens record (drag/double-click guard) | material:src/qqq/pages/records/query/RecordQuery.tsx:1321-1340; material:src/qqq/utils/DataGridUtils.tsx:44-70 | src/components/query/DataGrid.tsx:handleRowClick (router.push) | QRY-006 | Partial: no drag/double-click guard; #717 |
| Ctrl/Cmd-click new tab | material:src/qqq/utils/DataGridUtils.tsx:311 (PK Link only) | src/components/query/DataCell.tsx (Links) | REL-001 | Done: neither UI does it on rows; links work |
| Refresh button | material:src/qqq/pages/records/query/RecordQuery.tsx:2578 | src/components/query/RecordQueryToolbar.tsx | QRY-006 | Done |
| Query joins only for readable join paths | material:src/qqq/pages/records/query/RecordQuery.tsx:1083-1092; material:src/qqq/utils/qqq/TableUtils.ts:221-264 | src/lib/hooks/use-record-query.ts (activeExposedJoins); src/lib/utils/query-columns.ts | QRY-020 | Partial: checks the join table's readPermission only, not every joinPath table; #696 |
| Distinct count for many-joins | material:src/qqq/pages/records/query/RecordQuery.tsx:1110 | src/lib/hooks/use-record-query.ts:includeDistinct | QRY-021 | Done |
| Page sizes 10/25/50/100/250, default 50, persisted in view | material:src/qqq/components/query/CustomPaginationComponent.tsx:165; material:src/qqq/pages/records/query/RecordQuery.tsx:279,1284 | src/lib/constants.ts:PAGE_SIZE_OPTIONS | QRY-002 | Partial: default 25; URL only, not persisted; #717 |
| "Showing X to Y of Z" / "Counting…" / "No rows" | material:src/qqq/components/query/CustomPaginationComponent.tsx:93-112 | src/components/query/Pagination.tsx | QRY-002 | Partial: no "Counting…" state (not fully checked); #717 |
| Pagination range and total are locale formatted ("1,001–1,234 of 1,234") | material:src/qqq/components/query/CustomPaginationComponent.tsx:93-112 | src/components/query/Pagination.tsx | QRY-069 | Done |
| "(N distinct)" + explanation | material:src/qqq/components/query/CustomPaginationComponent.tsx:55-65 | src/components/query/Pagination.tsx | QRY-021 | Done |
| No-TABLE_COUNT pagination | material:src/qqq/components/query/CustomPaginationComponent.tsx:67-148 | src/components/query/Pagination.tsx (uncounted) | QRY-062 | Done |
| Page change keeps count | material:src/qqq/pages/records/query/RecordQuery.tsx:2676 | src/lib/hooks/use-record-query.ts (separate count query) | QRY-002 | Done |
| Checkbox selection -> PKs | material:src/qqq/pages/records/query/RecordQuery.tsx:1345-1370 | src/components/query/DataGrid.tsx; src/lib/hooks/use-record-query.ts | QRY-030, QRY-031 | Done |
| Selection menu (page / full / subset / clear) | material:src/qqq/pages/records/query/RecordQuery.tsx:2491-2601 | src/components/query/SelectionMenu.tsx | QRY-030 | Done |
| Subset dialog | material:src/qqq/components/query/SelectionSubsetDialog.tsx | src/components/query/SelectionMenu.tsx | QRY-033 | Done |
| Selection status messages | material:src/qqq/pages/records/query/RecordQuery.tsx:2623-2664 | src/components/query/SelectionMenu.tsx:selectionSummary | QRY-030 | Done: subset text not clickable (not fully checked) |
| Basic/Advanced toggle, mode persisted | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:439-470,662-671 | src/lib/hooks/use-record-query.ts (filterMode; setFilterMode unused) | none | Missing: no toggle UI; mode only round-trips in viewJson; #715 |
| Basic disabled w/ reasons tooltip | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:609-625; material:src/qqq/utils/qqq/FilterUtils.tsx:416-474 | none | none | Missing: no basic mode to disable; #715 |
| Auto-switch to advanced for complex filters | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:477-496 | n/a | none | N/A: Next is advanced-only |
| Default quick filters (materialDashboard.defaultQuickFilterFieldNames, else T1 fields) | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:804-848; material:src/main/java/.../model/metadata/MaterialDashboardTableMetaData.java:59 | none | none | Missing: no default quick filters; #715 |
| "Add Filter" field menu (joins, virtuals) | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:336-382,729-741 | none | none | Missing: no Add Filter menu; #715 |
| Default operator per type (PVS any-of, DATE_TIME after, boolean none) | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:191-207 | src/lib/utils/filter-utils.ts:getDefaultOperatorForFieldType | none | Partial: builder rows only; #715 |
| Quick filter chip text "Field: op values +N" | material:src/qqq/components/query/QuickFilter.tsx:511-534 | none | none | Missing: no quick-filter chips; #715 |
| Quick filter menu (operator + value, apply on close) | material:src/qqq/components/query/QuickFilter.tsx:316-325,600-635 | none | none | Missing: no quick-filter menu; #715 |
| Hover X clears / removes quick filter | material:src/qqq/components/query/QuickFilter.tsx:572-598 | none | none | Missing: no quick-filter clear/remove; #715 |
| "Too complex" quick filter tooltip | material:src/qqq/components/query/QuickFilter.tsx:557-567 | none | none | Missing: no "too complex" tooltip; #715 |
| quickFilterFieldNames persisted | material:src/qqq/pages/records/query/RecordQuery.tsx:1571-1577 | src/lib/utils/saved-view-utils.ts (passthrough) | none | Partial: kept in JSON, not rendered; #715 |
| URL/view criteria auto-become quick filters | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:477-510 | none | none | Missing: criteria never become quick filters; #715 |
| Filter Builder button with count badge | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:758-775 | src/components/query/RecordQuery.tsx:activeFilterCount | QRY-016 | Done |
| Clear-all w/ confirm, keeps sort | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:416-423,777-790 | src/components/query/FilterBuilder.tsx (button-clear-filter) | none | Partial: no confirm dialog; #715 |
| Advanced query preview pills w/ remove X | material:src/qqq/components/query/AdvancedQueryPreview.tsx | none (src/lib/utils/filter-utils.ts:formatCriterionDisplay unused in UI) | none | Missing: no preview pills; #715 |
| Filter rows: remove, And/Or, field/op/values, "Add Condition" | material:src/qqq/components/query/CustomFilterPanel.tsx; material:src/qqq/components/query/FilterCriteriaRow.tsx:505-563 | src/components/query/FilterBuilder.tsx (FilterGroup/FilterRow) | QRY-010, QRY-016 | Done: no valid/pending icon (not fully checked) |
| Sub-filters not editable in Material | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:620-625; material:src/qqq/utils/qqq/FilterUtils.tsx:430 | src/components/query/FilterBuilder.tsx ("Add group") | QRY-016 | Done: Next exceeds Material |
| Criteria validation tooltips | material:src/qqq/components/query/FilterCriteriaRow.tsx:228-289 | src/lib/utils/filter-utils.ts:isCriterionComplete | none | Partial: no messages; #715 |
| Field change resets values/operator | material:src/qqq/components/query/FilterCriteriaRow.tsx:360-395 | src/components/query/FilterBuilder.tsx (newCriterionForField) | QRY-010 | Done |
| String operators | material:src/qqq/components/query/FilterCriteriaRow.tsx:188-200 | src/lib/utils/filter-utils.ts:getOperatorOptions | QRY-010 | Done: labels match |
| Number operators | material:src/qqq/components/query/FilterCriteriaRow.tsx:124-139 | src/lib/utils/filter-utils.ts:getOperatorOptions | QRY-011 | Done |
| Date operators | material:src/qqq/components/query/FilterCriteriaRow.tsx:140-150 | src/lib/utils/filter-utils.ts:getOperatorOptions | QRY-012 | Done |
| Date-time operators | material:src/qqq/components/query/FilterCriteriaRow.tsx:157-167 | src/lib/utils/filter-utils.ts:getOperatorOptions | QRY-013 | Done |
| Weekday "day is any of / none of" + weekdayCriteriaSettings (enabled, dateTimeFieldFunctionArguments) | material:src/qqq/components/query/FilterCriteriaRow.tsx:100-102,151-172; material:src/qqq/utils/qqq/FilterUtils.tsx:243-284; material:src/main/java/.../model/metadata/WeekdayCriteriaSettings.java:53-54 | none | none | Missing: no weekday operators; #718 |
| Boolean equals yes/no/empty | material:src/qqq/components/query/FilterCriteriaRow.tsx:174-178 | src/lib/utils/filter-utils.ts:getOperatorOptions | QRY-014 | Done |
| Blob empty / not empty | material:src/qqq/components/query/FilterCriteriaRow.tsx:184-186 | src/lib/utils/filter-utils.ts:getOperatorOptions | QRY-014 | Done |
| PVS operators | material:src/qqq/components/query/FilterCriteriaRow.tsx:111-119 | src/lib/utils/filter-utils.ts:getOperatorOptions | QRY-015 | Done |
| URL NOT_EQUALS -> NOT_EQUALS_OR_IS_NULL | material:src/qqq/pages/records/query/RecordQuery.tsx:2843-2850 | src/lib/utils/filter-utils.ts (OPERATORS renders NOT_EQUALS, LIKE, TRUE…) | QRY-018 | Done: renders instead of normalizing |
| Typed inputs, clear X | material:src/qqq/components/query/FilterCriteriaRowValues.tsx:69-119 | src/components/query/FilterBuilder.tsx:TypedInput | QRY-011, QRY-012, QRY-013 | Done |
| toUpper/lowerCase behaviors in filter input | material:src/qqq/components/query/FilterCriteriaRowValues.tsx:191-226 | none | none | Missing: no upper/lower case in filter inputs; #718 |
| Multi-value chips | material:src/qqq/components/query/FilterCriteriaRowValues.tsx:344-366 | src/components/query/FilterBuilder.tsx:TagInput | QRY-011 | Done |
| PVS single/multi show labels, send ids | material:src/qqq/components/query/FilterCriteriaRowValues.tsx:367-438; material:src/qqq/utils/qqq/FilterUtils.tsx:58-102 | src/components/query/FilterBuilder.tsx:PossibleValueSingleSelect/PossibleValueMultiSelect | QRY-015 | Done |
| "Bulk Add Filter Values" paster (separators, PVS validation, counts, help slot) | material:src/qqq/components/query/FilterCriteriaPaster.tsx | src/components/query/FilterBuilder.tsx:TagInput (onPaste splits comma/newline) | none | Partial: no dialog/PVS lookup/counts/help; #718 |
| Relative date preset menu | material:src/qqq/components/query/CriteriaDateField.tsx:243-307 | none | none | Missing: custom editor only, no presets; #718 |
| Custom date expression dialog | material:src/qqq/components/query/AdvancedDateTimeFilterValues.tsx | src/components/query/FilterBuilder.tsx:ExpressionEditor | QRY-012, QRY-013 | Done |
| Expression display + live evaluated tooltip | material:src/qqq/components/query/CriteriaDateField.tsx:123-148; material:src/qqq/components/query/EvaluatedExpression.tsx | src/lib/utils/filter-utils.ts:describeExpression | QRY-012 | Partial: no evaluated-date tooltip; #718 |
| Date-time local/UTC conversion | material:src/qqq/utils/qqq/FilterUtils.tsx:82-94,216-222 | src/lib/utils/filter-utils.ts:localDateTimeToUtc/utcToLocalDateTimeInput | QRY-013 | Done |
| Filter variables (assign, "${VARIABLE}", block query) | material:src/qqq/components/query/AssignFilterVariable.tsx; material:src/qqq/pages/records/query/RecordQuery.tsx:1051-1064 | display only (src/lib/utils/filter-utils.ts; src/components/widgets/FilterAndColumnsSetupWidget.tsx) | none | Partial: no assign UI; Material only in report-setup embed; #722 |
| Strip incomplete criteria | material:src/qqq/utils/qqq/FilterUtils.tsx:755-785 | src/lib/utils/filter-utils.ts:isCriterionComplete/prepFilterForBackend | none | Done |
| ?filter= JSON URL (+Next page/pageSize/q) | material:src/qqq/pages/records/query/RecordQuery.tsx:2820-2869 | src/lib/hooks/use-record-query.ts (deserializeFilter/normalizeFilter) | QRY-017 | Done |
| PV ids -> labels from URL/views | material:src/qqq/utils/qqq/FilterUtils.tsx:113-237 | src/components/query/FilterBuilder.tsx:useSelectedLabels | QRY-015, QRY-017 | Done |
| Views only if querySavedView exists | material:src/qqq/pages/records/query/RecordQuery.tsx:3049 | src/lib/hooks/use-saved-views.ts | QRY-050 | Done: gating not fully checked |
| Views menu actions incl. "Create Report from Current View" | material:src/qqq/components/misc/SavedViews.tsx:327-409,177-188 | src/components/query/SavedViewsMenu.tsx | QRY-051, QRY-052 | Partial: no Create Report; #717 |
| Your / Shared lists + empty messages | material:src/qqq/components/misc/SavedViews.tsx:410-437 | src/components/query/SavedViewsMenu.tsx | QRY-050, QRY-054 | Done |
| View on own URL /savedView/<id> | material:src/qqq/components/misc/SavedViews.tsx:113-122; material:src/qqq/pages/records/query/RecordQuery.tsx:790 | src/app/(dashboard)/app/[slug]/savedView/[viewId] | QRY-050 | Done |
| Last saved view remembered (LS qqq.currentSavedViewId.<t>) + redirect | material:src/qqq/pages/records/query/RecordQuery.tsx:814-823,2905 | none | none | Missing: last saved view not remembered; #717 |
| Ad-hoc view in LS qqq.recordQueryView.<t> | material:src/qqq/pages/records/query/RecordQuery.tsx:305,841-865 | URL state only (src/lib/hooks/use-record-query.ts) | QRY-006, QRY-017 | Partial: lost when reopening table from nav; #717 |
| Unsaved-changes count + diff tooltip + Save…/Reset | material:src/qqq/components/misc/SavedViews.tsx:441-593; material:src/qqq/utils/qqq/SavedViewUtils.ts | src/components/query/SavedViewsMenu.tsx; src/lib/utils/saved-view-utils.ts:diffViews | QRY-052 | Partial: coarse diffs ("Changed the filter"); #717 |
| Not-owner lockout text | material:src/qqq/components/misc/SavedViews.tsx:319-325 | src/components/query/SavedViewsMenu.tsx (notOwnerText) | QRY-054 | Done |
| Save/Rename/Save As/Delete dialogs, inline errors | material:src/qqq/components/misc/SavedViews.tsx:626-710 | src/components/query/SavedViewsMenu.tsx | QRY-051, QRY-052, QRY-053 | Done |
| Stores PV ids, strips incomplete criteria | material:src/qqq/components/misc/SavedViews.tsx:223-232 | src/lib/utils/saved-view-utils.ts:buildViewJson | QRY-051 | Done |
| View w/o columns gets defaults + notice | material:src/qqq/pages/records/query/RecordQuery.tsx:1953; material:src/qqq/utils/qqq/SavedViewUtils.ts:219 | src/lib/utils/saved-view-utils.ts:viewToState | none | Partial: no notice (not fully checked); #717 |
| Quick saved views row (type=quickView, sortOrder, doCount) | material:src/qqq/components/query/QuickSavedViews.tsx | none | none | Missing: no quick views row; #717 |
| New View resets to base URL | material:src/qqq/components/misc/SavedViews.tsx:149-156 | src/components/query/SavedViewsMenu.tsx | QRY-052 | Done |
| Dirty saved view restored on reload | material:src/qqq/pages/records/query/RecordQuery.tsx:2872-2889 | none | none | Missing: dirty view not restored on reload; #717 |
| Column stats modal via columnStats process | material:src/qqq/pages/records/query/ColumnStats.tsx | src/components/query/ColumnStatsDialog.tsx | QRY-022 | Done |
| Value/count/percent grid, server sort, "(grouped by hour)" | material:src/qqq/pages/records/query/ColumnStats.tsx:142-166,210 | src/components/query/ColumnStatsDialog.tsx | QRY-022 | Partial: no grouped-by-hour label; #717 |
| Stats fields panel | material:src/qqq/pages/records/query/ColumnStats.tsx:273-284 | src/components/query/ColumnStatsDialog.tsx | QRY-022 | Done |
| "Showing the first N of M values" | material:src/qqq/pages/records/query/ColumnStats.tsx:171-180 | src/components/query/ColumnStatsDialog.tsx | QRY-022 | Done |
| Refresh + Export CSV | material:src/qqq/pages/records/query/ColumnStats.tsx:182-239 | src/components/query/ColumnStatsDialog.tsx (Refresh) | QRY-022 | Partial: no Export; #717 |
| Stats error alert | material:src/qqq/pages/records/query/ColumnStats.tsx:230 | src/components/query/ColumnStatsDialog.tsx | QRY-022 | Done: error rendering not fully checked |
| CustomColumnsPanel.tsx | material:src/qqq/components/query/CustomColumnsPanel.tsx | n/a | none | N/A: dead code (unreferenced; ColumnsPanel slot set to "") |
| FilterPoc.tsx, IntersectionMatrix.tsx | material:src/qqq/pages/records/FilterPoc.tsx; material:src/qqq/pages/records/IntersectionMatrix.tsx | n/a | none | N/A: dead POCs (unreferenced) |

Where Next goes beyond Material: editable nested AND/OR groups, quick search across text fields (QRY-019), card view (QRY-005), a go-to-page input, header-click sort cycling, rendering of backend-only operators, and an empty state with a reset action.

## Records

Record view, create/edit/copy forms, field rendering, audits, sharing and developer views. Rows #8 (`showRecordSidebar`) and #9 (`recordViewActionsPlacement`) of the supplemental-metadata draft are merged into the sidebar and actions-placement rows here. Help-help, generic processes, process URLs and modals, analytics, form adjusters, field rules, form widget editing, scripts and data bags are covered in their own areas.

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Record view loads full table metadata + record by id and renders label, sections, formatted values | material:src/qqq/pages/records/view/RecordView.tsx:586 | src/app/(dashboard)/app/[slug]/[recordId]/page.tsx; src/components/records/RecordView.tsx | REC-001 | Done |
| Page header set to record label | material:src/qqq/pages/records/view/RecordView.tsx:686 | src/app/(dashboard)/app/[slug]/[recordId]/page.tsx (setPageHeader) | REC-044 | Done |
| Viewed record pushed to recent history (HistoryUtils.push) | material:src/qqq/pages/records/view/RecordView.tsx:699 | src/lib/utils/recent-records.ts addRecentRecord (called from record page) | NAV-025 | Done |
| Not-found (404) message; record purged from history | material:src/qqq/pages/records/view/RecordView.tsx:660 | src/components/records/RecordView.tsx ("Record Not Found" + Back to table) | REC-003 | Done: wording differs ("does not exist or has been deleted"); 404'd record not removed from recents (#729) |
| 403 on record GET: "You do not have permission to view X records" | material:src/qqq/pages/records/view/RecordView.tsx:674 | src/components/records/RecordView.tsx (Permission Denied + Go Back); record page canReadRecords message | SEC-002 | Done |
| Sections from table metadata; no sections -> pseudo "All Fields" section | material:src/qqq/utils/qqq/TableUtils.ts:49,134 | src/components/records/RecordView.tsx (fallback grid of all visible fields) | REC-001 | Done |
| Section `alternatives` for RECORD_VIEW replace a section's definition | material:src/qqq/pages/records/view/RecordView.tsx:712 | none | none | Missing: no code references `alternatives`; #723 |
| Hidden sections / hidden fields never rendered | material:src/qqq/pages/records/view/RecordView.tsx:716 | src/components/records/RecordView.tsx isSectionHidden; RecordViewSection | REC-002 | Done |
| T1 section rendered inside the identity/header card | material:src/qqq/pages/records/view/RecordView.tsx:776,1215 | src/components/records/RecordViewHeader.tsx (t1Fields grid) | REC-001 | Partial: drops T1 fields whose value is in the record label, and the primary key (Material shows all); #723 |
| Non-T1 sections rendered in metadata order as cards on one page | material:src/qqq/pages/records/view/RecordView.tsx:1245 | src/components/records/RecordViewTabs.tsx (Overview/T2/T3/Related tabs); list mode in RecordView.tsx | REC-004 | Done: layout is tabs or list view (URL `?view=`, user pref) |
| Section help content under section title (VIEW_SCREEN/READ_SCREENS/ALL_SCREENS) | material:src/qqq/pages/records/view/RecordView.tsx:523 | src/components/records/RecordViewSection.tsx (selectHelpContent VIEW_SCREEN_HELP_ROLES) | REC-040 | Done |
| Field label help tooltip by screen roles | material:src/qqq/pages/records/view/RecordView.tsx:130 | src/components/records/FieldLabel.tsx | REC-039 | Done |
| Field gridColumns (12-column grid) and section gridColumns (card width) | material:src/qqq/pages/records/view/RecordView.tsx:128,1285 | src/components/records/RecordViewSection.tsx (section.gridColumns read as 1-4 column count; field.gridColumns==2 spans 2) | none | Partial: different meaning; Material twelfths (4/6/12) don't map; #723 |
| Join-table fields in sections (`table.field`), fetched with queryJoins on GET | material:src/qqq/pages/records/view/RecordView.tsx:166,621 | src/lib/api/tables.ts getRecord accepts queryJoins, but the record page never passes it; RecordViewSection looks up only `tableMetaData.fields` | none | Missing: join fields in sections are silently dropped; #722 |
| Table variant (localStorage `qqq.tableVariant.<table>`) applied to record GET and blob URLs | material:src/qqq/pages/records/view/RecordView.tsx:208,630; material:src/qqq/utils/qqq/ValueUtils.tsx:249 | src/lib/utils/table-variant.ts; src/lib/hooks/use-record.ts; src/lib/api/tables.ts | QRY-066 | Done: record GET and edit send the variant; blob URLs are the `?tableVariant=` row below (#722) |
| Collapsible sections (`section.collapsible.isCollapsible/initiallyOpen`), state kept in localStorage | material:src/qqq/pages/records/view/RecordView.tsx:568,727,1063 | none (mobile accordion only, src/components/records/RecordViewTabs.tsx) | none | Missing: no collapsible metadata or stored open state; #723 |
| Widget sections rendered through DashboardWidgets (screen=recordView) | material:src/qqq/pages/records/view/RecordView.tsx:750,1250 | src/components/records/RecordViewSection.tsx -> ConnectedWidget | WID-024, WID-026, WID-028, WID-030, WID-032 | Done |
| Section collapsible metadata overrides the widget's collapsible metadata | material:src/qqq/pages/records/view/RecordView.tsx:1258 | none | none | Missing: section collapsible metadata not applied to widgets; #723 |
| Widget sections sized by widget gridColumns (side by side) | material:src/qqq/pages/records/view/RecordView.tsx:1268 | src/components/records/RecordViewTabs.tsx (lg:col-span-2 when gridColumns>=3) | none | Partial: only a two-span rule, not gridColumns widths; #723 |
| Record sidebar: sticky list of section links (icon + label), click scrolls to the section | material:src/qqq/components/misc/RecordSidebar.tsx:55,94 | none (replaced by tabs) | none | Missing: tabs replace in-page section navigation; no scroll-to-section; #723 |
| `supplementalTableMetaData.materialDashboard.showRecordSidebar` (default true); false hides the sidebar and widens the body | material:src/qqq/pages/records/view/RecordView.tsx:1101,1121,1215-1218; material:src/main/java/.../model/metadata/MaterialDashboardTableMetaData.java:61 | none (src/components/records/RecordView.tsx uses tabs, no record sidebar) | none | Missing: no record sidebar, so showRecordSidebar is unread; #723 |
| `#<sectionName>` anchor link scrolls to a section (no reload) | material:src/qqq/pages/records/view/RecordView.tsx:437 | src/lib/utils/material-links.ts; src/components/records/RecordView.tsx | REC-050, REC-051 | Done |
| Header card: table-icon avatar in accent color; title "Viewing <label>: <recordLabel>" | material:src/qqq/pages/records/view/RecordView.tsx:1218 | src/components/records/RecordViewHeader.tsx (initials avatar, h1 = recordLabel) | REC-044 | Partial: cosmetic; no table icon or accent color; "Viewing <table label>:" prefix dropped; #723 |
| `recordViewActionsPlacement` INLINE_WITH_PAGE_TITLE (actions in page header) vs IN_IDENTITY_SECTION; instance overrides table | material:src/qqq/pages/records/view/RecordView.tsx:1102,1122-1162; material:src/main/java/.../model/metadata/MaterialDashboardTableMetaData.java:48-62; material:src/main/java/.../model/metadata/MaterialDashboardInstanceMetaData.java:42 | none (fixed placement in src/components/records/RecordViewHeader.tsx) | none | Missing: not configurable; #723 |
| Success alert after create/update (location.state createSuccess/updateSuccess) | material:src/qqq/pages/records/view/RecordView.tsx:803 | src/components/forms/EntityForm.tsx toast.success | REC-006, REC-009 | Done: toast instead of an inline alert |
| Save warning shown on view (record.warnings[0], or an error message starting "warning") | material:src/qqq/components/forms/EntityForm.tsx:1400,1423; material:src/qqq/pages/records/view/RecordView.tsx:811 | none (view shows GET-time record.warnings only; save warnings are dropped) | none | Missing: save warnings are dropped; #723 |
| Edit / Delete buttons shown only with capability + permission | material:src/qqq/pages/records/view/RecordView.tsx:1318 | src/components/records/RecordActions.tsx (canEditRecords/canDeleteRecords) | SEC-004, SEC-005, SEC-014, REC-046 | Done |
| Default actions menu (NEW, COPY, EDIT, DELETE / table processes / generic processes, DEVELOPER_MODE, AUDIT) | material:src/qqq/pages/records/view/RecordView.tsx:470 | src/components/records/RecordActions.tsx (Edit, Copy, processes, Delete) | SEC-006, PRC-048 | Partial: no New or Developer Mode items; Audit is a separate button; #723 |
| Menu: NEW (insert capability + permission) | material:src/qqq/components/view/RecordViewMenus.tsx:191 | none (only the `n` shortcut, REC-055) | none | Missing: no New menu item; #723 |
| Menu: COPY | material:src/qqq/components/view/RecordViewMenus.tsx:197 | src/components/records/RecordActions.tsx | REC-013, SEC-006 | Done |
| Menu: EDIT | material:src/qqq/components/view/RecordViewMenus.tsx:203 | src/components/records/RecordActions.tsx | REC-009, SEC-004 | Done |
| Menu: DELETE | material:src/qqq/components/view/RecordViewMenus.tsx:209 | src/components/records/RecordActions.tsx -> DeleteConfirmDialog | REC-012, SEC-005 | Done |
| Menu: DEVELOPER_MODE -> `/<table>/<id>/dev` | material:src/qqq/components/view/RecordViewMenus.tsx:215 | route exists (src/app/(dashboard)/app/[slug]/[recordId]/dev/page.tsx), but nothing links to it | none | Missing: reachable only by typing the URL; #723 |
| Menu: AUDIT (when the audit table exists) | material:src/qqq/components/view/RecordViewMenus.tsx:219 | src/components/records/RecordViewHeader.tsx Audit button (auditSource) | REC-042, REC-043 | Done: button instead of menu item |
| Menu: THIS_TABLE_PROCESS_LIST (sorted by label) opens a process modal over the record | material:src/qqq/components/view/RecordViewMenus.tsx:225; material:src/qqq/pages/records/view/RecordView.tsx:600 | src/components/records/RecordActions.tsx -> `/app/<process>?recordsParam=recordIds&recordIds=<pk>` | NAV-034, NAV-035 | Done (different UX): runs as a full page that returns to the record; processes not sorted by label (#723) |
| Backend-defined `VIEW_SCREEN_ACTIONS` menu replaces the default | material:src/qqq/pages/records/view/RecordView.tsx:512 | none | none | Missing: `table.menus` ignored; #723 |
| Backend-defined `VIEW_SCREEN_ADDITIONAL` menus as extra buttons | material:src/qqq/components/view/RecordViewMenus.tsx:48 | none | none | Missing: no additional menu buttons; #723 |
| Menu item RUN_PROCESS (processName) | material:src/qqq/components/view/RecordViewMenus.tsx:161 | none | none | Missing: no backend menu items; #723 |
| Menu item DOWNLOAD_FILE (fieldName; disabled when empty; BLOB via iframe, else window.open) | material:src/qqq/components/view/RecordViewMenus.tsx:166; material:src/qqq/pages/records/view/RecordView.tsx:907 | none | none | Missing: no backend menu items; #723 |
| Menu SUB_MENU / SUB_LIST / DIVIDER (no duplicate dividers); per-item label/icon; processes not repeated | material:src/qqq/components/view/RecordViewMenus.tsx:151-190,370 | none | none | Missing: no backend menu structure; #723 |
| Share button (shareableTableMetaData), disabled with "Only the owner of a X may share it." | material:src/qqq/pages/records/view/RecordView.tsx:960 | src/components/sharing/ShareDialog.tsx ShareButton | RPT-017 | Done |
| "Go To..." button (GotoRecordDialog) in view actions | material:src/qqq/pages/records/view/RecordView.tsx:1110; material:src/qqq/components/misc/GotoRecordDialog.tsx:348 | src/components/records/RecordViewHeader.tsx; src/components/records/GotoRecordDialog.tsx:GotoRecordButton | QRY-067 | Done |
| Keyboard `n` new, `e` edit, `c` copy, `d` delete (capability + permission) | material:src/qqq/pages/records/view/RecordView.tsx:262-296 | src/components/records/RecordViewHeader.tsx usePageShortcuts; src/lib/hooks/use-page-shortcuts.ts | REC-055 | Done |
| Keyboard `a` audit (when the audit table exists) | material:src/qqq/pages/records/view/RecordView.tsx:297 | src/components/records/RecordViewHeader.tsx usePageShortcuts `a` | REC-055 | Done |
| Shortcuts suppressed in text inputs, with meta/ctrl, and while menus/dialogs/modals are open | material:src/qqq/pages/records/view/RecordView.tsx:266 | src/lib/hooks/use-page-shortcuts.ts isTextEntryTarget/hasOpenOverlay | REC-055 | Done |
| Hash `#launchProcess=<name>` opens the process modal on the record view | material:src/qqq/pages/records/view/RecordView.tsx:385 | src/lib/utils/material-links.ts recordHashAction; src/components/records/RecordView.tsx | REC-050, REC-051 | Done |
| URL `/<table>/<id>/createChild/<childTable>` opens a child create modal | material:src/qqq/pages/records/view/RecordView.tsx:400; material:src/App.tsx:329 | none (no such route under [recordId]) | none | Missing: hash form works (REC-051), path form not routed; #723 |
| Hash `#createChild=<table>/defaultValues=../disabledFields=..` (used by widget "Add new" links) | material:src/qqq/pages/records/view/RecordView.tsx:415; material:src/qqq/components/widgets/Widget.tsx:274 | src/lib/utils/material-links.ts; src/components/records/CreateChildFromLinkDialog.tsx | REC-050, REC-051 | Done |
| childRecordList widget "Add new": creates a child with defaultValuesForNewChildRecords / disabled fields | material:src/qqq/components/widgets/Widget.tsx:260 | src/components/widgets/ChildRecordListWidget.tsx (defaultValuesForNewChildRecords, FromParentFields) | RPT-012 | Done: create dialog over the parent with the parent link preset and locked |
| Hash `#audit` opens the audit modal | material:src/qqq/pages/records/view/RecordView.tsx:430 | src/lib/utils/material-links.ts recordHashAction | REC-050, REC-051 | Done |
| Delete confirmation dialog ("Confirm Deletion" / No / Yes, Yes disabled while submitting) | material:src/qqq/pages/records/view/RecordView.tsx:1335 | src/components/records/DeleteConfirmDialog.tsx | REC-012, INT-003 | Done |
| Delete success -> list with a success message | material:src/qqq/pages/records/view/RecordView.tsx:850 | DeleteConfirmDialog toast + router.push list; record-cache forgetDeletedRecord | REC-012 | Done |
| Delete error starting with "warning" treated as success-with-warning | material:src/qqq/pages/records/view/RecordView.tsx:862 | none (shown as an error) | none | Missing: shown as an error; #723 |
| Delete failure shows an error alert and scrolls to top | material:src/qqq/pages/records/view/RecordView.tsx:868 | DeleteConfirmDialog inline alert + toast | none | Done |
| Child create modal from the record view (EntityForm isModal with parent defaults) | material:src/qqq/pages/records/view/RecordView.tsx:1365 | src/components/records/AssociatedRecords.tsx CreateChildRecordDialog (fixedValues) | REL-003, REL-008 | Done: only for associations, via "+ Add" |
| Associated child lists (childRecordList bound to an association) with View All link | material:src/qqq/pages/records/view/RecordView.tsx:750 (via widgets) | src/components/records/AssociatedRecords.tsx; src/lib/utils/association-utils.ts | REL-002, REL-004, REL-006, REL-007 | Done: Next also adds a "Related" tab for unbound associations |
| Record by unique key `/<table>/key?field=value` (EQUALS on each field, limit 2) with the three error messages | material:src/qqq/pages/records/view/RecordViewByUniqueKey.tsx:79-107 | src/app/(dashboard)/app/[slug]/key/page.tsx | NAV-023 | Done: redirects to the canonical record URL |
| Audit: GetAuditsForRecord process when available, else query audit + auditDetail | material:src/qqq/components/audits/AuditBody.tsx:211 | src/lib/api/audits.ts getAuditRecords/auditSource | REC-042, REC-043 | Done |
| Audit: limit 1000; distinct count gives "Showing first N of M audit details" | material:src/qqq/components/audits/AuditBody.tsx:374 | src/lib/api/audits.ts AUDIT_LIMIT=1000; src/components/records/AuditHistoryDialog.tsx countSentence | none | Partial: no truncation message or count request, so users aren't told the list is capped; #723 |
| Audit status sentences (none / only / only 2 / all N) | material:src/qqq/components/audits/AuditBody.tsx:368 | src/components/records/AuditHistoryDialog.tsx countSentence | REC-042 | Done |
| Audit 403: "You do not have permission to view audits"; otherwise "Error loading audits" | material:src/qqq/components/audits/AuditBody.tsx:269 | AuditHistoryDialog status | REC-043 | Done |
| Audit detail lines ("<field>: Changed from X to Y" / "Set to" / "Removed value" / message) | material:src/qqq/components/audits/AuditBody.tsx:108 | AuditHistoryDialog describeChange | REC-042 | Done: Next prefers the detail message over the computed text; Material does the reverse |
| Audit timestamp in viewer time zone, plus audit user display value | material:src/qqq/components/audits/AuditBody.tsx:470 | AuditHistoryDialog (formatDateTime, entry.user) | REC-042 | Done |
| Audits grouped by date under sticky headers (full weekday, "(Today)"/"(Yesterday)") | material:src/qqq/components/audits/AuditBody.tsx:340,456 | none (flat list) | none | Missing: flat list, no date groups; #723 |
| Audit sort toggle asc/desc, persisted in localStorage `audit.sortDirection` | material:src/qqq/components/audits/AuditBody.tsx:66,401 | none (always newest first) | REC-042 (desc only) | Missing: always newest first; #723 |
| Audit title "Audit for <label>: <recordLabel>"; Close button; Esc closes | material:src/qqq/components/audits/AuditBody.tsx:413; material:src/qqq/pages/records/view/RecordView.tsx:1051 | AuditHistoryDialog | REC-044 | Done: Radix also closes on backdrop click (Material blocked that) |
| Audit Old/New value table (fieldChangeMap) | material:src/qqq/components/audits/AuditBody.tsx:300 | none | none | N/A: dead code in Material (rows never populated) |
| Share: load current shares (getSharedRecords), "Current Shares (N)" | material:src/qqq/components/sharing/ShareModal.tsx:222,422 | src/components/sharing/ShareDialog.tsx; src/lib/api/sharing.ts | RPT-013, RPT-018 | Done |
| Share: searchable "User or Group" picker (audiencePossibleValueSourceName); audience type:id | material:src/qqq/components/sharing/ShareModal.tsx:395 | ShareDialog native `<select>` filled from one fetchPossibleValues call | RPT-013 | Partial: no search; options past the first page may never appear; #723 |
| Share: insertSharedRecord with default scope READ_ONLY | material:src/qqq/components/sharing/ShareModal.tsx:70,267 | ShareDialog handleShare + scope select | RPT-013 | Done |
| Share: edit scope (editSharedRecord) | material:src/qqq/components/sharing/ShareModal.tsx:191 (UI commented out) | ShareDialog per-share scope select | RPT-014 | Done: Next exposes a control Material had hidden |
| Share: remove a share (deleteSharedRecord) | material:src/qqq/components/sharing/ShareModal.tsx:301 | ShareDialog remove | RPT-015 | Done |
| Share: status and error text (Loading/Saving/Deleting; "Error sharing record: ...") | material:src/qqq/components/sharing/ShareModal.tsx:257-320 | ShareDialog change() | none | Done |
| Share modal ignores backdrop/Esc; "Done" button | material:src/qqq/components/sharing/ShareModal.tsx:133 | ShareDialog onInteractOutside prevented | none | Done |
| Record developer view: raw record values as JSON (getRecordDeveloperMode) | material:src/qqq/pages/records/view/RecordDeveloperView.tsx:104,168 | src/app/(dashboard)/app/[slug]/[recordId]/dev/page.tsx (plain getRecord for values; the developer endpoint feeds the associated scripts) | REC-054 | Partial: raw values come from the plain record GET, not the developer-mode response; #724 |
| Record developer view: associated-script fields with ScriptViewer, or "No script has been created..." + Create Script | material:src/qqq/pages/records/view/RecordDeveloperView.tsx:139,206 | src/app/(dashboard)/app/[slug]/[recordId]/dev/page.tsx; src/components/records/AssociatedScriptViewer.tsx | REC-054 | Done |
| Table developer view: API + version selectors (apis.json, versions.json, remembered in localStorage) | material:src/qqq/pages/records/developer/TableDeveloperView.tsx:73,121,154 | src/app/(dashboard)/app/[slug]/dev/page.tsx; src/components/records/TableApiDocs.tsx | REC-053 | Done: the sample has no qqq-middleware-api, so acceptance covers the no-API state; #738 |
| Table developer view: RapiDoc API docs and playground (openapi.json, auth, try-it, spec download) | material:src/qqq/pages/records/developer/TableDeveloperView.tsx:244; material:src/qqq/pages/records/developer/RapiDocReact.tsx | src/app/(dashboard)/app/[slug]/dev/page.tsx; src/components/records/TableApiDocs.tsx (rapidoc) | REC-053 | Done: the sample has no qqq-middleware-api, so acceptance covers the no-API state; #738 |
| "This table is not available in any APIs." | material:src/qqq/pages/records/developer/TableDeveloperView.tsx:240 | src/app/(dashboard)/app/[slug]/dev/page.tsx; src/components/records/TableApiDocs.tsx | REC-053 | Done |
| Create / edit / copy routes | material:src/App.tsx:312,352,359 | src/app/(dashboard)/app/[slug]/create/page.tsx; [recordId]/edit/page.tsx; [recordId]/copy/page.tsx | REC-006, REC-009, REC-013 | Done: Next adds full copy with associations (FullCopyDraft) |
| Form titles "Creating New X" / "Edit X: <label>" / "Copy X: <label>" in a header card with avatar | material:src/qqq/components/forms/EntityForm.tsx:957,993,1740 | src/components/forms/EntityForm.tsx heading "Create/Edit/Copy X"; page header "Edit X #id" | REC-044 | Partial: record label missing from edit/copy headings; no header card or avatar; #723 |
| Props overrideHeading / saveButtonLabel / saveButtonIcon / isModal / onSubmitCallback | material:src/qqq/components/forms/EntityForm.tsx:64 | EntityFormProps (overrideHeading, saveButtonLabel, isModal, onSuccess, onCancel) | REL-003 | Done: no saveButtonIcon (minor) |
| Not-allowed messages (no capability / no permission) for create, edit, copy | material:src/qqq/components/forms/EntityForm.tsx:980,1078-1093 | create/edit/copy pages (hasCapability / canInsertRecords / canEditRecords) | SEC-003, SEC-004, SEC-006, SEC-014 | Done |
| Edit prefill from record; copy omits the primary key | material:src/qqq/components/forms/EntityForm.tsx:960 | src/lib/utils/zod-from-metadata.ts defaultValuesFromRecord / defaultValuesForCopy | REC-009, REC-013 | Done: Next also handles copying passwords and files |
| Create defaults from field.defaultValue | material:src/qqq/components/forms/EntityForm.tsx:1007 | zod-from-metadata defaultValuesForCreate | REC-016, REC-023 | Done |
| Create defaults / disabled fields from props (defaultValues, disabledFields) | material:src/qqq/components/forms/EntityForm.tsx:150 | src/components/forms/EntityForm.tsx defaultValues, fixedValues, disabledFields; DynamicForm | REL-003, REL-008, REC-051 | Done: disabledFields presets shown locked |
| Defaults / disabled fields from the URL hash (`#/defaultValues={json}/disabledFields={json}`) | material:src/qqq/components/forms/EntityForm.tsx:160-190 | src/lib/utils/material-links.ts formPresetsFromHash; src/app/(dashboard)/app/[slug]/create/page.tsx | REC-050, REC-051 | Done |
| Display-value lookup for possible-value defaults (with other values as context) | material:src/qqq/components/forms/EntityForm.tsx:1021 | src/components/forms/PossibleValueSelect.tsx (lookup by `ids`) | REC-045 | Done: other form values as context are the dependent-filtering row (REC-052) |
| DATE_TIME initial values converted to local `yyyy-MM-ddTHH:mm` | material:src/qqq/components/forms/EntityForm.tsx:1105; material:src/qqq/utils/qqq/ValueUtils.tsx formatDateTimeValueForForm | src/lib/utils/datetime-utils.ts / zod-from-metadata | REC-018 | Done |
| Edit shows all fields (non-editable ones disabled); insert/copy shows only editable fields; empty sections dropped | material:src/qqq/components/forms/EntityForm.tsx:1159 | src/components/forms/DynamicForm.tsx (showReadOnlyFields=isEdit); DynamicFormField ReadOnlyFormField | REC-010 | Done |
| Form sections as cards with label | material:src/qqq/components/forms/EntityForm.tsx:417 | DynamicForm section blocks with SectionIcon + label | REC-047 | Done |
| Section help content in forms (INSERT_SCREEN/EDIT_SCREEN roles) | material:src/qqq/components/forms/EntityForm.tsx:1610 | none (DynamicForm renders no section help) | none | Missing: no section help in forms; #732 |
| Field help in forms (INSERT/EDIT/WRITE_SCREENS/ALL_SCREENS roles) | material:src/qqq/components/forms/DynamicForm.tsx:424 | src/components/forms/DynamicFormField.tsx FieldHelpTooltip | REC-039 | Done |
| Form sidebar (section links; hidden sections greyed via sectionVisibility) | material:src/qqq/components/forms/EntityForm.tsx:1672 | none | none | Missing: no form sidebar; #723 |
| T1 section fields inside the form header card | material:src/qqq/components/forms/EntityForm.tsx:1760 | none (all sections rendered the same way) | none | Missing: cosmetic; no form header card; #723 |
| Field gridColumns in forms (default half width; 12-grid values) | material:src/qqq/components/forms/DynamicForm.tsx:432 | DynamicForm (2-column grid; gridColumns 1/2 only) | none | Partial: twelfths such as 12/4/3 are ignored; #723 |
| Required mark " *" only when required and editable; Yup "<label> is required." | material:src/qqq/components/forms/DynamicFormUtils.ts:134,164 | field-types/* required asterisk; zod-from-metadata | REC-005, REC-047 | Done: Next can also show the asterisk on disabled fields (minor) |
| Type-to-input mapping: number, datetime-local, date, time, password, file, checkbox, text | material:src/qqq/components/forms/DynamicFormUtils.ts:85 | src/components/forms/DynamicFormField.tsx; field-types/* | REC-014, REC-015, REC-016, REC-017, REC-018, REC-020, REC-021, REC-022 | Done: Next adds a rich-text editor for HTML |
| displayFormat "$..." shows a $ prefix; "...%%" shows a % suffix on inputs | material:src/qqq/components/forms/DynamicFormField.tsx:101,105 | none (src/components/forms/field-types/NumberField.tsx) | none | Missing: no $ prefix or % suffix on inputs; #723 |
| Number inputs lose focus on mouse wheel so scrolling doesn't change the value | material:src/qqq/components/forms/DynamicFormField.tsx:125 | none | none | Missing: minor, but the wheel can change values by accident; #723 |
| TO_UPPER_CASE / TO_LOWER_CASE applied live as the user types (cursor kept) | material:src/qqq/components/forms/DynamicFormField.tsx:136; material:src/qqq/components/forms/DynamicFormUtils.ts:272 | none (backend normalizes on save) | REC-025 | Partial: only the saved value is normalized; no live transform; #723 |
| Enter in a text input does not submit the form | material:src/qqq/components/forms/DynamicFormField.tsx:291 | none (native submit on Enter) | none | Partial: behavior differs; unclear whether it matters to users; #723 |
| Boolean switch with clickable No/Yes and a null state | material:src/qqq/components/forms/BooleanFieldSwitch.tsx | src/components/forms/field-types/BooleanField.tsx (three-state) | REC-016 | Done |
| CODE_EDITOR in forms: Ace editor in languageMode, 300px | material:src/qqq/components/forms/DynamicFormField.tsx:230 | src/components/forms/ScriptEditor.tsx (textarea, language badge, Tab inserts spaces) | REC-031 | Partial: no syntax highlighting; #724 |
| File input: "Current File:" link + remove; button vs dragAndDrop format | material:src/qqq/components/forms/FileInputField.tsx:90,101,120 | src/components/forms/field-types/FileUploadField.tsx | REC-035, REC-022 | Done |
| FILE_UPLOAD `width` full/half | material:src/qqq/components/forms/DynamicForm.tsx:441 | none | none | Missing: minor; width ignored; #723 |
| BLOB submit: URL string omitted, File sent, null clears | material:src/qqq/components/forms/EntityForm.tsx:1323 | EntityForm onlyWhenChanged + src/lib/api/tables.ts recordFormData | REC-035, REC-022 | Done |
| DATE_TIME unchanged -> omitted; changed -> local converted to UTC | material:src/qqq/components/forms/EntityForm.tsx:1302 | EntityForm onlyWhenChanged; zod-from-metadata wireValuesFromForm | REC-018, REC-009 | Done |
| Possible-value select: async search, spinner, "No matches found", keyboard | material:src/qqq/components/forms/DynamicSelect.tsx:194,479 | src/components/forms/PossibleValueSelect.tsx | REC-045 | Done |
| Possible-value dependent filtering: other form values sent as `values` and useCase=form; options reload on open when other values changed | material:src/qqq/components/forms/DynamicSelect.tsx:194,271; material:src/qqq/components/forms/EntityForm.tsx:430 | src/components/forms/PossibleValueSelect.tsx; src/lib/api/possible-values.ts; src/lib/hooks/use-possible-values.ts | REC-052 | Done |
| inlinePossibleValueSource (enum inline) filtered client-side by label prefix | material:src/qqq/components/forms/DynamicFormUtils.ts:214; material:src/qqq/components/forms/DynamicSelect.tsx:177 | none | none | Missing: not rendered; whether the backend also sets possibleValueSourceName is unverified; #721 |
| CHIP adornment styles possible-value options | material:src/qqq/components/forms/DynamicSelect.tsx:372 | none | none | Missing: minor; options not chip-styled; #721 |
| Widget sub-validations merged into form validation (addSubValidations) | material:src/qqq/components/forms/EntityForm.tsx:629 | none | none | Missing: needed once form widgets exist; #722 |
| Update -> view with success; modal -> closeModalHandler | material:src/qqq/components/forms/EntityForm.tsx:1392 | EntityForm updateMutation | REC-009 | Done: Save disabled until the form is dirty (Material allowed saving anytime) |
| Create -> new record URL (copy replaces `/<id>/copy`) | material:src/qqq/components/forms/EntityForm.tsx:1437 | EntityForm insertMutation | REC-006, REC-013 | Done |
| Server error alert + scroll to top (modal: scroll to modalTopReference) | material:src/qqq/components/forms/EntityForm.tsx:1482 | EntityForm alert + toast | REC-048, REC-027 | Done |
| Scroll to the first validation error on submit | material:src/qqq/components/forms/EntityForm.tsx:1845 | react-hook-form shouldFocusError (default) | REC-005 | Done |
| Cancel -> back to view/list (history replace) | material:src/qqq/components/forms/EntityForm.tsx:1242 | EntityForm handleCancel | REC-008 | Done |
| Unsaved-changes guard | none in Material forms (only ScriptEditor beforeunload) | EntityForm beforeunload + src/components/forms/UnsavedChangesDialog.tsx | REC-008 | N/A: Next-only addition |
| "Save and create another" | none in Material | none | none | N/A: not a Material ability |
| Bulk-edit switches per field (bulkEditMode) | material:src/qqq/components/forms/DynamicFormField.tsx:331 | process area | PRC-029 | N/A: owned by the processes area |
| LINK adornment (toRecordFromTable, toRecordFromTableDynamic, target, http vs router link) | material:src/qqq/utils/qqq/ValueUtils.tsx:97 | src/lib/utils/adornment-utils.ts linkTarget; src/components/records/FieldValue.tsx | REC-028, REL-001 | Done |
| REVEAL: masked value, show/hide toggle, copy to clipboard ("Copied To Clipboard") | material:src/qqq/utils/qqq/ValueUtils.tsx:670,721 | FieldValue RevealField | REC-033 | Done |
| RENDER_HTML | material:src/qqq/utils/qqq/ValueUtils.tsx:170 | FieldValue SanitizedHtml (DOMPurify) | REC-032 | Done: Next sanitizes; Material didn't |
| CHIP adornment: color and icon per value | material:src/qqq/utils/qqq/ValueUtils.tsx:175 | FieldValue + adornment-utils chipStyle | REC-029 | Partial: icon only set as a `data-chip-icon` attribute, never drawn (REC-029 checks just that attribute); #723 |
| CODE_EDITOR view: read-only code, Format JSON/SQL toggle, Expand/Collapse, error shown 5 s | material:src/qqq/utils/qqq/ValueUtils.tsx:573 | FieldValue CodeViewer (`<pre>`, Format JSON only) | REC-031 | Partial: no SQL formatting, Expand/Collapse or highlighting; #723 |
| ERROR adornment (red with warning icon) | material:src/qqq/utils/qqq/ValueUtils.tsx:208 | FieldValue | REC-038 | Done |
| BLOB value: Open file / Download file (iframe POST download) | material:src/qqq/utils/qqq/ValueUtils.tsx:749; material:src/qqq/utils/HtmlUtils.ts | FieldValue FileLinks (base64 data URL) | REC-022 | Done: mechanics differ; relies on the native base64 BLOB value |
| FILE_DOWNLOAD adornment (downloadUrlDynamic; Open/Download) | material:src/qqq/utils/qqq/ValueUtils.tsx:256 | adornment-utils fileDownload; FieldValue | REC-034 | Done |
| Blob/file URL carries `?tableVariant=` | material:src/qqq/utils/qqq/ValueUtils.tsx:249 | none | none | Missing: record GETs send the variant (QRY-066), blob URLs don't; #722 |
| WIDGET adornment in view (field value used as widget data) | material:src/qqq/components/view/FieldValueAsWidget.tsx:44 | FieldValue -> WidgetRenderer | REC-037 | Done |
| DATE_TIME in viewer zone, or backend zoned display value | material:src/qqq/utils/qqq/ValueUtils.tsx:289 | FieldValue + src/lib/utils/datetime-utils.ts | REC-018, REC-019 | Done |
| DATE / TIME display values; BOOLEAN Yes/No | material:src/qqq/utils/qqq/ValueUtils.tsx:300-320 | FieldValue | REC-016, REC-017 | Done |
| Multi-line string values shown with line breaks (any string containing \n) | material:src/qqq/utils/qqq/ValueUtils.tsx:330 | FieldValue (pre-wrap for TEXT only) | REC-014 | Partial: a STRING with \n shows on one line; #723 |
| Version color avatars (DeveloperModeUtils.revToColor) | material:src/qqq/utils/DeveloperModeUtils.tsx | none | none | N/A: cosmetic |
| ChipTextField (paste values into chips) | material:src/qqq/components/forms/ChipTextField.tsx | query area | QRY-015 | N/A: only used by the query screen's FilterCriteriaPaster |
| MenuButton / TabPanel / DumpJsonBox / usePossibleValueLabels | material:src/qqq/components/buttons/MenuButton.tsx; material:src/qqq/components/misc/TabPanel.tsx; material:src/qqq/utils/DumpJsonBox.tsx; material:src/qqq/utils/usePossibleValueLabels.ts | n/a | none | N/A: internal helpers for the query and widget areas; nothing user-visible in records |
| Next-only additions (not required by Material): copy record ID, tabs/list toggle, record hover cards, back link with `from`, GET-time record errors/warnings, TOOLTIP adornment, URL/email auto-links, full copy with associations | none | RecordViewHeader, RecordHoverCard, FieldValue, FullCopyDraft | REC-036 | N/A: Next extras |

## Processes and reports

Process and report launch, the step lifecycle, process form fields, step components and bulk load. Merged in from other drafts: the dashboard process widget, process-step child-record editing and `frontendRecords`, the validation-review association grid and the process composite block set (widgets rows 7, 188, 189, 190, 113), and the QHierarchyAutoComplete field picker (shell row 170).

### Launch, routing, close

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Table-scoped report route `{table}/{report}` | `material:src/App.tsx:445-455` | src/lib/utils/material-links.ts:tableReportForSegment (matches a report by tableName, which the backend does not send) | NAV-034 | Partial: the backend report metadata (QFrontendReportMetaData) has no tableName, so a table-scoped report URL cannot resolve; #732 |
| Process runs as a modal over the query screen (`/table/process`), query stays behind | `material:src/App.tsx:369-381`; `material:src/qqq/pages/records/query/RecordQuery.tsx:1644-1670, 2790-2812, 3373-3378` | `src/components/query/RecordQuery.tsx:launchProcess` → full page `/app/{process}?recordsParam…` | PRC-005, NAV-034, NAV-035 | Done (different UX): runs as a full page that returns to the query |
| Process runs as a modal over a record view (`/table/id/process`) with `recordIds=[id]` | `material:src/App.tsx:383-388`; `material:src/qqq/pages/records/view/RecordView.tsx:362-375, 1016-1020, 1364-1368` | `src/components/records/RecordActions.tsx:234`, `src/components/records/RecordViewHeader.tsx:394` → `/app/{process}?recordIds=pk` | PRC-001, NAV-034, NAV-035 | Done (different UX): runs as a full page that returns to the record |
| Deep links in Material's URL shapes (`…/table/process`, `…/table/:id/process`) | `material:src/App.tsx:376-388` | `/app/{table}/{process}` and `/app/{table}/{id}/{process}` resolve to the process | NAV-034, NAV-035 | Done |
| Generic processes added to every query/view screen (`materialDashboard.processNamesToAddToAllQueryAndViewScreens`, deprecated `runRecordScript`) | `material:src/App.tsx:390-443`; `material:src/qqq/pages/records/view/RecordView.tsx:546-566` | src/lib/utils/process-utils.ts:getProcessesForTable, getRecordActionProcesses; src/lib/api/metadata.ts (supplementalInstanceMetaData) | PRC-048 | Done: deprecated runRecordScript fallback is Missing, tracked on #732 |
| Closing a query modal goes up one path and refreshes the grid (`updateTable`) | `material:src/qqq/pages/records/query/RecordQuery.tsx:1676-1691` | `src/components/process/ProcessRun.tsx:processReturnPath` → launching query; records refetch (staleTime 0 in `src/lib/hooks/use-record-query.ts`) | PRC-023, NAV-034, NAV-035 | Done: returns to the launching query |
| Closing a record modal returns to the record and reloads it | `material:src/qqq/pages/records/view/RecordView.tsx:1022-1041, 455-461` | `src/components/process/ProcessRun.tsx:processReturnPath` → launching record | NAV-034, NAV-035 | Done: returns to the launching record |
| Backdrop click / Escape don't close a modal process | `material:src/qqq/pages/records/query/RecordQuery.tsx:1678-1681` | — | none | N/A: no modal in Next |
| Selection passed as ids, full filter (filterJSON) or first-N subset | `material:src/qqq/pages/records/query/RecordQuery.tsx:1613-1670` | `src/components/query/RecordQuery.tsx:launchProcess` | PRC-002, PRC-003, PRC-005, QRY-031, QRY-032 | Done |
| min/max input records enforced before running | `material:src/qqq/pages/records/query/RecordQuery.tsx:1760-1780` | `src/components/process/ProcessRun.tsx:inputRecordBoundsMessage` | PRC-006 | Done: checked on the process page instead of as a query alert |
| Bulk load / edit / edit-with-file / delete launch, with "No records were selected…" alerts | `material:src/qqq/pages/records/query/RecordQuery.tsx:1697-1760` | query toolbar/menu (query area) | QRY-031, QRY-032, QRY-034 | Done: alert wording unverified |
| `recordIds` / `filterJSON` read from the URL on init | `material:src/qqq/pages/processes/ProcessRun.tsx:1822-1832` | `src/app/(dashboard)/app/[slug]/page.tsx:202-209` | PRC-001, PRC-002 | Done |
| `recordIds` prop as an id array or a QQueryFilter | `material:src/qqq/pages/processes/ProcessRun.tsx:1838-1850` | `src/lib/api/processes.ts:processInit` (`recordsParam`) | PRC-005 | Done |
| `defaultProcessValues` JSON from the URL merged with prop defaults | `material:src/qqq/pages/processes/ProcessRun.tsx:1899-1919` | `src/app/(dashboard)/app/[slug]/page.tsx:212-219` + `src/components/process/ProcessRun.tsx` request merge | PRC-043 | Done |
| `tableName` sent on init | `material:src/qqq/pages/processes/ProcessRun.tsx:1921-1924` | `src/components/process/ProcessRun.tsx` request `tableName` | PRC-005 | Done |
| `tableVariant` (from localStorage) sent on init and every step | `material:src/qqq/pages/processes/ProcessRun.tsx:1852-1856, 2026-2030` | `src/lib/api/processes.ts` sends `tableVariant` on init and every step | QRY-066 | Done |
| Process widget mode (isWidget): no stepper, no Cancel, widget layout, reload hidden, `forceReInit` on widget reload | `material:src/qqq/pages/processes/ProcessRun.tsx:2132-2136, 2165-2174, 2279, 2326-2332`; `material:src/qqq/components/widgets/DashboardWidgets.tsx:623-637` | `src/components/widgets/QqqContainerWidgets.tsx:QqqProcessWidget` renders the full `ProcessRun` | WID-021, WID-061 | Partial: stepper shown, Cancel/Return navigate away, reload not hidden, no re-init; #725 |
| Report runs through its process with `overrideLabel`, isReport and `{reportName}` | `material:src/qqq/pages/processes/ReportRun.tsx:34-58` | `src/components/reports/ReportRun.tsx` + `src/lib/api/reports.ts:startReport` | RPT-001, RPT-002, RPT-003 | Done: rebuilt as a custom page |
| Report input fields (`inputFieldList`) in a full dynamic form (PV fields, types) | `material:src/qqq/pages/processes/ProcessRun.tsx:1164-1171, 1290-1319` | `src/components/reports/ReportRun.tsx` input form (text/number/date inputs, required check) | RPT-006 | Partial: no PV dropdowns, booleans or rich field types; #727 |
| Report output format choice | backend step fields (Material source unverified) | `src/components/reports/ReportRun.tsx:FORMAT_OPTIONS` CSV/XLSX/JSON | RPT-001, RPT-002, RPT-003 | Done: list is hardcoded; #727 |
| Report download | `material:src/qqq/pages/processes/ProcessRun.tsx:304-349` via DOWNLOAD_FORM | `src/components/reports/ReportRun.tsx` done-state link (`src/lib/api/reports.ts:reportDownloadUrl`) | RPT-001 | Done: serverFilePath only; storageReference downloads #727 |
| Report with other intermediate frontend steps | generic steps in `material:src/qqq/pages/processes/ProcessRun.tsx` | `src/lib/api/reports.ts:reportStateFromResponse` → "The report did not produce a file." | none | Partial: only input and download steps supported; #727 |
| Report error and permission wording | `material:src/qqq/pages/processes/ProcessRun.tsx:597, 1802` | `src/components/reports/ReportRun.tsx` error state + `permitted` check | RPT-007 | Done |
| App-home process/report cards with permission-disabled text | `material:src/qqq/components/processes/ProcessLinkCard.tsx:47-112`; `material:src/qqq/pages/apps/Home.tsx:358-410` | `src/components/widgets/AppHome.tsx:EntryGroup` | NAV-008, SEC-008 | Done |

### Lifecycle, screens, buttons

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Load instance/process/table metadata, with load-error messages | `material:src/qqq/pages/processes/ProcessRun.tsx:1858-1897` | `src/app/(dashboard)/app/[slug]/page.tsx` ("Failed to load process metadata.") | none | Done |
| Init, then handle JobComplete / Started / Running / Error | `material:src/qqq/pages/processes/ProcessRun.tsx:1595-1740` | `src/lib/hooks/use-process.ts:handle` | PRC-001, PRC-019 | Done |
| Async polling: 1.5 s, ×1.5 backoff to 12 s on 5xx, then "Could not connect to server" | `material:src/qqq/pages/processes/ProcessRun.tsx:98-100, 1745-1795` | `src/lib/hooks/use-process.ts` pollRef / POLL_* | PRC-019 | Done |
| Working screen: spinner, message, "N of M", progress bar, "Updated at" | `material:src/qqq/pages/processes/ProcessRun.tsx:631-670` | `src/components/process/ProcessRun.tsx` working block | PRC-019 | Done |
| Loading shown before the first step | `material:src/qqq/pages/processes/ProcessRun.tsx:631, 2079` | `src/components/process/ProcessRun.tsx` (phase ≠ step) | PRC-040 | Done |
| userFacingError vs internal error | `material:src/qqq/pages/processes/ProcessRun.tsx:1720-1734` | `src/lib/hooks/use-process.ts` ERROR case | PRC-021 | Done |
| Error screen: "An error occurred…", show/hide detail toggle, Close/Cancel | `material:src/qqq/pages/processes/ProcessRun.tsx:589-629` | `src/components/process/ProcessErrorState.tsx` | PRC-021, PRC-022 | Done: Next adds Retry |
| 403 → "You do not have permission to run this process/report." | `material:src/qqq/pages/processes/ProcessRun.tsx:1798-1806` | `src/lib/api/processes.ts:251`; `src/app/(dashboard)/app/[slug]/page.tsx` processDenied | PRC-042, SEC-007, SEC-008 | Done |
| "Unknown process step X." | `material:src/qqq/pages/processes/ProcessRun.tsx:1208-1212` | `src/lib/hooks/use-process.ts` | none | Done |
| `updatedFrontendStepList` replaces the step list | `material:src/qqq/pages/processes/ProcessRun.tsx:1616-1621` | `src/lib/hooks/use-process.ts` COMPLETE | PRC-017 | Done |
| `updatedFields` merged across screens | `material:src/qqq/pages/processes/ProcessRun.tsx:1537-1571, 1626` | `src/lib/hooks/use-process.ts:applyUpdatedFields` | PRC-018 | Done: doesn't patch `inputFieldList` (see the `inputFieldList` row) |
| Back to `backStep` with `isStepBack=true` | `material:src/qqq/pages/processes/ProcessRun.tsx:1684, 1943-1966, 2284` | `src/lib/hooks/use-process.ts:back`; `src/components/process/ProcessStepScreen.tsx` Back | PRC-016 | Done |
| Submit with sub-form pre-submit callbacks (can block, can add values) | `material:src/qqq/pages/processes/ProcessRun.tsx:726-757, 1992-2063` | `src/components/process/ProcessStepScreen.tsx:submitValues` + `src/components/process/ProcessStepContext.tsx` contributors | PRC-009, PRC-031 | Done |
| State cleared before hitting the backend ("Working...") | `material:src/qqq/pages/processes/ProcessRun.tsx:2069-2087` | `src/lib/hooks/use-process.ts:submit` | PRC-019 | Done |
| Cancel calls `processCancel` then leaves | `material:src/qqq/pages/processes/ProcessRun.tsx:2093-2113` | `src/components/process/ProcessRun.tsx:cancelAndLeave` + `src/components/process/ProcessCancelDialog.tsx` | PRC-020 | Done: Next adds a confirm and mid-job cancel |
| Next vs Submit label (last LINEAR step, or overridden) | `material:src/qqq/pages/processes/ProcessRun.tsx:179-196, 2179-2196` | `src/components/process/ProcessStepScreen.tsx` `isSubmitLabel` | PRC-023, PRC-026 | Done |
| `noMoreSteps` → only Return/Close | `material:src/qqq/pages/processes/ProcessRun.tsx:201-212, 2267-2273` | `src/components/process/ProcessStepScreen.tsx` Return | PRC-023 | Done: no modal "Close" variant |
| Buttons disabled while submitting | `material:src/qqq/pages/processes/ProcessRun.tsx:2272, 2285, 2290` | `src/components/process/ProcessStepScreen.tsx` `disabled={isWorking}` | none | Done |
| LINEAR stepper with step labels | `material:src/qqq/pages/processes/ProcessRun.tsx:2221-2236` | `src/components/process/StepWizard.tsx` | PRC-024 | Done |
| State-machine flow: no stepper, repeated screens | `material:src/qqq/pages/processes/ProcessRun.tsx:193, 2221` | `src/components/process/ProcessRun.tsx` showWizard + screenInstance | PRC-045 | Done |
| Page header = overrideLabel ?? process label | `material:src/qqq/pages/processes/ProcessRun.tsx:1187-1190` | `src/app/(dashboard)/app/[slug]/page.tsx` setPageHeader | NAV-014 | Done |
| Step title (modal shows "Process: Step") | `material:src/qqq/pages/processes/ProcessRun.tsx:774-779` | `src/components/process/ProcessStepScreen.tsx` heading | PRC-007 | Done: modal variant N/A |
| Scanner format: no heading, no action bar | `material:src/qqq/pages/processes/ProcessRun.tsx:765, 774, 2262` | `src/components/process/ProcessStepScreen.tsx` isScanner | PRC-044 | Done |
| Step help content (PROCESS_SCREEN / ALL_SCREENS roles; shown in help-authoring mode) | `material:src/qqq/pages/processes/ProcessRun.tsx:762-786` | `src/components/process/ProcessStepScreen.tsx:StepHelp` | PRC-015 | Done: no help-authoring (helpHelpActive) mode; #732 |
| Floating form-error alert | `material:src/qqq/pages/processes/ProcessRun.tsx:2312` | per-component error text (e.g. `src/components/process/BulkEditFormComponent.tsx`) | PRC-029 | Done |
| Form reset per screen (touched cleared) | `material:src/qqq/pages/processes/ProcessRun.tsx:1216-1219, 2200` | `src/components/process/ProcessStepScreen.tsx` keyed by screenInstance | none | Done |
| Enter submits the step | `material:src/qqq/pages/processes/ProcessRun.tsx:2218` (Formik Form) | `src/components/process/ProcessStepScreen.tsx` `<form onSubmit>` | INT-002 | Done |
| Form `autoComplete="off"` | `material:src/qqq/pages/processes/ProcessRun.tsx:2218` | none | none | Missing: browser autofill can appear; #725 |
| `inputFieldList` from process values added to any step's form | `material:src/qqq/pages/processes/ProcessRun.tsx:1152-1174, 1290` | `src/components/process/ProcessStepScreen.tsx:screenFields` ignores it (reports only) | none | Partial: generic processes using `inputFieldList` show no inputs; #725 |
| Reload mid-process starts fresh | `material:src/qqq/pages/processes/ProcessRun.tsx:1814-1937` | `src/components/process/ProcessRun.tsx` startedRef | PRC-040 | Done |
| Expired session → sign-in | Client 401 handling in `material:src/qqq/utils/qqq/Client.ts` | global 401 handler; `src/lib/hooks/use-process.ts` ignores 401 | PRC-041 | Done |
| Run with no frontend screens | (Material would hit "Unknown step") | `src/components/process/ProcessRun.tsx` complete → `src/components/process/ProcessResultStep.tsx` | PRC-047 | Done: Next-specific completion screen |

### Form fields

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Metadata validation (required etc.) | `material:src/qqq/pages/processes/ProcessRun.tsx:1293, 1396` | `src/components/process/ProcessStepScreen.tsx` zod schema | PRC-010 | Done |
| Process PV fields; label shown for backend-set values | `material:src/qqq/pages/processes/ProcessRun.tsx:690-713, 1645-1672` | `src/components/forms/PossibleValueSelect.tsx` (process context, id lookup) | PRC-011 | Done |
| PV dependent filters (`otherValues` sent with the search) | `material:src/qqq/pages/processes/ProcessRun.tsx:714-719, 1321-1334` | src/components/process/ViewFormComponent.tsx; src/lib/api/possible-values.ts sends the other screen values with the search | REC-052, PRC-049 | Done |
| File upload inputs sent multipart | `material:src/qqq/pages/processes/ProcessRun.tsx:2017-2024` | `src/components/process/ProcessStepScreen.tsx` files; `src/components/process/process-values.ts:isFileField`; `src/lib/api/processes.ts:buildFormData` | PRC-031 | Done |
| Field-level help in process forms (`process:` help key) | `material:src/qqq/pages/processes/ProcessRun.tsx:950-953` | `src/components/forms/DynamicFormField.tsx` helpContents | none | Partial: `src/components/process/EditFormComponent.tsx` passes no helpRoles (effect unverified); #725 |

### Components

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| HELP_TEXT with line breaks and previewText toggle | `material:src/qqq/pages/processes/ProcessRun.tsx:820-839` | `src/components/process/HelpTextComponent.tsx` | PRC-008 | Done |
| EDIT_FORM `includeFieldNames` subset | `material:src/qqq/pages/processes/ProcessRun.tsx:804-815` | `src/components/process/EditFormComponent.tsx` | PRC-009 | Done |
| EDIT_FORM `sectionLabel` card | `material:src/qqq/pages/processes/ProcessRun.tsx:943-953` | `src/components/process/EditFormComponent.tsx` | PRC-009 | Done |
| VIEW_FORM (ERROR-adornment fields show the message only) | `material:src/qqq/pages/processes/ProcessRun.tsx:958`; `material:src/qqq/components/processes/ProcessViewForm.tsx:40-68` | `src/components/process/ViewFormComponent.tsx` | PRC-012 | Done |
| DOWNLOAD_FORM (filePath or storageTableName+storageReference) | `material:src/qqq/pages/processes/ProcessRun.tsx:304-349, 963-980` | `src/components/process/DownloadFormComponent.tsx` + `src/lib/api/processes.ts:processDownloadUrl` | PRC-014 | Done: GET anchor instead of POST; no "Error downloading file" |
| HTML `{step}.html` | `material:src/qqq/pages/processes/ProcessRun.tsx:1050-1056` | `src/components/process/HtmlComponent.tsx` (DOMPurify) | PRC-013, PRC-034 | Done |
| RECORD_LIST server paging 10/25/50, "x–y of z" | `material:src/qqq/pages/processes/ProcessRun.tsx:264-282, 1018-1047, 1414-1507` | `src/components/process/RecordListComponent.tsx` | PRC-025, PRC-001 | Done |
| Validation review "Input: N X records." | `material:src/qqq/components/processes/ValidationReview.tsx:200` | `src/components/process/ValidationReviewComponent.tsx` | PRC-026 | Done |
| Validate-or-skip radio drives Next/Submit | `material:src/qqq/components/processes/ValidationReview.tsx:209-251`; `material:src/qqq/pages/processes/ProcessRun.tsx:992-1003, 1254-1268` | `src/components/process/ValidationReviewComponent.tsx` fieldset | PRC-026 | Done: tooltips became inline text |
| "Validation complete on N" + validationSummary lines | `material:src/qqq/components/processes/ValidationReview.tsx:255-272` | `src/components/process/ValidationReviewComponent.tsx` + `src/components/process/ProcessSummaryLines.tsx` | PRC-027 | Done |
| Preview panel: previewMessage, "No record previews…", Loading, Prev/Next "Preview i of n" | `material:src/qqq/components/processes/ValidationReview.tsx:275-367` | `src/components/process/ValidationReviewComponent.tsx` | PRC-026 | Done: explanatory tooltips dropped |
| Preview formatted with a table layout (sections) | `material:src/qqq/components/processes/ValidationReview.tsx:340-349, 394-418` | `src/components/process/ValidationReviewComponent.tsx:PreviewRecord` | PRC-031 | Done |
| Preview association child grids for each record (`previewRecordAssociated*`) | `material:src/qqq/components/processes/ValidationReview.tsx:103-133, 419-455` | none | none | Missing: child records not shown in the bulk-load preview; #725 |
| PROCESS_SUMMARY_RESULTS: count, lines, red header on ERROR, process icon | `material:src/qqq/components/processes/ProcessSummaryResults.tsx:52-107` | `src/components/process/ProcessSummaryResultsComponent.tsx` | PRC-028 | Done: process icon omitted; #725 |
| Summary-line status colors/icons (check vs arrow) | `material:src/qqq/models/processes/ProcessSummaryLine.tsx:167-209` | `src/components/process/ProcessSummaryLines.tsx:StatusIcon` | PRC-027 | Done |
| Summary link line (recordId or filter; pre/link/post text) | `material:src/qqq/models/processes/ProcessSummaryLine.tsx:86-104` | `src/components/process/ProcessSummaryLines.tsx` | PRC-027 | Done |
| "See these records in a new tab" (primaryKeys IN, ≤2048 chars) | `material:src/qqq/models/processes/ProcessSummaryLine.tsx:106-150, 211-244` | `src/components/process/ProcessSummaryLines.tsx:summaryRecordsHref` | PRC-027 | Done |
| bulletsOfText | `material:src/qqq/models/processes/ProcessSummaryLine.tsx:150` | `src/components/process/ProcessSummaryLines.tsx` | PRC-027 | Done |
| BULK_EDIT_FORM enable switches, `bulkEditEnabledFields`, "must edit at least one field" | `material:src/qqq/pages/processes/ProcessRun.tsx:1339-1349, 1433-1460, 2032-2050` | `src/components/process/BulkEditFormComponent.tsx` | PRC-029 | Done |
| Bulk edit grouped by sections with sidebar; "no editable fields" alert | `material:src/qqq/pages/processes/ProcessRun.tsx:842-937` | `src/components/process/BulkEditFormComponent.tsx:groupBySection` | PRC-029 | Partial: no section sidebar; #725 |
| nonDistinctPVSFields warning | `material:src/qqq/pages/processes/ProcessRun.tsx:851-872` | `src/components/process/BulkEditFormComponent.tsx` | none | Done |
| Bulk-edit PVs use the table | `material:src/qqq/pages/processes/ProcessRun.tsx:898-902, 1304` | `src/components/process/BulkEditFormComponent.tsx` possibleValueContext | PRC-029 | Done |
| Google Drive folder via Google Picker (OAuth, shared drives, folder-only) | `material:src/qqq/pages/processes/ProcessRun.tsx:1012-1016, 1270-1275`; `material:src/qqq/components/processes/GoogleDriveFolderPicker.tsx`; `material:src/qqq/components/processes/GoogleDriveFolderPickerWrapper.tsx` | `src/components/process/GoogleDriveFolderComponent.tsx` (disabled button) | PRC-039 | Missing: stub only; #704 |
| Drive screen's other components still work | `material:src/qqq/pages/processes/ProcessRun.tsx:1270-1275` | `src/components/process/GoogleDriveFolderComponent.tsx` passes values through | PRC-038 | Done |
| Named WIDGET fetched with processUUID + values | `material:src/qqq/pages/processes/ProcessRun.tsx:355-409` | `src/components/process/WidgetComponent.tsx:NamedWidget/widgetParams` | PRC-035 | Done |
| Widget seeded from `processValues[widgetName]` | `material:src/qqq/pages/processes/ProcessRun.tsx:382-387` | `src/components/process/WidgetComponent.tsx` NamedWidget seeded | PRC-036 | Done |
| childRecordList widget in a process: add, edit and delete child rows in memory, posted as `frontendRecords` | `material:src/qqq/pages/processes/ProcessRun.tsx:369-398, 462-467, 1483-1486, 1513-1531, 2057-2060`; `material:src/qqq/components/widgets/DashboardWidgets.tsx:333-471, 1005-1020` | `src/components/process/WidgetComponent.tsx:83` read-only (`src/components/widgets/WidgetRenderer.tsx` gets no actionCallback) | none | Missing: no in-memory child edits, no `frontendRecords`; #725 |
| rowBuilder widget writes process values | `material:src/qqq/pages/processes/ProcessRun.tsx:399-402, 473-482` | none | none | Missing: rowBuilder values not written to the process; #725 |
| Ad hoc composite WIDGET | `material:src/qqq/pages/processes/ProcessRun.tsx:552-573, 1071` | `src/components/process/WidgetComponent.tsx` + `src/components/process/ProcessBlocks.tsx` | PRC-037 | Done |
| Widget config errors (no name / unrecognized name) | `material:src/qqq/pages/processes/ProcessRun.tsx:358-361, 1078-1080` | `src/components/process/WidgetComponent.tsx` | none | Done |
| Conditional blocks hidden | `material:src/qqq/pages/processes/ProcessWidgetBlockUtils.tsx:117-133` | `src/components/process/ProcessBlocks.tsx:isVisible` | PRC-037 | Done |
| TEXT `${field}` interpolation | `material:src/qqq/pages/processes/ProcessWidgetBlockUtils.tsx:157-172` | `src/components/process/ProcessBlocks.tsx` TEXT | PRC-037 | Done |
| INPUT_FIELD block value seeded and joins the form | `material:src/qqq/pages/processes/ProcessWidgetBlockUtils.tsx:144-156, 206-243`; `material:src/qqq/pages/processes/ProcessRun.tsx:1277-1285` | `src/components/process/ProcessStepScreen.tsx:screenFields` + `src/components/process/ProcessBlocks.tsx` INPUT_FIELD | PRC-037 | Done: always a plain text input; #725 |
| INPUT_FIELD submitOnEnter; "->code" typed shortcut submits an actionCode | `material:src/qqq/components/widgets/blocks/InputFieldBlock.tsx:70-110` | `src/components/process/ProcessBlocks.tsx` onKeyDown | PRC-044, PRC-037 | Partial: no "->" handling; #725 |
| BUTTON actionCode submits | `material:src/qqq/pages/processes/ProcessRun.tsx:519-523` | `src/components/process/ProcessBlocks.tsx` BUTTON | PRC-037 | Done |
| BUTTON controlCode show/hide/toggle a modalMode composite; registerControlCallback | `material:src/qqq/pages/processes/ProcessRun.tsx:415-456, 493-498`; `material:src/qqq/components/widgets/CompositeWidget.tsx:168-210` | `src/components/process/ProcessBlocks.tsx:applyControlCode` (toggles visibility) | none | Partial: no modal composites; #725 |
| Full block set in process composites (AUDIO, IMAGE, BIG_NUMBER, NUMBER_ICON_BADGE, PROGRESS_BAR, ICON…) plus layouts/styles | `material:src/qqq/pages/processes/ProcessRun.tsx:566-568` → `material:src/qqq/components/widgets/CompositeWidget.tsx` + `material:src/qqq/components/widgets/blocks/*` | `src/components/process/ProcessBlocks.tsx:97-191` handles COMPOSITE/TEXT/BUTTON/INPUT_FIELD/DIVIDER; others render as text | none | Partial: no layouts or styles; doesn't reuse `src/components/widgets/blocks/QqqComposite.tsx`; scanner AUDIO beeps lost; #725 |
| `isActionCodeValid` | `material:src/qqq/pages/processes/ProcessWidgetBlockUtils.tsx:39-110` | — | none | N/A: its use is commented out (`material:src/qqq/pages/processes/ProcessRun.tsx:503-517`) |

### Bulk load

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| File details (name, N columns) + preview grid with letters, row numbers, count badges | `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:302-316, 461, 539-693` | `src/components/process/BulkLoadFileMappingComponent.tsx` | PRC-031 | Done |
| Column tooltip of mapped fields; duplicate-header warning | `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:623-667` | none (`src/components/process/bulk-load-models.ts:382-398` computes dupes, never shown) | none | Missing: no column tooltip or duplicate-header warning; #726 |
| Header-row toggle re-maps by header name, with dupe warnings | `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:364-371`; `material:src/qqq/models/processes/BulkLoadModels.ts:653-700` | `src/components/process/BulkLoadFileMappingComponent.tsx` checkbox only flips the flag | none | Partial: toggle doesn't re-map by header name; #726 |
| Layout FLAT/TALL/WIDE (TALL/WIDE only with associations), required | `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:127, 318-332` | `src/components/process/BulkLoadFileMappingComponent.tsx` LAYOUTS + `src/components/process/bulk-load-models.ts:switchLayout` | PRC-031, PRC-032 | Done |
| Bulk-edit key fields (tableKeyFields PVS); "key fields are not mapped" error | `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:336-360, 386-438` | `src/components/process/BulkLoadFileMappingComponent.tsx` key fields select moves fields to required | PRC-033 | Partial: no unmapped-key error; #726 |
| Section headings: Key Fields / Fields To Update; empty-state text | `material:src/qqq/components/processes/BulkLoadFileMappingFields.tsx:258-282` | `src/components/process/BulkLoadFileMappingComponent.tsx` always "Additional Fields"; no empty text | PRC-031, PRC-033 | Partial: wording differs for bulk edit; no empty text; #726 |
| Add Fields hierarchy menu (QHierarchyAutoComplete: association groups, search, WIDE repeats, tooltips) | `material:src/qqq/components/processes/BulkLoadFileMappingFields.tsx:83-160, 199-230, 297`; `material:src/qqq/components/misc/QHierarchyAutoComplete.tsx:94-795`; `material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:886` | `src/components/process/BulkLoadFileMappingComponent.tsx:355-367` "Add Field" select + `src/components/process/bulk-load-models.ts` addField (WIDE index) | PRC-031 | Partial: plain select, no search, groups or tooltips; #726 |
| Remove an additional field | `material:src/qqq/components/processes/BulkLoadFileMappingFields.tsx:143`; `material:src/qqq/components/processes/BulkLoadFileMappingField.tsx:258` | `src/components/process/BulkLoadFileMappingComponent.tsx` MappedFieldRow onRemove | PRC-031 | Done |
| Column vs default value; Map values; Clear if empty; Preview values | `material:src/qqq/components/processes/BulkLoadFileMappingField.tsx:270-335` | `src/components/process/BulkLoadFileMappingComponent.tsx` MappedFieldRow | PRC-031, PRC-033 | Done |
| Default value uses a typed field (PV with label lookup, date, boolean) | `material:src/qqq/components/processes/BulkLoadFileMappingField.tsx:84-120, 298` | `src/components/process/BulkLoadFileMappingComponent.tsx` plain text/number input | none | Partial: default value is a plain text/number input; #726 |
| Field errors ("You must select a column.", "A value is required.") + scroll to first error | `material:src/qqq/models/processes/BulkLoadModels.ts:444, 463`; `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:159` | `src/components/process/bulk-load-models.ts:toProfile` + row errors | PRC-032 | Done: no scroll to the first error; #726 |
| Pre-submit checks (layout, header row, key fields, ≥1 field) and profile values submitted | `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:98-157` | `src/components/process/BulkLoadFileMappingComponent.tsx` useSubmitContributor + profileSubmitValues | PRC-031, PRC-032 | Done |
| Per-field help (hasHeaderRow, layout, tableKeyFields) | `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:443-457` | none | none | Missing: no per-field help; #726 |
| Step label "File Mapping / {profile}" | `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:225` | `src/components/process/BulkLoadFileMappingComponent.tsx` setStepLabel | PRC-046 | Done |
| Value mapping rows, "Value Mapping: X (i of n)", required error, mappedValuesJSON | `material:src/qqq/components/processes/BulkLoadValueMappingForm.tsx:120-203`; `material:src/qqq/pages/processes/ProcessRun.tsx:1355-1387` | `src/components/process/BulkLoadValueMappingComponent.tsx` | PRC-031 | Done |
| Value-mapping PV is a searchable autocomplete with initial labels | `material:src/qqq/pages/processes/ProcessRun.tsx:1370-1382` | `src/components/process/BulkLoadValueMappingComponent.tsx` select of the first page of table PVs, no search | PRC-031 | Partial: no search; large PV sources are unusable; #726 |
| BULK_LOAD_PROFILE_FORM on review/result | `material:src/qqq/components/processes/BulkLoadProfileForm.tsx` | `src/components/process/BulkLoadProfileComponent.tsx` | PRC-046 | Done |
| Profiles listed as "yours" vs "shared with you" | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:137-165, 511-525` | `src/components/process/SavedBulkLoadProfiles.tsx` one select | PRC-046 | Partial: one list, no yours/shared grouping; #726 |
| Choose a profile to apply its mapping | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:171-184` | `src/components/process/SavedBulkLoadProfiles.tsx` select | PRC-046 | Done |
| Save / Save As, "Profile Saved.", duplicate-name error | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:198-206, 272-310` | `src/components/process/SavedBulkLoadProfiles.tsx` Save / Save As | PRC-046 | Done |
| Rename profile | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:222-228, 467` | none | none | Missing: no rename; #726 |
| Delete profile with confirm | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:229, 250` | `src/components/process/SavedBulkLoadProfiles.tsx` Delete… confirm | PRC-046 | Done |
| "Update existing profile?" confirm | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:773` | `src/components/process/SavedBulkLoadProfiles.tsx` saves directly | none | Partial: saves without the update confirm; #726 |
| New / Empty mapping | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:208, 500, 663` | `src/components/process/SavedBulkLoadProfiles.tsx` "New bulk load profile" option restores the suggested mapping | none | Partial: no empty mapping; #726 |
| Reset to Suggested Mapping | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:215`; `material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:194` | only indirectly (the "New bulk load profile" option) | none | Partial: no direct reset action; #726 |
| Unsaved-changes count + diff tooltip; Reset All Changes | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:674-695`; `material:src/qqq/utils/qqq/SavedBulkLoadProfileUtils.ts:265` | none | none | Missing: no change count, diff or reset; #726 |
| Non-owner can't save/rename/delete | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:414-421` | none | none | Missing: no ownership check; #726 |
| Gated by the store/query/delete processes existing | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:395-398` | `src/components/process/SavedBulkLoadProfiles.tsx` canStore / canQuery / canDelete | PRC-046 | Done |
| Enter in the save dialog saves (not in delete) | `material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:708-723` | `src/components/process/SavedBulkLoadProfiles.tsx` inline name input inside the step `<form>` | none | Partial: Enter likely submits the whole step form (unverified); #726 |

## Widgets and blocks

Dashboard and record-view widgets: widget types, dashboard layout and data flow, widget chrome and dropdowns, composite blocks, statistics and charts, table and child-record widgets, and the setup and developer widgets (row builder, script viewer, filter and pivot setup, cron, data bag, dynamic form). The Material sources of the records draft's script viewer/editor and data bag rows are merged into groups K and O.

### A. Widget types (DashboardWidgets switch)

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| parentWidget | material:src/qqq/components/widgets/DashboardWidgets.tsx:535-547 | src/components/widgets/WidgetRenderer.tsx:178 → src/components/widgets/QqqContainerWidgets.tsx:QqqParentWidget | WID-022 | Done |
| alert: severity from alertType, HTML, bullet list; hidden with no html or with hideWidget | material:src/qqq/components/widgets/DashboardWidgets.tsx:550-571 | src/components/widgets/QqqDisplayWidgets.tsx:QqqAlertWidget; src/components/widgets/ConnectedWidget.tsx:209-212 | WID-001, WID-063 | Done |
| usaMap | material:src/qqq/components/widgets/DashboardWidgets.tsx:574-581; material:src/qqq/components/widgets/misc/USMapWidget.tsx | src/components/widgets/QqqDisplayWidgets.tsx:QqqUsaMapWidget | WID-020 | Done: Basemap is a separate row (group F) |
| table | material:src/qqq/components/widgets/DashboardWidgets.tsx:584-591; material:src/qqq/components/widgets/tables/TableWidget.tsx | src/components/widgets/QqqTableWidget.tsx:QqqTableWidget | WID-019 | Done: Table features in group H |
| multiTable: one full TableWidget card per tableDataList entry | material:src/qqq/components/widgets/DashboardWidgets.tsx:594-606 | src/components/widgets/QqqTableWidget.tsx:QqqMultiTableWidget | WID-013 | Partial: Sub-tables have no export button or footerHTML of their own; #728 |
| stackedBarChart | material:src/qqq/components/widgets/DashboardWidgets.tsx:608-620; material:src/qqq/components/widgets/charts/StackedBarChart.tsx | src/components/widgets/QqqChartWidget.tsx (variant stackedBar) | WID-017 | Done |
| stepper | material:src/qqq/components/widgets/DashboardWidgets.tsx:640-655; material:src/qqq/components/widgets/misc/StepperCard.tsx | src/components/widgets/QqqDisplayWidgets.tsx:QqqStepperWidget | WID-018 | Done |
| html (skeleton until html arrives) | material:src/qqq/components/widgets/DashboardWidgets.tsx:658-677 | src/components/widgets/QqqDisplayWidgets.tsx:QqqHtmlWidget | WID-008 | Done |
| smallLineChart | material:src/qqq/components/widgets/DashboardWidgets.tsx:680-688; material:src/qqq/components/widgets/charts/linechart/SmallLineChart.tsx | src/components/widgets/QqqChartWidget.tsx (smallLine) | WID-010 | Done |
| statistics | material:src/qqq/components/widgets/DashboardWidgets.tsx:691-707; material:src/qqq/components/widgets/statistics/StatisticsCard.tsx | src/components/widgets/QqqStatisticsWidgets.tsx:QqqStatisticsWidget | WID-016 | Done |
| multiStatistics | material:src/qqq/components/widgets/DashboardWidgets.tsx:710-716; material:src/qqq/components/widgets/statistics/MultiStatisticsCard.tsx | src/components/widgets/QqqStatisticsWidgets.tsx:MultiStatisticsWidget | WID-012 | Done |
| quickSightChart (iframe of the payload URL) | material:src/qqq/components/widgets/DashboardWidgets.tsx:719-721; material:src/qqq/components/widgets/misc/QuickSightChart.tsx:44-58 | src/components/widgets/QqqDisplayWidgets.tsx:QqqQuickSightWidget | WID-015 (WID-033 optional) | Done: real QuickSight acceptance is WID-033 (#705) |
| barChart | material:src/qqq/components/widgets/DashboardWidgets.tsx:724-733; material:src/qqq/components/widgets/charts/barchart/BarChart.tsx | src/components/widgets/QqqChartWidget.tsx (bar) | WID-002, WID-003 | Done: "As of" line is a separate row (group G) |
| pieChart | material:src/qqq/components/widgets/DashboardWidgets.tsx:735-754; material:src/qqq/components/widgets/charts/piechart/PieChart.tsx | src/components/widgets/QqqChartWidget.tsx (pie) | WID-014 | Done |
| divider (rule, no card chrome) | material:src/qqq/components/widgets/DashboardWidgets.tsx:756-758; material:src/qqq/components/widgets/misc/Divider.tsx:26-33 | src/components/widgets/DividerWidget.tsx via src/components/widgets/ConnectedWidget.tsx:215-221 | WID-004 | Done |
| horizontalBarChart | material:src/qqq/components/widgets/DashboardWidgets.tsx:761-769; material:src/qqq/components/widgets/charts/barchart/HorizontalBarChart.tsx | src/components/widgets/QqqChartWidget.tsx (horizontalBar) | WID-007 | Done |
| lineChart | material:src/qqq/components/widgets/DashboardWidgets.tsx:771-787; material:src/qqq/components/widgets/charts/linechart/DefaultLineChart.tsx | src/components/widgets/QqqChartWidget.tsx (line) | WID-009 | Done |
| childRecordList | material:src/qqq/components/widgets/DashboardWidgets.tsx:789-803; material:src/qqq/components/widgets/misc/RecordGridWidget.tsx | src/components/widgets/ChildRecordListWidget.tsx; src/components/records/AssociatedRecords.tsx | WID-024, REL-002 | Partial: viewing works; editing in forms is group I; #722 |
| fieldValueList | material:src/qqq/components/widgets/DashboardWidgets.tsx:806-814; material:src/qqq/components/widgets/misc/FieldValueListWidget.tsx | src/components/widgets/QqqDisplayWidgets.tsx:QqqFieldValueListWidget | WID-005 | Done |
| composite | material:src/qqq/components/widgets/DashboardWidgets.tsx:816-829; material:src/qqq/components/widgets/CompositeWidget.tsx | src/components/widgets/blocks/QqqComposite.tsx:QqqComposite | WID-023, WID-057, WID-058 | Done |
| block: a single leaf block as the whole widget payload | material:src/qqq/components/widgets/DashboardWidgets.tsx:831-844; material:src/qqq/components/widgets/WidgetBlock.tsx:57-104 | src/components/widgets/WidgetRenderer.tsx:180-185 → src/components/widgets/blocks/QqqComposite.tsx:QqqComposite (leaf block → QqqBlock) | WID-066 | Done |
| dataBagViewer | material:src/qqq/components/widgets/DashboardWidgets.tsx:846-851 | src/components/widgets/DataBagViewerWidget.tsx | WID-028 | Done: View only; see group O |
| scriptViewer | material:src/qqq/components/widgets/DashboardWidgets.tsx:854-859 | src/components/widgets/ScriptViewerWidget.tsx | WID-032 | Done: View only; see group K |
| filterAndColumnsSetup (view) | material:src/qqq/components/widgets/DashboardWidgets.tsx:862-871 | src/components/widgets/FilterAndColumnsSetupWidget.tsx | WID-030, RPT-009 | Done: View only; see group L |
| pivotTableSetup (view) | material:src/qqq/components/widgets/DashboardWidgets.tsx:874-879 | src/components/widgets/PivotTableSetupWidget.tsx | WID-029, RPT-009 | Done: View only; see group M |
| rowBuilder (view) | material:src/qqq/components/widgets/DashboardWidgets.tsx:882-886 | src/components/widgets/RowBuilderWidget.tsx | WID-031 | Done: View only; see group J |
| cronUI (view) | material:src/qqq/components/widgets/DashboardWidgets.tsx:889-898 | src/components/widgets/CronUIWidget.tsx | WID-026, RPT-012 | Done: see group N |
| dynamicForm (view) | material:src/qqq/components/widgets/DashboardWidgets.tsx:901-904 | src/components/widgets/DynamicFormWidget.tsx | WID-027 | Done: see group P |
| customComponent: load the script bundle, render window[name][name] | material:src/qqq/components/widgets/DashboardWidgets.tsx:907-912; material:src/qqq/components/widgets/misc/CustomComponentWidget.tsx:45-67; material:src/qqq/utils/qqq/useDynamicComponents.tsx:50-114 | src/components/widgets/QqqContainerWidgets.tsx:QqqCustomComponentWidget (205-277) | WID-025, WID-062 | Done |
| customComponent receives qContext and qfmdBridge (makeWidget/makeForm/makeModal/makeButton/makeAlert) | material:src/qqq/components/widgets/misc/CustomComponentWidget.tsx:45-67; material:src/qqq/utils/qqq/QFMDBridge.tsx:53-60 | src/components/widgets/QqqContainerWidgets.tsx:274 passes `{}` for both | none | Missing: Bundles that call the bridge will throw; #728 |
| Unknown widget type | material:src/qqq/components/widgets/DashboardWidgets.tsx (no default branch) | src/components/widgets/WidgetRenderer.tsx:221-229 placeholder | none | Done: Next shows a visible placeholder |

### B. Dashboard layout and data flow

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| 12-column grid sized by gridColumns (default 12) | material:src/qqq/components/widgets/DashboardWidgets.tsx:931-956, 999-1002 | src/components/widgets/AppHome.tsx:231-238; src/components/widgets/widget-utils.ts:widgetColumnClasses | WID-040 | Done: Next applies the span at `lg`; Material applies it at `xxl` |
| Per-breakpoint `gridCols:sizeClass:{xs..xxl}` overrides from defaultValues | material:src/qqq/components/widgets/DashboardWidgets.tsx:935-942 | none | none | Missing: Only gridColumns is read; #728 |
| Grid item `id=widgetName` with scrollMarginTop (anchor target) | material:src/qqq/components/widgets/DashboardWidgets.tsx:954 | none (data-qqq-id only) | none | Missing: No #widgetName deep link; #728 |
| Each widget fetched in parallel with its own error state | material:src/qqq/components/widgets/DashboardWidgets.tsx:155-202 | src/components/widgets/ConnectedWidget.tsx; src/lib/hooks/use-widget.ts:useWidget; src/lib/api/widgets.ts:fetchWidgetData | WID-040, WID-051, WID-053 | Done |
| Record context params (id, tableName) sent to record-view widgets | material:src/qqq/components/widgets/DashboardWidgets.tsx:265-273 | src/components/records/RecordViewSection.tsx:112-125 | WID-060 | Done |
| Stored dropdown values (own or parent's) sent as request params | material:src/qqq/components/widgets/DashboardWidgets.tsx:248-263 | src/components/widgets/widget-utils.ts:storedDropdownParams; src/components/widgets/ConnectedWidget.tsx:139 | WID-050 | Done |
| Parent dropdown selections flow to children, which re-fetch | material:src/qqq/components/widgets/DashboardWidgets.tsx:288-299; material:src/qqq/components/widgets/ParentWidget.tsx:73-112 | src/components/widgets/ConnectedWidget.tsx:223-227 → QqqParentWidget | WID-049 | Done |
| reloadWidget(index, params) re-fetches one widget | material:src/qqq/components/widgets/DashboardWidgets.tsx:204-238 | src/components/widgets/ConnectedWidget.tsx:142-150, 195 | WID-045, WID-047 | Done |
| Pre-seeded widget (initialWidgetDataList) in full chrome, e.g. the WIDGET field adornment | material:src/qqq/components/widgets/DashboardWidgets.tsx:155-162; material:src/qqq/pages/records/view/FieldValueAsWidget.tsx:122 | src/components/records/FieldValue.tsx:114-124 (body only) | REC-037 | Partial: No label, tooltip, icons, reload or export; #728 |
| Process-step widgets in full chrome, with process values as params and actionCallback | material:src/qqq/pages/processes/ProcessRun.tsx:405 → DashboardWidgets | src/components/process/WidgetComponent.tsx:48-85 | none | Partial: Body plus an h4 label only; no dropdowns, reload, export, help or icons; #725 |
| Not-loaded state: skeleton, or "Error: message" | material:src/qqq/components/widgets/DashboardWidgets.tsx:478-499 | src/components/widgets/WidgetBlock.tsx:WidgetSkeleton, WidgetErrorState | WID-051 | Done |
| Parent TABS layout; selected tab stored in localStorage | material:src/qqq/components/widgets/DashboardWidgets.tsx:121-137, 918-992; material:src/qqq/components/widgets/ParentWidget.tsx:136 | src/components/widgets/QqqContainerWidgets.tsx:54-67, 104-147 | WID-055 | Done |
| Parent resolves children from instance metadata, skipping unknown or denied ones | material:src/qqq/components/widgets/ParentWidget.tsx:77-101 | src/components/widgets/QqqContainerWidgets.tsx:80-102 | WID-022, WID-056 | Done |
| Parent label as page title (isLabelPageTitle; keeps the last label seen) | material:src/qqq/components/widgets/Widget.tsx:456-460, 748-783 | none | none | Missing: Always a normal h3; #728 |
| Record-view reload dedupe by metadata JSON | material:src/qqq/components/widgets/DashboardWidgets.tsx:139-153 | TanStack Query cache | none | N/A: Internal |

### C. Widget chrome (Widget.tsx)

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Payload label overrides the metadata label | material:src/qqq/components/widgets/Widget.tsx:749, 762-769 | src/components/widgets/WidgetBlock.tsx:120, 152-154 | none | Done |
| Sublabel | material:src/qqq/components/widgets/Widget.tsx:771-777, 861-865 | src/components/widgets/WidgetBlock.tsx:174-176 | WID-041, WID-006 | Done |
| isCard: card or plain container | material:src/qqq/components/widgets/Widget.tsx:943-947 | src/components/widgets/WidgetBlock.tsx:121, 158 | WID-041 | Done: When isCard is undefined, Next defaults to a card and Material to plain |
| Footer HTML from payload or metadata (hidden on error) | material:src/qqq/components/widgets/Widget.tsx:922-926 | src/components/widgets/WidgetBlock.tsx:123, 257-259 | WID-041, WID-006 | Done |
| minHeight | material:src/qqq/components/widgets/Widget.tsx:805 | src/components/widgets/WidgetBlock.tsx:163 | none | Done |
| Label tooltip from metadata | material:src/qqq/components/widgets/Widget.tsx:794-797 | src/components/widgets/WidgetBlock.tsx:171-173 (src/components/widgets/HoverTooltip.tsx) | WID-043 | Done |
| Help content (HTML) on the label | material:src/qqq/components/widgets/Widget.tsx:785-793 | src/components/widgets/WidgetBlock.tsx:102-107, 178-187 | WID-044 | Done: Help entries are not filtered by role |
| Help for slots other than the label (WidgetUtils.getHelp) | material:src/qqq/components/widgets/WidgetUtils.tsx:122-128 | none | none | Missing: Used by cron, filter, pivot and table column headers; #728 |
| Main metadata icon (64px colored tile, top-left) | material:src/qqq/components/widgets/Widget.tsx:812-830 | none (QWidgetMetaData has no `icon`) | none | Missing: no main icon tile; #728 |
| No-permission state (hasPermission=false) | material:src/qqq/components/widgets/Widget.tsx:722, 831-846, 914-918 | src/components/widgets/WidgetBlock.tsx:126, 134-137; src/components/widgets/ConnectedWidget.tsx:198-206 | SEC-009, WID-054 | Done: No lock icon |
| Header icons topLeft/topRightInsideCard (white glyph on a colored tile) | material:src/qqq/components/widgets/DashboardWidgets.tsx:512-530; material:src/qqq/components/widgets/Widget.tsx:123-176 | src/components/widgets/WidgetBlock.tsx:167-169, 243-245; src/components/widgets/WidgetIcon.tsx | WID-042 | Partial: About 25 icon names are mapped (others draw a Circle); the color tints the glyph and there is no tile; #728 |
| Header icon from an image `path` | material:src/qqq/components/widgets/Widget.tsx:164-169 | none | none | Missing: no image-path icons; #728 |
| Reload button | material:src/qqq/components/widgets/Widget.tsx:418-438, 503-506 | src/components/widgets/WidgetBlock.tsx:230-241 | WID-045 | Done |
| Reload re-sends the current dropdown selections | material:src/qqq/components/widgets/Widget.tsx:567-571, 626-650 | src/components/widgets/ConnectedWidget.tsx:195 | WID-045 | Done |
| Export button (csvData) | material:src/qqq/components/widgets/Widget.tsx:652-679; material:src/qqq/components/widgets/WidgetUtils.tsx:46-55 | src/components/widgets/WidgetBlock.tsx:218-228; src/components/widgets/ConnectedWidget.tsx:114-124, 185-193 | WID-046 | Done |
| CSV encoding (numbers unquoted, other values quoted) | material:src/qqq/components/widgets/WidgetUtils.tsx:72-103 | src/components/widgets/widget-utils.ts:widgetCsvToString | WID-046 | Done |
| Export file name "label yyyy-MM-dd HHmm.csv" | material:src/qqq/components/widgets/WidgetUtils.tsx:109-113 | src/components/widgets/widget-utils.ts:widgetExportFileName | WID-046 | Done |
| "There is no data available to export." | material:src/qqq/components/widgets/Widget.tsx:660-663 | src/components/widgets/ConnectedWidget.tsx:187-189 | WID-046 | Done: Shown inline instead of as an alert() |
| "An error occurred loading widget content." | material:src/qqq/components/widgets/Widget.tsx:803, 901-905 | src/components/widgets/WidgetBlock.tsx:288-306 (with detail and Retry) | WID-051 | Done |
| dropdownNeedsSelectedText (required dropdowns) | material:src/qqq/components/widgets/Widget.tsx:907-912 | src/components/widgets/WidgetBlock.tsx:138-141 | WID-049 | Done |
| Collapsible widget (isCollapsible, initiallyOpen, chevron, state in localStorage, controls hidden when collapsed) | material:src/qqq/components/widgets/Widget.tsx:464-466, 473-482, 687-719, 881-885, 957-975 | none (verified: no match in src/components/widgets) | none | Missing: no collapsible widgets; #728 |
| HeaderLinkButtonComponent (header text button with disabled tooltip) | material:src/qqq/components/widgets/Widget.tsx:182-209 | none | none | Missing: Used only by setup widgets in edit mode; #722 |
| HeaderToggleComponent (labelled switch in the header) | material:src/qqq/components/widgets/Widget.tsx:215-247 | none | none | Missing: Used only by the pivot setup in edit mode; #722 |
| Layout props (omitPadding, omitLabel, additionalCSS, labelBoxAdditionalSx), commented-out LinearProgress | material:src/qqq/components/widgets/Widget.tsx:65-98, 889-896, 931-947 | none | none | N/A: Internal styling hooks or dead code |

### D. Widget dropdowns (Widget.tsx, WidgetDropdownMenu.tsx)

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Possible-value dropdown built from payload lists ("Select label"); the choice is sent as a param | material:src/qqq/components/widgets/Widget.tsx:291-412, 528-565 | src/components/widgets/ConnectedWidget.tsx:resolveDropdowns (84-106); src/components/widgets/WidgetBlock.tsx:191-216 | WID-047 | Done |
| Searchable autocomplete (type to filter, "No options found") | material:src/qqq/components/widgets/components/WidgetDropdownMenu.tsx:341-411 | native `<select>` | WID-047 | Partial: No search; long lists are hard to use; #728 |
| Backend default selection (dropdownDefaultValueList) | material:src/qqq/components/widgets/Widget.tsx:357-375, 553-557 | src/components/widgets/ConnectedWidget.tsx:170-172 | WID-049 (unverified) | Done: The default is not written to localStorage |
| labelForNullValue option (only when there is no default) | material:src/qqq/components/widgets/Widget.tsx:381-391 | src/components/widgets/WidgetBlock.tsx:213 | none | Done: Next shows it even when a default exists |
| storeDropdownSelections: restore, save, clear; stale options dropped; same storage key | material:src/qqq/components/widgets/Widget.tsx:315-352, 441, 610-620 | src/components/widgets/widget-utils.ts:readStoredSelection, writeStoredSelection | WID-050 | Done |
| disableClearable | material:src/qqq/components/widgets/WidgetDropdownMenu.tsx:371 | none | none | Missing: no disableClearable; #728 |
| Dropdown width from metadata (default 225px) | material:src/qqq/components/widgets/Widget.tsx:407; material:src/qqq/components/widgets/WidgetDropdownMenu.tsx:383, 404 | none (`width` is typed but unused) | none | Missing: width is ignored; #728 |
| startIconName adornment | material:src/qqq/components/widgets/Widget.tsx:401; material:src/qqq/components/widgets/WidgetDropdownMenu.tsx:288 | none | none | Missing: no start icon; #728 |
| allowBackAndForth prev/next arrows (with backAndForthInverted) | material:src/qqq/components/widgets/WidgetDropdownMenu.tsx:150-183, 384, 391 | none | none | Missing: no prev/next arrows; #728 |
| DATE_PICKER dropdown (calendar, "Today" action) | material:src/qqq/components/widgets/WidgetDropdownMenu.tsx:127-133, 186-201, 306-337 | src/components/widgets/WidgetBlock.tsx:191-200 (native date input) | WID-048 | Partial: No Today action; sends ISO where Material sends toLocaleDateString; #728 |
| DATE_PICKER ±1 day arrows | material:src/qqq/components/widgets/WidgetDropdownMenu.tsx:154-159, 317, 335 | none | none | Missing: no day arrows; #728 |
| Timeframe "custom" option: start and end inputs, 500ms debounce, sends `custom,<utcStart>,<utcEnd>`, restored from storage | material:src/qqq/components/widgets/WidgetDropdownMenu.tsx:66-103, 207-213, 246-286 | none (verified) | none | Missing: no custom range; #728 |

### E. Composite and blocks

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Nested COMPOSITE recursion | material:src/qqq/components/widgets/WidgetBlock.tsx:71-75 | src/components/widgets/blocks/QqqComposite.tsx:QqqBlock | WID-058 | Done |
| Unsupported block type shows a warning | material:src/qqq/components/widgets/WidgetBlock.tsx:102-103 | src/components/widgets/blocks/QqqComposite.tsx:150-160 | WID-059 | Done |
| Block link, per-slot linkMap, link target | material:src/qqq/components/widgets/blocks/BlockElementWrapper.tsx:27-41, 95-98 | src/components/widgets/blocks/BlockSlot.tsx:resolveSlot, BlockSlot | WID-023, WID-058 | Done |
| Block tooltip, per-slot tooltipMap, placement | material:src/qqq/components/widgets/blocks/BlockElementWrapper.tsx:32-36, 99-116 | src/components/widgets/blocks/BlockSlot.tsx:70-73, 122-140 | WID-023, WID-058 | Done |
| Tooltip whose content is a nested composite (tooltip.blockData) | material:src/qqq/components/widgets/blocks/BlockElementWrapper.tsx:103-110 | src/components/widgets/blocks/BlockSlot.tsx:94, 134 | none (unit test only) | Done |
| Help content as the fallback tooltip for a slot (`blockId,slot`) | material:src/qqq/components/widgets/blocks/BlockElementWrapper.tsx:77-93 | none | none | Missing: no help tooltip fallback; #728 |
| actionCallback passed to BUTTON, INPUT_FIELD, IMAGE, ICON | material:src/qqq/components/widgets/WidgetBlock.tsx:93-100; material:src/qqq/components/widgets/CompositeWidget.tsx:160 | src/components/widgets/blocks/QqqComposite.tsx:72-79 | none (unit test only) | Done |
| Layouts: FLEX_COLUMN, FLEX_ROW_WRAPPED, FLEX_ROW, FLEX_ROW_SPACE_BETWEEN, FLEX_ROW_CENTER, TABLE_SUB_ROW_DETAILS, BADGES_WRAPPER | material:src/qqq/components/widgets/CompositeWidget.tsx:71-124 | src/components/widgets/blocks/QqqComposite.tsx:LAYOUT_CLASSES | WID-058 | Done |
| styleOverrides, background color, padding | material:src/qqq/components/widgets/CompositeWidget.tsx:125-141 | src/components/widgets/blocks/QqqComposite.tsx:101-108 | none (unit test only) | Done |
| overlayHtml with overlayStyleOverrides | material:src/qqq/components/widgets/CompositeWidget.tsx:143-155 | src/components/widgets/blocks/QqqComposite.tsx:111-115 | none (unit test only) | Done: Next sanitizes the HTML |
| modalMode composite (modal opened from values, show/hide/toggle control codes, sends hideModal on close) | material:src/qqq/components/widgets/CompositeWidget.tsx:168-211 | none | none | Missing: Always renders inline; #728 |
| Standard block colors (SUCCESS, WARNING, ERROR, INFO, MUTED, hex) | material:src/qqq/pages/processes/ProcessWidgetBlockUtils.tsx:233-266 | src/components/widgets/blocks/block-utils.ts:blockColor | WID-057 | Done |
| TEXT: interpolatedText or text, one line per `\n`, color, alert and banner formats | material:src/qqq/components/widgets/blocks/TextBlock.tsx:36-60, 140-160 | src/components/widgets/blocks/QqqBlocks.tsx:TextBlock | WID-057 | Done: Alert and banner formats are unit-tested only |
| TEXT: size (named or px), weight (named or 100-900), start and end icons | material:src/qqq/components/widgets/blocks/TextBlock.tsx:62-156 | src/components/widgets/blocks/QqqBlocks.tsx:textSize, textWeight | WID-057 | Done |
| NUMBER_ICON_BADGE | material:src/qqq/components/widgets/blocks/NumberIconBadgeBlock.tsx:31-47 | src/components/widgets/blocks/QqqBlocks.tsx:NumberIconBadgeBlock | WID-057 | Done |
| UP_OR_DOWN_NUMBER: isUp arrow, isGood green or red, colorOverride, isStacked, number and context slots | material:src/qqq/components/widgets/blocks/UpOrDownNumberBlock.tsx:50-75 | src/components/widgets/blocks/QqqBlocks.tsx:UpOrDownNumberBlock | WID-057, WID-023 | Done: Green path, isStacked and colorOverride are not asserted |
| TABLE_SUB_ROW_DETAIL_ROW (label, value, colors, ellipsis) | material:src/qqq/components/widgets/blocks/TableSubRowDetailRowBlock.tsx:32-53 | src/components/widgets/blocks/QqqBlocks.tsx:TableSubRowDetailRowBlock | WID-057 | Done |
| PROGRESS_BAR (heading, percent, barColor, value text) | material:src/qqq/components/widgets/blocks/ProgressBarBlock.tsx:38-69 | src/components/widgets/blocks/QqqBlocks.tsx:ProgressBarBlock | WID-057 | Done |
| DIVIDER block | material:src/qqq/components/widgets/blocks/DividerBlock.tsx:30-33 | src/components/widgets/blocks/QqqBlocks.tsx:DividerBlock | WID-057 | Done |
| BIG_NUMBER (heading, number, context, numberColor, width) | material:src/qqq/components/widgets/blocks/BigNumberBlock.tsx:32-66 | src/components/widgets/blocks/QqqBlocks.tsx:BigNumberBlock | WID-057, WID-023 | Done |
| INPUT_FIELD: label, placeholder, initial value, autoFocus | material:src/qqq/components/widgets/blocks/InputFieldBlock.tsx:38-46, 114-134 | src/components/widgets/blocks/QqqBlocks.tsx:InputFieldBlock | WID-057 | Done |
| INPUT_FIELD: typed field from QDynamicFormField (all field types) | material:src/qqq/components/widgets/blocks/InputFieldBlock.tsx:38-39, 123-131 | src/components/widgets/blocks/QqqBlocks.tsx:inputType (308-321) | none | Partial: Only number, date, password and text; #728 |
| INPUT_FIELD: submitOnEnter, required-blank guard, `->actionCode` | material:src/qqq/components/widgets/blocks/InputFieldBlock.tsx:72-110 | src/components/widgets/blocks/QqqBlocks.tsx:341-351 | none (unit test only) | Done |
| BUTTON: click to actionCallback, format outlined/text/filled, default label, icons | material:src/qqq/components/widgets/blocks/ButtonBlock.tsx:37-81 | src/components/widgets/blocks/QqqBlocks.tsx:ButtonBlock | WID-057 | Done |
| AUDIO (path, autoPlay, showControls) | material:src/qqq/components/widgets/blocks/AudioBlock.tsx:33-39 | src/components/widgets/blocks/QqqBlocks.tsx:AudioBlock | WID-057 | Done: autoPlay is not asserted |
| IMAGE (path, alt, width, height, bordered) | material:src/qqq/components/widgets/blocks/ImageBlock.tsx:33-58 | src/components/widgets/blocks/QqqBlocks.tsx:ImageBlock | WID-057 | Done: Only width is asserted |
| ICON (name, color, fontSize) | material:src/qqq/components/widgets/blocks/IconBlock.tsx:32-40 | src/components/widgets/blocks/QqqBlocks.tsx:IconBlock | WID-057 | Done |
| Any Material icon name renders (MUI ligature) in blocks, multiStatistics, fieldValueList | material:src/qqq/components/widgets/blocks/IconBlock.tsx:37; material:src/qqq/components/widgets/statistics/MultiStatisticsCard.tsx:89; material:src/qqq/components/widgets/misc/FieldValueListWidget.tsx:90 | src/components/widgets/WidgetIcon.tsx:ICONS (about 30 names) | WID-057, WID-012, WID-005 (mapped names only) | Partial: Unmapped names draw a Circle; the larger map in src/lib/utils/material-icons.ts is not used here; #728 |

### F. Statistics, stepper, fieldValueList, usaMap

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| statistics: grouped count, countURL, countFontSize | material:src/qqq/components/widgets/statistics/StatisticsCard.tsx:92-104 | src/components/widgets/QqqStatisticsWidgets.tsx:formatCount, 101-104 | WID-016 | Done |
| statistics: "+N%" change, color from increaseIsGood, percentageLabel | material:src/qqq/components/widgets/statistics/StatisticsCard.tsx:64-85, 121 | src/components/widgets/QqqStatisticsWidgets.tsx:90-117 | WID-016 | Done: "Bad" is red in Next, orange in Material |
| statistics: change row hidden when 0 or undefined; spinner while count is undefined | material:src/qqq/components/widgets/statistics/StatisticsCard.tsx:102-108 | src/components/widgets/QqqStatisticsWidgets.tsx:108 | none | Partial: Next shows "0%" and a blank count; #728 |
| multiStatistics: group icon and color, header, subheader, "label: value" list, per-statistic URL | material:src/qqq/components/widgets/statistics/MultiStatisticsCard.tsx:85-118 | src/components/widgets/QqqStatisticsWidgets.tsx:164-180 | WID-012 | Done |
| MiniStatisticsCard app-home tiles (label, count, icon, disabled without permission) | material:src/qqq/components/widgets/statistics/MiniStatisticsCard.tsx:53-131; material:src/qqq/pages/apps/Home.tsx:446-503 | src/components/widgets/AppHome.tsx:98-165 | NAV-008, NAV-009 | Done |
| Chart subheader: main number with link, up/down % colored by isGoodVsPrevious, "vs" text, previous number with link | material:src/qqq/components/widgets/components/ChartSubheaderWithData.tsx:54-107 | src/components/widgets/QqqChartWidget.tsx:ChartSubheader (262-304) | WID-014 | Done: Links are unit-tested only |
| stepper: complete, current and upcoming steps; link on the current step | material:src/qqq/components/widgets/misc/StepperCard.tsx:80-131 | src/components/widgets/QqqDisplayWidgets.tsx:QqqStepperWidget (123-147) | WID-018 | Done |
| stepper: per-step colorOverride on icon and label | material:src/qqq/components/widgets/misc/StepperCard.tsx:86-119 | src/components/widgets/QqqDisplayWidgets.tsx:139 | none | Partial: Applied to the icon only; #728 |
| stepper: per-step iconOverride | material:src/qqq/components/widgets/misc/StepperCard.tsx:85, 99, 113 | none | none | Missing: no iconOverride; #728 |
| fieldValueList: "Label: value" rows, prefix icons and colors, indent levels | material:src/qqq/components/widgets/misc/FieldValueListWidget.tsx:78-101 | src/components/widgets/QqqDisplayWidgets.tsx:196-211 | WID-005 | Done |
| fieldValueList: type-aware display value (ValueUtils.getDisplayValue) | material:src/qqq/components/widgets/misc/FieldValueListWidget.tsx:99 | src/components/widgets/QqqDisplayWidgets.tsx:valueText (171-177) | WID-005 | Partial: Uses displayValues or the raw value; no type, displayFormat or adornment formatting; #728 |
| fieldValueList: dropdownNeedsSelectedText renders chrome only | material:src/qqq/components/widgets/misc/FieldValueListWidget.tsx:44-51 | src/components/widgets/WidgetBlock.tsx chrome | none | Done: unverified |
| usaMap markers from the payload | material:src/qqq/components/widgets/misc/USMapWidget.tsx:85-98 | src/components/widgets/QqqDisplayWidgets.tsx:268-293 | WID-020 | Done: Material hard-codes three markers; Next reads mapMarkerList |
| usaMap US-states basemap (jvectormap) | material:src/qqq/components/widgets/misc/USMapWidget.tsx:79-107 | src/components/widgets/QqqDisplayWidgets.tsx:278-294 | none | Partial: Markers are drawn on a blank rectangle; #728 |

### G. Charts

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Bar and pie colors from the backend (per point) | material:src/qqq/components/widgets/charts/piechart/PieChartConfigs.ts:28-47 | src/components/widgets/QqqChartWidget.tsx:pointColor | WID-002, WID-014 | Done: Material's bar chart draws white bars; Next honors backend colors |
| Chart title and HTML description | material:src/qqq/components/widgets/charts/barchart/BarChart.tsx:163-169; material:src/qqq/components/widgets/charts/piechart/PieChart.tsx:120-131 | src/components/widgets/QqqChartWidget.tsx:descriptionElement | WID-007, WID-009, WID-010 | Done |
| Chart height from the payload | material:src/qqq/components/widgets/charts/barchart/HorizontalBarChart.tsx:204, 226 | src/components/widgets/QqqChartWidget.tsx:height | WID-007 | Done: Default is 240px in Next, about 300px in Material |
| barChart "As of date" line with clock icon, accent chart panel | material:src/qqq/components/widgets/charts/barchart/BarChart.tsx:150-178; material:src/qqq/components/widgets/DashboardWidgets.tsx:726-728 | none | none | Missing: no "As of" line (cosmetic); #728 |
| horizontalBar: several datasets, per-dataset color, negative values | material:src/qqq/components/widgets/charts/barchart/HorizontalBarChart.tsx:123-149 | src/components/widgets/QqqChartWidget.tsx (layout="vertical") | WID-007 | Done |
| Currency formatting (isCurrency, isYAxisCurrency) on axis and tooltip | material:src/qqq/components/widgets/charts/barchart/HorizontalBarChart.tsx:151-170; material:src/qqq/components/widgets/charts/linechart/DefaultLineChart.tsx:185-204 | src/components/widgets/QqqChartWidget.tsx:tickFormatter, tooltipFormatter | none (unit test only) | Done |
| "No data was provided to this chart" | material:src/qqq/components/widgets/charts/barchart/HorizontalBarChart.tsx:206-210 | src/components/widgets/QqqChartWidget.tsx:hasValues → WidgetEmpty | WID-052 | Done: Wording differs |
| Tooltip lists every series at the hovered x; y axis starts at zero; toLocaleString ticks | material:src/qqq/components/widgets/charts/barchart/BarChart.tsx:44-47; material:src/qqq/components/widgets/charts/linechart/DefaultLineChart.tsx:52-92 | src/components/widgets/QqqChartWidget.tsx:Tooltip, numberDomain | none | Done |
| Multi-series line chart with series colors and point markers | material:src/qqq/components/widgets/charts/linechart/DefaultLineChart.tsx:144-183 | src/components/widgets/QqqChartWidget.tsx (line) | WID-009 | Done: Next draws curved lines (cosmetic) |
| Legend for single-dataset charts (hbar legend; line badges above the chart) | material:src/qqq/components/widgets/charts/barchart/HorizontalBarChart.tsx:40-42; material:src/qqq/components/widgets/charts/linechart/DefaultLineChart.tsx:154-165 | src/components/widgets/QqqChartWidget.tsx:ChartLegend (only when multiSeries) | none | Partial: A single series has no legend; #728 |
| Clicking a legend item hides that series or slice | material:src/qqq/components/widgets/charts/piechart/PieChartConfigs.ts:109-121; material:src/qqq/components/widgets/charts/StackedBarChart.tsx:87-99 | src/components/widgets/QqqChartWidget.tsx:ChartLegend (static list) | none | Missing: legend has no toggle (verified); #728 |
| smallLineChart axis ticks and grid | material:src/qqq/components/widgets/charts/linechart/SmallLineChart.tsx:72; material:src/qqq/components/widgets/charts/linechart/LineChartConfigs.ts:43-99 | src/components/widgets/QqqChartWidget.tsx (YAxis hide when small) | none | Partial: No y values; #728 |
| Full pie (not a donut) | material:src/qqq/components/widgets/charts/piechart/PieChartConfigs.ts:56 | src/components/widgets/QqqChartWidget.tsx (innerRadius 50%) | none | Partial: donut instead of a full pie (cosmetic); #728 |
| Theme color names (info, success, ...) as chart colors | material:src/qqq/components/widgets/charts/piechart/PieChartConfigs.ts:30-43; material:src/qqq/components/widgets/charts/StackedBarChart.tsx:145-157 | none | none | Missing: A named color becomes an invalid SVG fill; #728 |
| Pie legend at the bottom | material:src/qqq/components/widgets/charts/piechart/PieChartConfigs.ts:109-121 | src/components/widgets/QqqChartWidget.tsx:ChartLegend | WID-014 | Done: Next appends ": value", which may repeat a value already in the label |
| Pie tooltip shows percent of total | material:src/qqq/components/widgets/charts/piechart/PieChartConfigs.ts:81-108 | src/components/widgets/QqqChartWidget.tsx pie Tooltip | none | Partial: Value only; #728 |
| Pie slice click opens dataset.urls[i] | material:src/qqq/components/widgets/charts/piechart/PieChart.tsx:83-90 | src/components/widgets/QqqChartWidget.tsx Pie onClick | none (unit test only) | Done |
| Stacked bars | material:src/qqq/components/widgets/charts/StackedBarChart.tsx:101-112 | src/components/widgets/QqqChartWidget.tsx (stackId) | WID-017 | Done |
| Stacked per-dataset `backgroundColor` (singular) | material:src/qqq/components/widgets/charts/StackedBarChart.tsx:141-161 | src/components/widgets/QqqChartWidget.tsx:normalizeQqqChart | WID-017 (tests `color`, not `backgroundColor`) | Partial: The singular field is ignored; #728 |
| Stacked bar click opens chartData.urls[i] | material:src/qqq/components/widgets/charts/StackedBarChart.tsx:55-65, 131-139 | src/components/widgets/QqqChartWidget.tsx Bar onClick | none (unit test only) | Done |
| Stacked tooltip shows only the matching dataset; y axis on the right, integer ticks; x labels rotate | material:src/qqq/components/widgets/charts/StackedBarChart.tsx:67-112 | Recharts defaults | none | Partial: Long labels overlap; tooltip lists every series; #728 |
| Chart loading skeletons | material:src/qqq/components/widgets/charts/piechart/PieChart.tsx:106-119; material:src/qqq/components/widgets/charts/StackedBarChart.tsx:171 | src/components/widgets/WidgetBlock.tsx:WidgetSkeleton | none | Done: Generic shape |

### H. Table widget (TableWidget, TableCard, DataTable, cells)

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Headers and rows | material:src/qqq/components/widgets/tables/TableWidget.tsx:159-177; material:src/qqq/components/widgets/tables/DataTable.tsx:326-448 | src/components/widgets/QqqTableWidget.tsx:QqqTable | WID-019 | Done |
| Column alignment | material:src/qqq/components/widgets/tables/DataTable.tsx:336, 391 | src/components/widgets/QqqTableWidget.tsx:cellClass | WID-019 | Done |
| Column widths (grid template, fr units) | material:src/qqq/components/widgets/tables/DataTable.tsx:106-114, 187 | th style.width | none | Partial: fr widths are dropped; #728 |
| `hidden` column type | material:src/qqq/components/widgets/tables/DataTable.tsx:110, 331, 385 | none | none | Missing: Helper columns (imageUrl, tooltip) appear as visible columns; #728 |
| Numbers in default cells use toLocaleString | material:src/qqq/components/widgets/tables/DataTable.tsx:395-398 | src/components/widgets/QqqTableWidget.tsx:renderCell | none | Partial: No thousands separators; #728 |
| `html` cell | material:src/qqq/components/widgets/tables/DataTable.tsx:413-415; material:src/qqq/components/widgets/tables/cells/DefaultCell.tsx:38-40 | src/components/widgets/QqqTableWidget.tsx:renderCell (SafeHtml) | none | Done |
| `htmlAndTooltip` cell | material:src/qqq/components/widgets/tables/DataTable.tsx:76-83, 402-410 | none | none | Missing: Markup shows as text; #728 |
| `composite` cell | material:src/qqq/components/widgets/tables/DataTable.tsx:418-422 | none | none | Missing: Shows "[object Object]"; #728 |
| `block` cell | material:src/qqq/components/widgets/tables/DataTable.tsx:425-429 | src/components/widgets/QqqTableWidget.tsx:renderCell → QqqComposite | WID-066 | Done: same fix as WID-066 |
| `image` cell (imageUrl, imageLabel, imageTotal) | material:src/qqq/components/widgets/tables/DataTable.tsx:432-439; material:src/qqq/components/widgets/tables/cells/ImageCell.tsx:35-58 | none | none | Missing: no image cell; #728 |
| Sub-rows: expand and collapse, shaded nested rows | material:src/qqq/components/widgets/tables/DataTable.tsx:116-172, 297-304, 351-381 | none | none | Missing: row.subRows is ignored; #728 |
| Paging: rowsPerPage, default 10 when unset | material:src/qqq/components/widgets/tables/DataTable.tsx:64-66, 103, 221; material:src/qqq/components/widgets/tables/TableCard.tsx:86 | src/components/widgets/QqqTableWidget.tsx perPage | none | Partial: Without rowsPerPage, Next shows every row; #728 |
| Pagination controls: numbered pages, chevrons, jump-to-page when more than 6 pages | material:src/qqq/components/widgets/tables/DataTable.tsx:227-246, 526-557 | src/components/widgets/QqqTableWidget.tsx:QqqTable Previous/Next and "Page x of y" | none | Partial: No numbered pages or jump; #728 |
| Entries-per-page select (5-25) when hidePaginationDropdown is false | material:src/qqq/components/widgets/tables/DataTable.tsx:455-482; material:src/qqq/components/widgets/tables/TableWidget.tsx:171 | none (flag is typed but unused) | none | Missing: no entries-per-page select; #728 |
| fixedStickyLastRow totals row | material:src/qqq/components/widgets/tables/DataTable.tsx:297-320, 502-509 | src/components/widgets/QqqTableWidget.tsx:QqqTable sticky tfoot | WID-019 | Done: Next pins the overall last row; Material pins each page's last row |
| fixedHeight scroll area | material:src/qqq/components/widgets/tables/DataTable.tsx:313, 454 | src/components/widgets/QqqTableWidget.tsx:QqqTable maxHeight | none | Done |
| Header row sticky inside the scroll area | material:src/qqq/components/widgets/tables/DataTable.tsx:333; material:src/qqq/components/widgets/tables/cells/DataTableHeadCell.tsx:53-54 | none | none | Partial: Header scrolls away; #728 |
| Column-header help tooltips (`columnHeader=<accessor>` help slot) | material:src/qqq/components/widgets/tables/TableWidget.tsx:145-157; material:src/qqq/components/widgets/tables/DataTable.tsx:174-183 | none | none | Missing: no column-header help; #728 |
| noRowsFoundHTML | material:src/qqq/components/widgets/tables/TableCard.tsx:83-99 | src/components/widgets/QqqTableWidget.tsx:QqqTable SafeHtml / WidgetEmpty | WID-052 | Done |
| linkText and linkURL header link | material:src/qqq/components/widgets/tables/TableWidget.tsx:133-136; material:src/qqq/components/widgets/WidgetUtils.tsx:61-66 | src/components/widgets/QqqTableWidget.tsx:106-109 | none | Done |
| Export built from table columns and rows when there is no csvData (skips icons and buttons) | material:src/qqq/components/widgets/tables/TableWidget.tsx:55-140 | src/components/widgets/ConnectedWidget.tsx:exportRows; src/components/widgets/widget-utils.ts:plainText | none | Partial: Icon text (e.g. "open_in_new") leaks into the CSV; #728 |
| Header sorting, global search, "Showing X to Y of Z" | material:src/qqq/components/widgets/tables/DataTable.tsx:249-295, 483-525 | none | none | N/A: unreachable (TableCard passes isSorted, canSearch and showTotalEntries as false) |
| ModalEditForm | material:src/qqq/components/widgets/tables/ModalEditForm.tsx:44-94 | none | none | N/A: dead code (nothing imports it) |

### I. Child records (RecordGridWidget, association editing)

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Child list columns from the child table, with omit and onlyInclude fields | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:149-186 | src/components/widgets/ChildRecordListWidget.tsx:childColumns; src/components/records/AssociatedRecords.tsx | WID-024, REL-002, REL-004, REL-007 | Done: AssociatedRecords shows only the first 6 visible fields |
| Type-aware cells (possible-value links, date and boolean formatting) | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:152-160 | src/components/widgets/ChildRecordListWidget.tsx:189-199 (plain text) | WID-024 | Partial: Non-association lists show plain text; #728 |
| Exposed join-table columns | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:159-160 | none | none | Missing: no join columns; #728 |
| Parent foreign-key columns hidden | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:197-207 | none in ChildRecordListWidget | none | Partial: ChildRecordListWidget still shows the FK column; #728 |
| "View All" link to the filtered child list | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:263-271 | src/components/widgets/ChildRecordListWidget.tsx:nextViewAllHref | WID-024, REL-002 | Done |
| Row click opens the child record (disableRowClick respected) | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:346-390 | src/components/widgets/ChildRecordListWidget.tsx:181, 193-196 | WID-024 | Partial: Only the first cell is a link; #728 |
| Export the shown child rows as CSV | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:235-311 | none | none | Missing: no CSV export; #728 |
| "Add new" opens a create-child modal prefilled from defaultValues and parent fields, with disabledFields | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:317-340; material:src/qqq/components/widgets/Widget.tsx:253-285; material:src/qqq/pages/records/view/RecordView.tsx:410-429 | src/components/widgets/ChildRecordListWidget.tsx:addChildHref; src/components/records/CreateChildFromLinkDialog.tsx; src/components/records/AssociatedRecords.tsx:CreateChildRecordDialog | RPT-012, REL-003, REL-008 | Done: create dialog over the parent with presets locked |
| Add shown only when canAddChildRecord | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:317 | src/components/widgets/ChildRecordListWidget.tsx:150; src/components/records/AssociatedRecords.tsx:284 | REL-006 | Done |
| createChild deep link opens the create modal | material:src/qqq/pages/records/view/RecordView.tsx:397-429 | src/lib/utils/material-links.ts; src/components/records/RecordViewHeader.tsx; src/components/records/CreateChildFromLinkDialog.tsx | REC-051 | Done: #/createChild= hash opens the create dialog |
| Child list shown inside the parent create and edit form | material:src/qqq/components/forms/EntityForm.tsx:498-515, 895-900 | none | none | Missing: no child list in forms; #722 |
| Edit form: add a child in a modal (held in memory) | material:src/qqq/components/forms/EntityForm.tsx:192-215, 285-345 | none | none | Missing: no add-child modal in forms; #722 |
| Edit form: edit a child row in a modal | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:212-229; material:src/qqq/components/forms/EntityForm.tsx:221-232 | none | none | Missing: REL-005 edits the child on its own page; #722 |
| Edit form: delete a child row | material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:225; material:src/qqq/components/forms/EntityForm.tsx:238-241 | none | none | Missing: no child delete in forms; #722 |
| Saving the parent posts child rows as `associations` | material:src/qqq/components/forms/EntityForm.tsx:1337-1382 | src/lib/api/tables.ts:updateRecord (no associations parameter; verified) | none | Missing: Only insert supports associations; #722 |

### J. RowBuilder

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Read-only rows table, "No rows" | material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:772-825 | src/components/widgets/RowBuilderWidget.tsx:84-119 | WID-031 | Partial: Ignores frontendFields and isHidden; no inlineHeading; #722 |
| Inline editable fields per row (typed inputs, possible values) | material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:508-552, 673-770 | none | none | Missing: no inline editing; #722 |
| Add a row with defaults and focus it; remove a row | material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:319-437 | none | none | Missing: no add or remove rows; #722 |
| Drag to reorder rows (orderByFieldName resequenced) | material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:439-465; material:src/qqq/components/widgets/misc/DragAndDropElementWrapper.tsx:68-199 | none | none | Missing: no drag reorder; #722 |
| Modal editor ("Edit Rows"; Cancel reverts, OK applies) | material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:177-183, 470-617, 863-906 | none | none | Missing: no modal editor; #722 |
| Per-field validation merged into the parent form | material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:234-251; material:src/qqq/components/forms/EntityForm.tsx:629-633 | none | none | Missing: no validation merged into the form; #722 |
| Output to a process value (outputFieldName) or to record associations | material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:621-640; material:src/qqq/pages/processes/ProcessRun.tsx:399-402 | none | none | Missing: no output to process values or associations; #722 |
| RowBuilder on the record edit screen | material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:125-127; material:src/qqq/components/forms/EntityForm.tsx:910 | none | none | Missing: not on the edit screen; #722 |

### K. ScriptViewer and ScriptEditor

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Revisions list (sequence, CURRENT, commit message, date, author) and selection | material:src/qqq/components/widgets/misc/ScriptViewer.tsx:291-343, 433 | src/components/widgets/ScriptViewerWidget.tsx:99-129 | WID-032 | Done: Next opens the current revision, Material the newest |
| API name and version line per revision | material:src/qqq/components/widgets/misc/ScriptViewer.tsx:305, 327-332 | none | none | Missing: no API name or version; #724 |
| Syntax-highlighted read-only code (Ace) | material:src/qqq/components/widgets/misc/ScriptViewer.tsx:483-495 | src/components/widgets/ScriptViewerWidget.tsx:141-149 (`<pre>`) | WID-032 | Partial: No highlighting; #724 |
| File selector for multi-file scripts, in schema order | material:src/qqq/components/widgets/misc/ScriptViewer.tsx:130-153, 471-482 | src/components/widgets/ScriptViewerWidget.tsx:77-82 (files stacked) | WID-032 | Partial: No per-file select; order differs; #724 |
| Logs tab with "View All" | material:src/qqq/components/widgets/misc/ScriptViewer.tsx:345-393, 506-530; material:src/qqq/components/scripts/ScriptLogsView.tsx:45-80 | src/components/records/AssociatedScriptViewer.tsx (record developer view) | REC-054 | Partial: per-version logs on the record developer view; no View All link to the filtered script log table; #724 |
| Test tab (inputs, run testScript, show outputs, exception, logs) | material:src/qqq/components/scripts/ScriptTestForm.tsx:90-310; material:src/qqq/components/widgets/misc/ScriptViewer.tsx:532-543 | src/components/records/AssociatedScriptViewer.tsx (record developer view) | REC-054 | Done |
| Docs tab (help text, sample code) | material:src/qqq/components/scripts/ScriptDocsForm.tsx:41-80 | src/components/records/AssociatedScriptViewer.tsx (record developer view) | REC-054 | Done |
| "Edit", "Edit and Activate", "Create New Version" open the editor | material:src/qqq/components/widgets/misc/ScriptViewer.tsx:373-388, 462-466, 554-562 | src/components/records/AssociatedScriptViewer.tsx (record developer view) | REC-054 | Done |
| Editor: code per file, split panes, mode per file type, autocomplete, beforeunload guard, test and docs panes on unsaved code | material:src/qqq/components/scripts/ScriptEditor.tsx:162, 195, 383-513 | none (src/components/forms/ScriptEditor.tsx is a textarea for code-editor fields) | none | Missing: no script editor; #724 |
| Editor: required API name and version selects | material:src/qqq/components/scripts/ScriptEditor.tsx:129-132, 251-255, 352-375 | none | none | Missing: no API name and version selects; #724 |
| Editor: save with commit message (storeScriptRevision), then reload | material:src/qqq/components/scripts/ScriptEditor.tsx:249-310, 562; material:src/qqq/components/widgets/misc/ScriptViewer.tsx:197-226 | src/components/records/AssociatedScriptViewer.tsx (record developer view) | REC-054 | Done |

### L. FilterAndColumnsSetup

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| View: criteria and sub-filter summary, sort, column chips | material:src/qqq/components/widgets/misc/FilterAndColumnsSetupWidget.tsx:502-550 | src/components/widgets/FilterAndColumnsSetupWidget.tsx:255-336 | WID-030, RPT-009 | Done |
| View: live preview grid of matching records (unless hidePreview) | material:src/qqq/components/widgets/misc/FilterAndColumnsSetupWidget.tsx:551-566 | none | none | Missing: no preview grid; #722 |
| Default criteria from record fields; unknown fields removed with a warning | material:src/qqq/components/widgets/misc/FilterAndColumnsSetupWidget.tsx:136-184, 271-287 | src/components/widgets/FilterAndColumnsSetupWidget.tsx:179-191 | none | Partial: Unknown fields are flagged, but defaults are not injected; #722 |
| API-versioned table metadata | material:src/qqq/components/widgets/misc/FilterAndColumnsSetupWidget.tsx:205-257 | none | none | Missing: no API-versioned metadata; #722 |
| Edit: "Edit Filters and Columns", "+ Add Filters", "+ Add Columns" | material:src/qqq/components/widgets/misc/FilterAndColumnsSetupWidget.tsx:303-330, 457-546 | none | none | Missing: no edit buttons; #722 |
| Edit: modal with the full query screen (filter builder, sort, columns, variables) | material:src/qqq/components/widgets/misc/FilterAndColumnsSetupWidget.tsx:568-603 | none | none | Missing: no query-screen modal; #722 |
| Edit: OK writes queryFilterJson and columnsJson into the form | material:src/qqq/components/widgets/misc/FilterAndColumnsSetupWidget.tsx:336-362; material:src/qqq/components/forms/EntityForm.tsx:486-537 | none | none | Missing: no write-back to the form; #722 |
| filterAndColumnsSetup as a form field (WIDGET adornment in processes and row builders) | material:src/qqq/components/forms/DynamicFormField.tsx:264-281; material:src/qqq/components/forms/DynamicFormFieldAsWidget.tsx:41-170 | none | none | Missing: no WIDGET form field; #722 |
| Help slots on the filter and pivot widgets (sectionSubhead, modalSubheader) | material:src/qqq/components/widgets/misc/FilterAndColumnsSetupWidget.tsx:434-495; material:src/qqq/components/widgets/misc/PivotTableSetupWidget.tsx:209-227 | none | none | Missing: no help slots; #732 |

### M. PivotTableSetup

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| View: rows, columns, values ("Count of Id") | material:src/qqq/components/widgets/misc/PivotTableSetupWidget.tsx:765-774; material:src/qqq/components/widgets/misc/PivotTableGroupByElement.tsx:190-201; material:src/qqq/components/widgets/misc/PivotTableValueElement.tsx:256-265 | src/components/widgets/PivotTableSetupWidget.tsx:78-131 | WID-029, RPT-009 | Done |
| View: "does not use a Pivot Table" from the usePivotTable flag | material:src/qqq/components/widgets/misc/PivotTableSetupWidget.tsx:761-764 | src/components/widgets/PivotTableSetupWidget.tsx:95-101 | none | Partial: Flag ignored; only an empty definition is detected; #722 |
| Edit: "Use Pivot Table?" header toggle (off clears pivotTableJson) | material:src/qqq/components/widgets/misc/PivotTableSetupWidget.tsx:233-243, 486-490 | none | none | Missing: no toggle; #722 |
| Edit: "Edit Pivot Table" modal, disabled until a table and columns exist | material:src/qqq/components/widgets/misc/PivotTableSetupWidget.tsx:476-481, 551-559, 776-807 | none | none | Missing: no editor modal; #722 |
| Edit: add and remove row or column group-bys (picker limited to report columns, used fields excluded) | material:src/qqq/components/widgets/misc/PivotTableSetupWidget.tsx:258-268, 579-603; material:src/qqq/components/widgets/misc/PivotTableGroupByElement.tsx:184-227 | none | none | Missing: no group-by editing; #722 |
| Edit: add and remove values with an aggregate filtered by field type | material:src/qqq/components/widgets/misc/PivotTableValueElement.tsx:181-336; material:src/qqq/models/misc/PivotTableDefinitionModels.ts:86-140 | none | none | Missing: no value editing; #722 |
| Edit: drag to reorder rows, columns and values | material:src/qqq/components/widgets/misc/PivotTableSetupWidget.tsx:451-473; material:src/qqq/components/widgets/misc/PivotTableGroupByElement.tsx:78-160 | none | none | Missing: no drag reorder; #722 |
| Edit: "Missing value in N fields" validation, then OK saves pivotTableJson | material:src/qqq/components/widgets/misc/PivotTableSetupWidget.tsx:639-726 | none | none | Missing: no validation or save; #722 |

### N. CronUI

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| View: expression, backend description, time zone | material:src/qqq/components/widgets/misc/CronUIWidget.tsx:688-740 | src/components/widgets/CronUIWidget.tsx:210-249 | WID-026, RPT-012 | Done |
| Cron on the record edit screen, with a time-zone select | material:src/qqq/components/widgets/misc/CronUIWidget.tsx:744-860; material:src/qqq/components/forms/EntityForm.tsx:585-599, 910 | src/components/forms/DynamicForm.tsx:109-116 (plain fields) | RPT-012 | Partial: No builder; #702 |
| Basic days picker (every day, weekdays, dates) | material:src/qqq/components/widgets/misc/CronUIWidget.tsx:778-795, 1063-1127 | none | none | Missing: no days picker; #702 |
| Basic hours picker | material:src/qqq/components/widgets/misc/CronUIWidget.tsx:796-806 | none | none | Missing: no hours picker; #702 |
| Basic minutes picker | material:src/qqq/components/widgets/misc/CronUIWidget.tsx:807-818 | none | none | Missing: no minutes picker; #702 |
| Basic/Advanced toggle (Basic disabled for unsupported expressions) and Clear | material:src/qqq/components/widgets/misc/CronUIWidget.tsx:250-263, 596-617, 746-763 | none | none | Missing: no toggle or Clear; #702 |
| Advanced raw expression with a tooltip naming the part under the caret | material:src/qqq/components/widgets/misc/CronUIWidget.tsx:624-682, 820-840 | src/components/forms/DynamicForm.tsx raw text field | RPT-012 | Partial: No part tooltip; #702 |
| Live description or error while typing | material:src/qqq/components/widgets/misc/CronUIWidget.tsx:382-427, 866-869 | src/components/widgets/CronUIWidget.tsx:119-207 (editable mode) | none | Missing: Next's editable CronUIWidget mode is never used; #702 |

### O. DataBagViewer

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Versions list, selection, JSON contents | material:src/qqq/components/widgets/misc/DataBagViewer.tsx:197-237, 298-350 | src/components/widgets/DataBagViewerWidget.tsx:69-173 | WID-028 | Done |
| Data Preview tab (expandable JSON tree) | material:src/qqq/components/widgets/misc/DataBagViewer.tsx:295, 351-369; material:src/qqq/components/databags/DataBagPreview.tsx:81-123 | none | none | Missing: no preview tree; #724 |
| "Edit", "Edit and Activate", "Create New Version" open a JSON editor modal with a Preview toggle | material:src/qqq/components/widgets/misc/DataBagViewer.tsx:239-254, 321-325, 374-382; material:src/qqq/components/databags/DataBagDataEditor.tsx:162, 168 | none | none | Missing: no editor; #724 |
| Save a version (invalid JSON blocked, commit message, storeDataBagVersion) | material:src/qqq/components/databags/DataBagDataEditor.tsx:72-107, 197-201; material:src/qqq/components/widgets/misc/DataBagViewer.tsx:143-172 | none | none | Missing: no save; #724 |

### P. DynamicForm and field rules

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| View: labeled values, noFieldsMessage | material:src/qqq/components/widgets/misc/DynamicFormWidget.tsx:177-183, 226-251 | src/components/widgets/DynamicFormWidget.tsx:73-98 | WID-027 | Done |
| Edit: typed inputs in the record edit form (e.g. scheduled-report inputs) | material:src/qqq/components/widgets/misc/DynamicFormWidget.tsx:62-74, 157-220; material:src/qqq/components/forms/EntityForm.tsx:550-560, 902 | none | none | Missing: no editing in forms; #722 |
| Edit: values merged as JSON into mergedDynamicFormValuesIntoFieldName | material:src/qqq/components/widgets/misc/DynamicFormWidget.tsx:123-151 | none | none | Missing: no merged JSON value; #722 |
| Edit: report variables entered in a dynamicForm widget on a process screen (saved report with variables) | material:src/qqq/components/widgets/misc/DynamicFormWidget.tsx:41-110 (isEditable, defaultValues.isEditable) | src/components/widgets/DynamicFormWidget.tsx (read-only) | none | Missing: read-only in processes; #736 |

## Supplemental metadata and theme

This area covers the Material Dashboard supplemental metadata (table, field, app and instance settings), form adjusters and field rules, the theme metadata, and the CSS and test hooks that integrators target. It merges the theme and CSS-hook rows of the shell draft and the form-adjuster rows of the records draft.

What the backend sends:

- Legacy `/metaData` sends `supplementalInstanceMetaData`, keyed by name: `materialDashboard` for instance settings and the `MaterialDashboardThemeMetaData` class name for the theme (qqq:qqq-backend-core/src/main/java/.../actions/metadata/MetaDataAction.java:272; material:src/App.tsx:71).
- Legacy `/metaData/table/X` sends `supplementalTableMetaData`, and each field carries `supplementalFieldMetaData` (qqq:qqq-backend-core/src/main/java/.../model/metadata/frontend/QFrontendTableMetaData.java:202-219; qqq:qqq-backend-core/src/main/java/.../model/metadata/frontend/QFrontendFieldMetaData.java:112-121).
- v1 `/qqq/v1/metaData` sends no instance supplemental metadata, only apps, appTree, tables, processes, widgets and branding (qqq:qqq-middleware-javalin/src/main/java/.../specs/v1/responses/MetaDataResponseV1.java:60-113). App `supplementalAppMetaData` is sent (qqq:qqq-middleware-javalin/src/main/java/.../specs/v1/responses/components/AppMetaData.java:156).
- v1 table metadata uses the key `supplementalMetaData`, not `supplementalTableMetaData` (qqq:qqq-middleware-javalin/src/main/java/.../specs/v1/responses/components/TableMetaData.java:160). v1 field metadata has none (`// todo supplemental...` at qqq:qqq-middleware-javalin/src/main/java/.../specs/v1/responses/components/FieldMetaData.java:240).
- The backend `QBrandingMetaData` has no `customCss`; only the Material theme metadata defines it.
- Next: `loadMetaData` (src/lib/api/metadata.ts) uses v1 and calls the legacy route only to backfill widgets and reports, never merging `supplementalInstanceMetaData`; `loadTableMetaData` expects `supplementalTableMetaData` (src/types/metadata.ts:166). Net effect: Next reads no Material supplemental metadata, `setTheme` in src/lib/theme/theme-provider.tsx is never called, and the `branding.customCss` it reads (src/app/(dashboard)/layout.tsx:156-179) is never sent.

### Form adjusters and field rules

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Table `fieldRules` ON_CHANGE + CLEAR_TARGET_FIELD | material:src/main/java/.../model/metadata/MaterialDashboardTableMetaData.java:60; material:src/main/java/.../model/metadata/fieldrules/FieldRule.java:36-41; material:src/qqq/components/forms/EntityForm.tsx:669-687,1565-1577 | none | none | Missing: editing the source field does not clear its targets; #720 |
| fieldRules RELOAD_WIDGET (re-fetch a form-section widget with the new source value) | material:src/main/java/.../model/metadata/fieldrules/FieldRuleAction.java:30-31; material:src/qqq/components/forms/EntityForm.tsx:1544-1584 | none | none | Missing: no widget reload on field change; #720 |
| Saved-report enricher: changing `tableName` clears `queryFilterJson`/`columnsJson`/`pivotTableJson` | material:src/main/java/.../savedreports/SavedReportTableFrontendMaterialDashboardEnricher.java:42-57 | none | RPT-009 (adjacent) | Missing: stale filter and columns remain after the table changes; #720 |
| Table `onLoadFormAdjuster`: POST `/material-dashboard-backend/form-adjuster/table:{t}/onLoad` before create/edit renders | material:src/main/java/.../model/metadata/MaterialDashboardTableMetaData.java:64,172-189; material:src/qqq/components/forms/EntityForm.tsx:712-800,1036-1040 | none | none | Missing: needs legacy table metadata or a v1 key fix, plus the call; #720 |
| Field `onChangeFormAdjuster` (on change for file/checkbox/possible values, on blur for text) | material:src/main/java/.../model/metadata/MaterialDashboardFieldMetaData.java:8,21-33; material:src/qqq/components/forms/DynamicForm.tsx:189-250 | none | none | Missing: v1 sends no field supplemental metadata; #720 |
| Field `onLoadFormAdjuster` (per field, on mount) | material:src/main/java/.../model/metadata/MaterialDashboardFieldMetaData.java:9; material:src/qqq/components/forms/DynamicForm.tsx:166-185 | none | none | Missing: same delivery gap as the onChange adjuster; #720 |
| `formAdjusterIdentifier` builds the adjuster URL (validator requires it) | material:src/main/java/.../model/metadata/MaterialDashboardFieldMetaData.java:7,59-78 | none | none | Missing: no adjuster URL built; #720 |
| `fieldsToDisableWhileRunningAdjusters` (fields read-only during the call) | material:src/main/java/.../model/metadata/MaterialDashboardFieldMetaData.java:10; material:src/qqq/components/forms/DynamicForm.tsx:268-313 | none | none | Missing: fields stay editable during adjuster calls; #720 |
| Adjuster output `updatedFieldMetaData` (replace field definitions: hidden, required, editable, label) | material:src/main/java/.../actions/formadjuster/FormAdjusterOutput.java:37; material:src/main/java/.../actions/formadjuster/FormAdjusterOutputBuilder.java:81-243; material:src/qqq/components/forms/DynamicForm.tsx:318-347 | none | none | Missing: field definitions cannot change at runtime; #720 |
| Adjuster output `updatedFieldValues` / `updatedFieldDisplayValues` (possible-value labels) | material:src/main/java/.../actions/formadjuster/FormAdjusterOutput.java:38-39; material:src/qqq/components/forms/DynamicForm.tsx:362-382 | none | none | Missing: no adjuster-driven values; #720 |
| Adjuster output `fieldsToClear` | material:src/main/java/.../actions/formadjuster/FormAdjusterOutput.java:40; material:src/qqq/components/forms/DynamicForm.tsx:387-390 | none | none | Missing: no adjuster-driven clearing; #720 |
| Adjuster output `updatedSectionMetaData`: sections hide, relabel, appear; newly visible widget sections load on demand | material:src/main/java/.../actions/formadjuster/FormAdjusterOutput.java:41; material:src/qqq/components/forms/EntityForm.tsx:379,777-780,812 | none | none | Missing: sections are static; #720 |
| Adjuster output `isFormDisabled` / `formDisabledMessage` (fields read-only, Save disabled with tooltip, alert cannot be closed; default "You are not allowed to create/edit") | material:src/main/java/.../actions/formadjuster/FormAdjusterOutput.java:43-44; material:src/qqq/components/forms/EntityForm.tsx:785-800 | none | none | Missing: form cannot be locked by the backend; #720 |
| `RunFormAdjusterProcess` backend route (POST `/material-dashboard-backend/form-adjuster/{id}/{event}`, form params fieldName/newValue/allValues) | material:src/main/java/.../actions/formadjuster/RunFormAdjusterProcess.java:52-121; material:src/main/java/.../actions/formadjuster/FormAdjusterRegistry.java:100-116 | none | none | N/A: backend route in the Material jar; Next would call it while the jar is on the app |

### Theme

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Theme delivery: class-name key in `supplementalInstanceMetaData` feeds `createDynamicTheme` and `injectIslandVariables` | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:39-43; material:src/qqq/models/metadata/MaterialDashboardThemeMetaData.ts:26-339; material:src/App.tsx:71,509-513,682-694 | src/lib/theme/theme-provider.tsx exists; `setTheme` never called | none | Missing: not delivered by v1; #719 (backend: #406) |
| `.qqq-themed` body class only when a theme is present (scopes CSS overrides; unthemed apps unchanged) | material:src/qqq/utils/injectIslandVariables.ts:44-58; material:e2e/tests/unthemed-regression.spec.ts:132 | none | none | Missing: no themed scoping class; #719 |
| `primaryColor` (buttons, links, focus, switches, tabs, progress) | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:50; material:src/qqq/utils/createDynamicTheme.ts:168-231,480-700; material:src/qqq/utils/injectIslandVariables.ts:119 | only branding `accentColor` mapped to `--color-primary` (src/app/(dashboard)/layout.tsx:106-127) | NAV-012 (accent only) | Partial: branding accent works; theme primaryColor not read; #719 |
| `secondaryColor` | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:51; material:src/qqq/utils/createDynamicTheme.ts:175-176; material:src/qqq/styles/qqq-override-styles.css:1063 | none (static `--qqq-secondary-color`) | none | Missing: not applied; #719 |
| `backgroundColor` (body) | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:52; material:src/qqq/utils/createDynamicTheme.ts:182,486-491 | none | none | Missing: not applied; #719 |
| `surfaceColor` (Paper and cards, excluding AppBar and Alert) | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:53; material:src/qqq/utils/createDynamicTheme.ts:620-637; material:src/qqq/styles/qqq-override-styles.css:1009-1018 | none | none | Missing: not applied; #719 |
| `textPrimary` / `textSecondary` | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:54-55; material:src/qqq/utils/createDynamicTheme.ts:180-181,209-214,566-595,713-719 | none | none | Missing: not applied; #719 |
| `errorColor` / `warningColor` / `successColor` / `infoColor` | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:56-59; material:src/qqq/utils/createDynamicTheme.ts:176-205 | none (fixed tokens in src/styles/qqq-theme.css) | none | Missing: not applied; #719 |
| `preferInfoColorToPrimaryColor` (create, save, stepper, home icons, pagination use info vs primary) | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:60; material:src/qqq/assets/theme/functions/preferInfoColorToPrimaryColor.ts:63-96; material:src/qqq/styles/qqq-override-styles.css:31 | none | none | Missing: Material honors it only via `--qqq-prefer-info-color-to-primary-color`; #719 |
| `fontFamily` / `headerFontFamily` / `monoFontFamily` | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:65-66,149; material:src/qqq/utils/createDynamicTheme.ts:238-250,254-299 | none (static `--qqq-font-family`; Inter at src/app/layout.tsx:30) | none | Missing: not applied; #719 |
| `fontSizeBase`, `fontWeightLight/Regular/Medium/Bold` | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:150-154; material:src/qqq/utils/createDynamicTheme.ts:241-252,486-491; material:src/qqq/styles/qqq-override-styles.css:1040-1052 | none | none | Missing: not applied; #719 |
| Typography variants H1-H6, Body1, Body2, Button, Caption (size, weight, line height, letter spacing, text transform; about 50 properties) | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:159-208; material:src/qqq/utils/createDynamicTheme.ts:251-340 | none | none | Missing: not applied; Java has TextTransform only for Button; #719 |
| `borderRadiusGlobal` / `borderRadiusScale` (per-component default times scale) | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:71-72; material:src/qqq/utils/createDynamicTheme.ts:92-140,381-398,755-763 | none (static `--qqq-radius-*`) | none | Missing: not applied; #719 |
| Per-component radii: Button, Card, Chip, Dialog, OutlinedInput, LinearProgress, MenuPaper, PaperRounded, PopoverPaper, Tooltip | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:73-82; material:src/qqq/utils/createDynamicTheme.ts:387-398,500-711 | none | none | Missing: 10 properties not applied; #719 |
| `density` compact/normal/comfortable (spacing 6/8/10 plus `--qqq-spacing-*`) | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:83; material:src/qqq/utils/themeUtils.ts:170-183; material:src/qqq/utils/createDynamicTheme.ts:398-401,748 | none from the theme; only a per-user grid density | QRY-005 (user density only) | Missing: app-wide density not applied; #719 |
| `logoPath` / `iconPath` / `faviconPath` | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:88-90; material:src/qqq/utils/injectIslandVariables.ts:229-231 | branding logo and icon (src/components/layout/Sidebar.tsx:135-147; src/app/(dashboard)/layout.tsx:134-142) | NAV-012 | N/A: Material only emits unused CSS vars; logo and favicon come from branding |
| `customCss` injected as `<style id="qqq-custom-theme-css">` | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:95; material:src/qqq/utils/themeUtils.ts:505-528; material:src/qqq/utils/injectIslandVariables.ts:240-249 | src/app/(dashboard)/layout.tsx:156-179 reads `branding.customCss` | none | Partial: injector reads a field the backend never sends, so nothing is injected; strips `@import`/`data:` URLs Material allows; #719 |
| `iconStyle` filled/outlined/rounded/sharp/two-tone plus icon-font loading | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:100,310-313; material:src/qqq/utils/themeUtils.ts:525-575; material:src/qqq/utils/injectIslandVariables.ts:234-238 | none | none | Missing: low value; Material only sets `--qqq-icon-style` (icon base class hard-coded, material:src/qqq/assets/theme/components/icon.ts:24); #719 |
| Branded header bar: `brandedHeaderEnabled`, background and text colors, logo path, alt text, height, tagline | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:105-111; material:src/qqq/components/horseshoe/BrandedHeaderBar.tsx:37-95; material:src/App.tsx:509-512,843; material:src/qqq/components/horseshoe/sidenav/SideNavRoot.tsx:99-101; material:src/qqq/utils/injectIslandVariables.ts:88-104 | none | none | Missing: no header bar and no sidebar/content offset (`--qqq-branded-header-height`); #719 |
| `appBarBackgroundColor` / `appBarTextColor` | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:116-117; material:src/qqq/utils/injectIslandVariables.ts:223-224 | none | none | N/A: Material only sets the vars (AppBar forced transparent); usable only from customCss |
| Sidebar background, text, icon, selected background, selected text, hover background, divider colors | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:122-128; material:src/qqq/utils/injectIslandVariables.ts:79-85; material:src/qqq/styles/qqq-override-styles.css:919-969 | none (sidebar uses `--color-sidebar`; `--qqq-sidebar-*` declared in src/styles/qqq-theme.css, unused) | none | Missing: 7 properties not applied; #719 |
| Table header background/text, row hover, row selected, border colors (grid) | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:133-137; material:src/qqq/styles/qqq-override-styles.css:1085-1125; material:src/qqq/utils/createDynamicTheme.ts:680-705 | none (`--qqq-grid-*` tokens defined but unused) | none | Missing: 5 properties not applied; #719 |
| `dividerColor` / `borderColor` / `cardBorderColor` (plus `--qqq-input-border-color`) | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:142-144; material:src/qqq/styles/qqq-override-styles.css:972-997; material:src/qqq/utils/createDynamicTheme.ts:406-407,520-583 | none | none | Missing: not applied; #719 |
| Hex-color and density/iconStyle validation warnings | material:src/main/java/.../model/metadata/MaterialDashboardThemeMetaData.java:248-325 | none (backend side) | none | N/A |
| Derived CSS vars: grey-100..900, info/success/warning/error light and dark, `action-*`, `chart-*`, link color, `spacing-*` | material:src/qqq/utils/themeUtils.ts:445-500; material:docs/QQQ_THEMING_GUIDE.md:176-212 | none | none | Missing: low value; documented but not called in Material; matters only for customCss authors; #719 |
| Material `--qqq-*` variable contract (e.g. `--qqq-sidebar-background-color`, `--qqq-table-header-background-color`) targetable by app customCss | material:docs/QQQ_THEMING_GUIDE.md:164-237; material:src/qqq/utils/injectIslandVariables.ts:79-236; material:src/qqq/styles/qqq-override-styles.css:920-1125 | different names (`--qqq-sidebar-background`, `--qqq-grid-header-bg`), mostly unused (src/styles/qqq-theme.css; src/lib/theme/tokens.ts) | none | Missing: Material-targeted customCss silently does nothing; #719 |
| Component override vars `--qqq-stepper-inactive-color`, `--qqq-tooltip-*`, `--qqq-input-border-color`, `--qqq-menu-hover-color`, `--qqq-switch-track-color`, `--qqq-prefer-info-color-to-primary-color` | material:docs/QQQ_THEMING_GUIDE.md:214-237 | none | none | Missing: low value; vars not honored; #719 |
| Unthemed default look: dark gradient sidebar (#42424a to #191919) with white text; AppBar not white | material:src/qqq/styles/qqq-override-styles.css:925; material:e2e/tests/unthemed-regression.spec.ts:152-243 | light sidebar (#f0f2f6) by default | none | N/A: visually different; design decision on #711 |
| Dark mode | not implemented in Material (proposed only, material:docs/PLUGGABLE_THEMES_DESIGN.md:329; material:src/qqq/context/index.tsx:50,123, theme-dark never imported) | src/lib/theme/theme-provider.tsx:85-111 applies `.dark` from OS `prefers-color-scheme`; no toggle (`toggleDarkMode` unused) | none | N/A: Next goes dark with the OS and has no switch; design decision on #711 |
| Roboto and Material Icons fonts | material:src/qqq/utils/themeUtils.ts:544-575 | Inter plus Lucide (src/lib/utils/material-icons.ts) | NAV-005 | N/A: by design |
| UI controller flags (transparent/white sidenav, navbar variants, configurator, rtl) | material:src/qqq/context/index.tsx:32-51,111-125; material:src/qqq/components/horseshoe/NavBar.tsx:70-108 | none | none | N/A: template internals |

### CSS and test hooks

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| `data-qqq-id` on interactive elements | material:src/qqq/utils/qqqIdUtils.ts | about 839 sites across src/components | none | Done: broader than Material; used as test locators |
| `data-qqq-id` naming contract and sanitizer (`button-*`, `input-*`, `select-*`, `switch-*`, `sidenav-*`, `menu-item-*`, `tab-*`, `table-header-*`, `link-*`; lowercase, dashes, max 50 chars) | material:src/qqq/utils/qqqIdUtils.ts:28-322; material:docs/QQQ_CSS_SELECTORS_GUIDE.md | different strings (e.g. bare field name at src/components/forms/DynamicFormField.tsx:268); no sanitizer | none | Partial: ids not equal to Material's (e.g. `menu-item-bulk-edit`, `sidenav-{name}`); Material-targeted CSS and tests won't match; #731 |
| Specific hooks: `record-sidebar`, `sidenav-root/logo-area/menu-list/logout-button`, `form-section-{name}`, `record-{mode}-{table}` (header, avatar, title, button bar), `record-view-actions-menu`, `delete-confirmation-*`, `button-delete-yes/no`, `quick-views-container`, `button-query-mode-basic/advanced`, `button-filter-builder`, `app-card-{name}-icon`, `button-views` | material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:337-384; material:src/qqq/components/forms/EntityForm.tsx:467,1650-1786; material:src/qqq/pages/records/view/RecordView.tsx:1142-1357; material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:669-762; material:src/qqq/pages/apps/Home.tsx:281; material:src/qqq/components/misc/SavedViews.tsx:529 | not verified one-to-one | none | Partial: unverified; needs a selector-by-selector diff; #731 |
| `data-qqq-scope` / `QqqIdProvider` scoping (documented) | material:docs/QQQ_CSS_SELECTORS_GUIDE.md:52-72 | none | none | N/A: documented, but absent in Material too |
| Extra hooks: `data-qqq-sidenav-item-type` (user-profile, top-level-parent-app), `.qqq-sidebar-active`, MDButton ids and `data-button-variant`, `.banner.{severity}`, classes `qqq-branded-header-bar`, `recordView`, `entityForm`, `stickyBottomButtonBar`, `field-wrapper is-hidden/is-visible` | material:src/App.tsx:255,528; material:src/qqq/components/horseshoe/sidenav/SideNavCollapse.tsx:57-64; material:src/qqq/components/legacy/MDButton/index.tsx:58-59; material:src/qqq/components/buttons/DefaultButtons.tsx:47-206; material:src/qqq/components/misc/Banners.tsx:84-92; material:src/qqq/components/forms/DynamicForm.tsx:415 | src/components/layout/Banner.tsx (`banner-{slot}` id, `data-severity`); src/components/layout/Sidebar.tsx (`sidebar-*` ids); buttons `button-save`, `button-cancel`; no item-type or variant attribute | none | Partial: banner, sidebar and button hooks differ, other classes unverified; custom CSS targeting them won't match; #731 |

### Other supplemental metadata

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| No-instance-metadata fallback: `runRecordScript` process on all query and view screens (deprecated path) | material:src/qqq/components/query/QueryScreenActionMenu.tsx:126-137; material:src/qqq/pages/records/view/RecordView.tsx:561-565; material:src/App.tsx:420-440 | none | none | Missing: runRecordScript fallback; #732 |

## Windows, menus, dialogs, popovers, drawers and modals

This is a cross-cutting view that lists every Material Dashboard overlay (new window or tab, modal, dialog, menu, popover, tooltip, drawer, snackbar and alert) and repeats rows from the area sections, so its counts overlap theirs. Next-only overlays are listed as N/A so reviewers can see where Next adds a surface Material did not have.

### Shell

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Command palette dialog on `.` (ignored in inputs) | material:src/CommandMenu.tsx:79-92,457 | src/components/feedback/CommandMenu.tsx (cmdk); src/app/(dashboard)/layout.tsx:handleGlobalKeyDown | NAV-024, INT-004 | Done: Next adds Cmd/Ctrl+K and `/`, focus trap and restore |
| Palette "{Table} Actions" group (New, Copy, Edit, Audit, table processes) | material:src/CommandMenu.tsx:217-257 | none (Navigation group only) | none | Missing: palette ignores the current table; #729 |
| Palette "Recently Viewed Records" group | material:src/CommandMenu.tsx:334-367 | src/components/feedback/SearchDialog.tsx; src/components/layout/GlobalSearch.tsx (recents outside the palette) | NAV-025 | Partial: the `.`/Cmd+K palette has no recents; #729 |
| Keyboard-shortcut help dialog on `?` | material:src/CommandMenu.tsx:93-97,478-509 | src/components/feedback/KeyboardShortcutsDialog.tsx | INT-004 | Done: text aligned to Material; Next also has a header button |
| Navbar "Recently Viewed Records" dropdown (Autocomplete in a Popper) | material:src/qqq/components/horseshoe/NavBar.tsx:117-188 | src/components/layout/GlobalSearch.tsx; src/components/layout/NavigationSearchResults.tsx | NAV-025 | Done: clock glyph instead of the table icon; table icons tracked on #729 |
| Search dialog (phone search button, Next-only) | none | src/components/feedback/SearchDialog.tsx; src/components/layout/Header.tsx | NAV-026 | N/A: Next-only |
| User entry (profile collapse) and Log Out button in the side nav | material:src/App.tsx:514-530; material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:384 | src/components/layout/Sidebar.tsx:UserFooter (user menu, menu-item-logout) | SEC-021, SEC-027 | Done (different UX): user menu in the sidebar footer; Log Out takes two clicks |
| User preferences dialog (Next-only) | none | src/components/layout/UserPreferencesDialog.tsx | none | N/A: Next-only |
| Responsive off-canvas sidebar drawer | material:src/qqq/components/horseshoe/sidenav/SideNav.tsx:116-140,340-352; material:src/qqq/components/horseshoe/NavBar.tsx:252 | src/components/layout/Sidebar.tsx (drawer, closes on route change); src/components/layout/Header.tsx:82 | NAV-026, INT-008 | Done: breakpoint 768px vs 1200px |
| Mini sidebar rail with hover-to-expand | material:src/qqq/components/horseshoe/sidenav/SideNavRoot.tsx:79-91 | none | none | N/A: unreachable in Material |
| QFMD bridge `makeModal` / `makeAlert` for custom components | material:src/qqq/utils/qqq/QFMDBridge.tsx:333,366 | src/components/widgets/QqqContainerWidgets.tsx:274 (empty bridge) | none | Missing: bridge modals and alerts unavailable to custom components; #728 |
| No-apps error alert | material:src/qqq/pages/apps/NoApps.tsx:18 | src/app/(dashboard)/app/page.tsx:315 | NAV-029 | Done |
| Global error boundary / error page | none (Material has only local boundaries) | src/app/error.tsx; src/components/feedback/ErrorBoundary.tsx | none | N/A: Next-only |
| Help-content error boundary | material:src/qqq/components/misc/HelpContent.tsx:154-156 | src/components/records/HelpContent.tsx (DOMPurify) | none | Done: equivalent |

### Record screens

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Record actions menu (New, Copy, Edit, Delete, processes, Developer Mode, Audit) | material:src/qqq/pages/records/view/RecordView.tsx:470,1135; material:src/qqq/components/view/RecordViewMenus.tsx:86 | src/components/records/RecordActions.tsx (Radix dropdown: Edit, Copy, processes, Delete) | SEC-006, PRC-048 | Partial: no New or Developer Mode items; Audit is a separate button; processes not sorted by label; #723 |
| Backend VIEW_SCREEN_ACTIONS / VIEW_SCREEN_ADDITIONAL menus (RUN_PROCESS, DOWNLOAD_FILE, SUB_MENU, DIVIDER) | material:src/qqq/components/view/RecordViewMenus.tsx:48,151-190,268 | none | none | Missing: `table.menus` ignored; #723 |
| DOWNLOAD_FILE menu item opens a new window | material:src/qqq/pages/records/view/RecordView.tsx:907-928 | none | none | Missing: no download-file menu item; #723 |
| Developer Mode menu entry -> `/{table}/{id}/dev` | material:src/qqq/components/view/RecordViewMenus.tsx:215 | route src/app/(dashboard)/app/[slug]/[recordId]/dev/page.tsx exists but nothing links to it | none | Missing: page reachable only by URL; #723 |
| Record developer view: associated scripts, versions, edit, test, logs, success snackbar | material:src/qqq/pages/records/view/RecordDeveloperView.tsx:139,157,206 | src/app/(dashboard)/app/[slug]/[recordId]/dev/page.tsx; src/components/records/AssociatedScriptViewer.tsx | REC-054 | Done |
| Table developer view: API docs and playground (RapiDoc, API and version selectors) | material:src/qqq/pages/records/developer/TableDeveloperView.tsx:73,121,244 | src/app/(dashboard)/app/[slug]/dev/page.tsx; src/components/records/TableApiDocs.tsx | REC-053 | Done: the sample has no qqq-middleware-api, so acceptance covers the no-API state; #738 |
| Audit modal (menu item, `a` key, `#audit` hash) | material:src/qqq/pages/records/view/RecordView.tsx:297,430,1389; material:src/qqq/components/audits/AuditBody.tsx:413 | src/components/records/AuditHistoryDialog.tsx; src/components/records/RecordViewHeader.tsx (Audit button, `a`, #audit) | REC-042, REC-043, REC-055, REC-050 | Done: button instead of menu item; backdrop click also closes |
| Audit modal sort toggle, date group headers, "Showing first N of M" | material:src/qqq/components/audits/AuditBody.tsx:66,340,374,401 | src/components/records/AuditHistoryDialog.tsx (flat list, newest first) | REC-042 | Partial: no sort toggle, date groups or truncation message; #723 |
| Share modal (current shares, add, edit scope, remove; Esc/backdrop ignored; Done) | material:src/qqq/components/sharing/ShareModal.tsx:133,366 | src/components/sharing/ShareDialog.tsx | RPT-013, RPT-014, RPT-015, RPT-017, RPT-018 | Done |
| Share button disabled tooltip "Only the owner of a X may share it." | material:src/qqq/pages/records/view/RecordView.tsx:960 | src/components/sharing/ShareDialog.tsx:ShareButton | RPT-017 | Done |
| Share audience autocomplete (searchable users and groups) | material:src/qqq/components/sharing/ShareModal.tsx:343,395 | src/components/sharing/ShareDialog.tsx (native select, first page of values) | RPT-013 | Partial: no search; #723 |
| Share modal inline error alert | material:src/qqq/components/sharing/ShareModal.tsx:381 | src/components/sharing/ShareDialog.tsx | none | Done |
| Delete confirmation dialog ("Confirm Deletion", No / Yes) | material:src/qqq/pages/records/view/RecordView.tsx:1335-1342 | src/components/records/DeleteConfirmDialog.tsx | REC-012, INT-003 | Done |
| Go To button and dialog on the record view | material:src/qqq/pages/records/view/RecordView.tsx:1110 | src/components/records/RecordViewHeader.tsx; src/components/records/GotoRecordDialog.tsx | QRY-067 | Done |
| Process modal over a record (`/{table}/{id}/{process}`, `#/launchProcess=`, menu) | material:src/qqq/pages/records/view/RecordView.tsx:360-385,1365; material:src/App.tsx:383-388 | src/app/(dashboard)/app/[slug]/[recordId]/[action]/page.tsx; src/components/process/ProcessRun.tsx:processReturnPath | PRC-001, NAV-034, NAV-035, REC-050 | Done (different UX): runs as a full page that returns to the record |
| Create-child modal (`#/createChild=`, child list "Add new", association "+ Add") | material:src/qqq/pages/records/view/RecordView.tsx:397-429,1374; material:src/qqq/components/widgets/Widget.tsx:253-285 | src/components/records/CreateChildFromLinkDialog.tsx; src/components/widgets/ChildRecordListWidget.tsx:addChildHref; src/components/records/AssociatedRecords.tsx:CreateChildRecordDialog | REC-051, RPT-012, REL-003, REL-008 | Done: create dialog over the parent with presets locked |
| `/{table}/{id}/createChild/{child}` path opens the create modal | material:src/App.tsx:329-333; material:src/qqq/pages/records/view/RecordView.tsx:400 | none | none | Missing: path route not handled; #723 |
| Child-record edit modal inside the create/edit form (add, edit, delete child rows) | material:src/qqq/components/forms/EntityForm.tsx:192-340,1805 | none | none | Missing: no child editing in forms; #722 |
| Phone record action sheet (Next-only) | none | src/components/records/RecordViewHeader.tsx (mobile-actions-sheet, role=dialog) | none | N/A: Next-only |
| Record hover cards on links (Next-only) | none | src/components/records/RecordHoverCard.tsx | REC-036 | N/A: Next-only |
| REVEAL button (show/hide, copy with "Copied To Clipboard" tooltip) | material:src/qqq/utils/qqq/ValueUtils.tsx:670,712-721 | src/components/records/FieldValue.tsx:RevealField | REC-033 | Done |
| Field help tooltip on view labels | material:src/qqq/pages/records/view/RecordView.tsx:130 | src/components/records/FieldLabel.tsx (Radix tooltip) | REC-039 | Done |
| Field help tooltip in forms | material:src/qqq/components/forms/DynamicForm.tsx:424 | src/components/forms/DynamicFormField.tsx:FieldHelpTooltip | REC-039 | Done |
| File input controls (Current File link, remove) | material:src/qqq/components/forms/FileInputField.tsx:90,101,120 | src/components/forms/field-types/FileUploadField.tsx | REC-035, REC-022 | Done |
| Form disabled message (isFormDisabled: Save disabled with tooltip, alert not closable) | material:src/qqq/components/forms/EntityForm.tsx:785,1657 | none | none | Missing: no form-disable support; #720 |
| Unsaved-changes guard dialog (Next-only; Material forms have none) | none (only ScriptEditor beforeunload) | src/components/forms/UnsavedChangesDialog.tsx; src/components/forms/EntityForm.tsx beforeunload | REC-008 | N/A: Next-only |
| Record not-found and unique-key lookup error alerts | material:src/qqq/pages/records/view/RecordView.tsx:1180; material:src/qqq/pages/records/view/RecordViewByUniqueKey.tsx:156 | src/components/records/RecordView.tsx; src/app/(dashboard)/app/[slug]/key/page.tsx | REC-003, NAV-023 | Done |
| Blob "Open file" in a new window / download | material:src/qqq/utils/HtmlUtils.ts:137,146 | src/components/records/FieldValue.tsx:FileLinks | REC-022 | Done: mechanics differ (base64 data URL) |

### Query screen

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Export menu CSV / XLSX / JSON | material:src/qqq/pages/records/query/RecordQuery.tsx:627-640 | src/components/query/ExportButton.tsx (menu) | QRY-040, QRY-041, QRY-042 | Done: in the toolbar instead of a header icon |
| Export opens a "Generating file..." window | material:src/qqq/components/query/ExportMenuItem.tsx:85 | src/components/query/ExportButton.tsx:runExport (in-page blob download) | QRY-040 | Done (different UX): no new tab |
| Actions menu (bulk items, table processes, generic processes, Developer Mode, "No actions") | material:src/qqq/components/query/QueryScreenActionMenu.tsx:73-164 | src/components/query/ProcessLauncherMenu.tsx:buildActionEntries | QRY-034, QRY-035, QRY-062, QRY-063, PRC-048 | Partial: no Developer Mode entry; generic icons; #717 |
| Process modal over the query (`/{table}/{process}`) | material:src/qqq/pages/records/query/RecordQuery.tsx:1644-1670,3374; material:src/App.tsx:369-381 | src/components/query/RecordQuery.tsx:launchProcess; src/components/process/ProcessRun.tsx:processReturnPath | PRC-005, NAV-034, NAV-035 | Done (different UX): runs as a full page that returns to the query |
| Bulk edit / bulk delete / bulk insert modals launched over the query | material:src/qqq/pages/records/query/RecordQuery.tsx:1697-1760,3374 | src/components/query/ProcessLauncherMenu.tsx; src/components/query/BulkActionBar.tsx -> process page | QRY-031, QRY-032, QRY-034, NAV-034, NAV-035 | Done (different UX): full page that returns to the query |
| Selection menu (page, full query, subset, clear) | material:src/qqq/components/buttons/MenuButton.tsx:120; material:src/qqq/pages/records/query/RecordQuery.tsx:2601 | src/components/query/SelectionMenu.tsx | QRY-030 | Done |
| Selection subset dialog | material:src/qqq/components/query/SelectionSubsetDialog.tsx:53 | src/components/query/SelectionMenu.tsx (dialog) | QRY-033 | Done |
| Go To record dialog (PK and gotoFieldNames, Enter, not-found errors) | material:src/qqq/components/misc/GotoRecordDialog.tsx:63-371; material:src/qqq/pages/records/query/RecordQuery.tsx:3193 | src/components/records/GotoRecordDialog.tsx; src/lib/utils/goto-utils.ts | QRY-067 | Done |
| Go To auto-opens, not closable, for GET-only and variant tables | material:src/qqq/pages/records/query/RecordQuery.tsx:2993-3018 | src/components/query/RecordQuery.tsx; src/components/records/GotoRecordDialog.tsx (mayClose=false) | QRY-067 | Partial: GET-only tables auto-open a non-closable Go To (QRY-067); variant tables do not combine it with the variant picker; #717 |
| Table variant dialog (required before querying) | material:src/qqq/components/query/TableVariantDialog.tsx:87 | src/components/query/VariantPicker.tsx | QRY-060, QRY-061, QRY-066 | Partial: Enter does not select; #717 |
| Column menu (sort, hide, pin, filter, copy values, stats) | material:src/qqq/pages/records/query/RecordQuery.tsx:2307-2404 | src/components/query/DataGrid.tsx (header sort click, stats icon); src/components/query/ColumnConfig.tsx (hide) | QRY-003, QRY-004, QRY-022 | Partial: no column menu; no pin, filter-from-column or copy values; #716 |
| Copy Values modal | material:src/qqq/pages/records/query/RecordQuery.tsx:3408-3440 (commented out) | none | none | N/A: dead code in Material |
| Columns panel "Columns (N)" (search, per-table switches, counts) | material:src/qqq/components/query/FieldListMenu.tsx:624; material:src/qqq/pages/records/query/RecordQuery.tsx:3058-3139 | src/components/query/ColumnConfig.tsx | QRY-004 | Partial: no search, counts or "(N)"; #716 |
| Filter panel (DataGrid FilterPanel slot, filter rows, Add Condition) | material:src/qqq/pages/records/query/RecordQuery.tsx:3313; material:src/qqq/components/query/CustomFilterPanel.tsx | src/components/query/FilterBuilder.tsx (Radix popover) | QRY-010, QRY-016, QRY-065 | Done |
| Filter-row field and possible-value autocompletes | material:src/qqq/components/query/FilterCriteriaRow.tsx:527; material:src/qqq/components/query/FilterCriteriaRowValues.tsx:351 | src/components/query/FilterBuilder.tsx:PossibleValueSingleSelect/PossibleValueMultiSelect | QRY-010, QRY-015 | Done |
| Quick filter menu (operator and value, apply on close) | material:src/qqq/components/query/QuickFilter.tsx:600 | none | none | Missing: no quick filters; #715 |
| "Add Filter" field menu | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:336-382,729-741 | none | none | Missing: no Add Filter menu; #715 |
| Clear-all filters confirm dialog | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:781 | src/components/query/FilterBuilder.tsx (button-clear-filter, no confirm) | none | Partial: no confirm dialog; #715 |
| Basic-mode disabled tooltip and "too complex" quick-filter tooltip | material:src/qqq/components/query/BasicAndAdvancedQueryControls.tsx:609-625; material:src/qqq/components/query/QuickFilter.tsx:557-567 | none | none | Missing: no basic mode; #715 |
| Criteria validation tooltips | material:src/qqq/components/query/FilterCriteriaRow.tsx:228-289 | src/lib/utils/filter-utils.ts:isCriterionComplete (no messages) | none | Partial: no messages; #715 |
| "Bulk Add Filter Values" criteria paster dialog | material:src/qqq/components/query/FilterCriteriaPaster.tsx:371 | src/components/query/FilterBuilder.tsx:TagInput (paste splits values) | none | Partial: no dialog, PV lookup or counts; #718 |
| Relative date preset menu | material:src/qqq/components/query/CriteriaDateField.tsx:246 | none | none | Missing: no presets; #718 |
| Advanced (custom expression) date dialog | material:src/qqq/components/query/AdvancedDateTimeFilterValues.tsx:214 | src/components/query/FilterBuilder.tsx:ExpressionEditor | QRY-012, QRY-013 | Done |
| Evaluated-expression tooltip on date criteria | material:src/qqq/components/query/CriteriaDateField.tsx:123-148; material:src/qqq/components/query/EvaluatedExpression.tsx | src/lib/utils/filter-utils.ts:describeExpression | QRY-012 | Partial: no evaluated-date tooltip; #718 |
| Assign filter variable popup (report setup) | material:src/qqq/components/query/AssignFilterVariable.tsx | display only (src/components/widgets/FilterAndColumnsSetupWidget.tsx) | none | Partial: no assign UI; #722 |
| Saved views menu (Your / Shared lists, actions) | material:src/qqq/components/misc/SavedViews.tsx:328-437 | src/components/query/SavedViewsMenu.tsx | QRY-050, QRY-051, QRY-052, QRY-054 | Partial: no "Create Report from Current View"; #717 |
| Saved-view dialogs: Save, Save As, Rename, Delete, inline error alert | material:src/qqq/components/misc/SavedViews.tsx:626-710 | src/components/query/SavedViewsMenu.tsx (Radix dialogs) | QRY-051, QRY-052, QRY-053 | Done |
| Saved-view unsaved-changes count and diff tooltip | material:src/qqq/components/misc/SavedViews.tsx:441-593 | src/components/query/SavedViewsMenu.tsx; src/lib/utils/saved-view-utils.ts:diffViews | QRY-052 | Partial: coarse diffs; #717 |
| Column stats modal | material:src/qqq/pages/records/query/RecordQuery.tsx:3392; material:src/qqq/pages/records/query/ColumnStats.tsx | src/components/query/ColumnStatsDialog.tsx | QRY-022, QRY-023 | Done: opened from a header icon instead of the column menu |
| Column stats Export CSV, "(grouped by hour)" label, error alert | material:src/qqq/pages/records/query/ColumnStats.tsx:182-239 | src/components/query/ColumnStatsDialog.tsx (Refresh only) | QRY-022 | Partial: no Export or grouped-by-hour label; #717 |
| Header join tooltip | material:src/qqq/pages/records/query/RecordQuery.tsx:660-701 | none | none | Missing: no join-info tooltip; #717 |
| Column-header field help tooltip | material:src/qqq/utils/DataGridUtils.tsx:368-380 | none | none | Missing: no column-header help; #716 |
| Pagination "(N distinct)" tooltip | material:src/qqq/components/query/CustomPaginationComponent.tsx:55-65 | src/components/query/Pagination.tsx | QRY-021 | Done |
| Density selector popup | material:src/qqq/pages/records/query/RecordQuery.tsx:2586 | src/components/query/RecordQueryToolbar.tsx | QRY-005 | Partial: per-table key instead of global `qqq.density`; #717 |
| Query alerts (error, count error, deleted, success, info, warning) | material:src/qqq/pages/records/query/RecordQuery.tsx:3226-3274 | src/components/query/RecordQuery.tsx (query-alert); src/components/query/RecordQueryContent.tsx (grid-error); toasts | QRY-007 | Partial: no separate count error or state.warning; grid error not dismissable; #717 |
| Error boundary "click here to fix it" (resets saved state) | material:src/qqq/pages/records/query/RecordQuery.tsx:132-180 | src/components/query/RecordQueryContent.tsx (ErrorBoundary, Try Again) | none | Partial: no state reset; #717 |
| Filter setup "Open In New Window" | material:src/qqq/pages/records/query/RecordQuery.tsx:997-1003 | none | none | Missing: no embedded query screen; #722 |

### Processes

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Process modal chrome (backdrop/Esc ignored, "Process: Step" title, Close) | material:src/qqq/pages/records/query/RecordQuery.tsx:1678-1681; material:src/qqq/pages/processes/ProcessRun.tsx:774-779 | none (process runs as a page) | none | N/A: no modal in Next |
| Cancel a process (Material leaves immediately) | material:src/qqq/pages/processes/ProcessRun.tsx:2093-2113 | src/components/process/ProcessCancelDialog.tsx | PRC-020 | Done: Next adds a confirm dialog |
| Floating form-error alert | material:src/qqq/pages/processes/ProcessRun.tsx:2312 | per-component error text (src/components/process/BulkEditFormComponent.tsx) | PRC-029 | Done |
| Bulk-edit "no editable fields" and non-distinct PV warning alerts | material:src/qqq/pages/processes/ProcessRun.tsx:848,854 | src/components/process/BulkEditFormComponent.tsx | PRC-029 | Done |
| Validation-review explanatory tooltips | material:src/qqq/components/processes/ValidationReview.tsx:209-251 | src/components/process/ValidationReviewComponent.tsx | PRC-026 | Done: tooltips became inline text |
| Process finish feedback (summary screen, "See these records in a new tab") | material:src/qqq/components/processes/ProcessSummaryResults.tsx:52-107; material:src/qqq/models/processes/ProcessSummaryLine.tsx:106-150 | src/components/process/ProcessSummaryResultsComponent.tsx; src/components/process/ProcessSummaryLines.tsx:summaryRecordsHref | PRC-027, PRC-028 | Done |
| Saved bulk-load profile menu (yours vs shared) | material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:425,511-525 | src/components/process/SavedBulkLoadProfiles.tsx (one select) | PRC-046 | Partial: no yours/shared grouping; #726 |
| Bulk-load profile Save / Save As / Delete dialogs with inline error | material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:703-742 | src/components/process/SavedBulkLoadProfiles.tsx | PRC-046 | Done |
| Bulk-load profile Rename dialog | material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:222-228,467 | none | none | Missing: no rename; #726 |
| Bulk-load "Update existing profile?" confirm | material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:773 | src/components/process/SavedBulkLoadProfiles.tsx (saves directly) | none | Partial: no update confirm; #726 |
| Bulk-load profile unsaved-changes tooltip and Reset | material:src/qqq/components/misc/SavedBulkLoadProfiles.tsx:674-695 | none | none | Missing: no change count, diff or reset; #726 |
| Bulk-load column tooltip and duplicate-header warning | material:src/qqq/components/processes/BulkLoadFileMappingForm.tsx:623-667 | none | none | Missing: no column tooltip or warning; #726 |
| Bulk-load "Add Fields" hierarchy menu (QHierarchyAutoComplete) | material:src/qqq/components/misc/QHierarchyAutoComplete.tsx:614 | src/components/process/BulkLoadFileMappingComponent.tsx:355-367 (plain select) | PRC-031 | Partial: no search, groups or tooltips; #726 |
| Bulk-load default-value and value-mapping autocompletes | material:src/qqq/components/processes/BulkLoadFileMappingField.tsx:273; material:src/qqq/pages/processes/ProcessRun.tsx:1370-1382 | src/components/process/BulkLoadFileMappingComponent.tsx; src/components/process/BulkLoadValueMappingComponent.tsx | PRC-031 | Partial: plain inputs and unsearchable select; #726 |
| Google Drive folder picker (Google Picker window) | material:src/qqq/components/processes/GoogleDriveFolderPicker.tsx | src/components/process/GoogleDriveFolderComponent.tsx (disabled button) | PRC-039 | Missing: stub only; #704 |
| Child-record edit modal in a process step (`frontendRecords`) | material:src/qqq/components/widgets/DashboardWidgets.tsx:1005-1020 | src/components/process/WidgetComponent.tsx (read-only) | none | Missing: no in-memory child edits; #725 |
| modalMode composite in a process (BUTTON controlCode show/hide/toggle) | material:src/qqq/pages/processes/ProcessRun.tsx:415-456; material:src/qqq/components/widgets/CompositeWidget.tsx:168-210 | src/components/process/ProcessBlocks.tsx:applyControlCode (toggles inline visibility) | none | Partial: no modal composites; #725 |

### Widgets

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Widget dropdown (searchable autocomplete) | material:src/qqq/components/widgets/components/WidgetDropdownMenu.tsx:341-411 | src/components/widgets/WidgetBlock.tsx:191-216 (native select) | WID-047 | Partial: no search; #728 |
| Widget DATE_PICKER popup with "Today" | material:src/qqq/components/widgets/WidgetDropdownMenu.tsx:306-337 | src/components/widgets/WidgetBlock.tsx:191-200 (native date input) | WID-048 | Partial: no Today action; #728 |
| Widget custom timeframe (start and end inputs) | material:src/qqq/components/widgets/WidgetDropdownMenu.tsx:246-286 | none | none | Missing: no custom range; #728 |
| Widget label tooltip and help content | material:src/qqq/components/widgets/Widget.tsx:785-797 | src/components/widgets/WidgetBlock.tsx:171-187; src/components/widgets/HoverTooltip.tsx | WID-043, WID-044 | Done |
| Header link-button disabled tooltip (setup widgets in edit mode) | material:src/qqq/components/widgets/Widget.tsx:182-209 | none | none | Missing: no header link button; #722 |
| Block tooltips (tooltipMap, nested composite tooltip) | material:src/qqq/components/widgets/blocks/BlockElementWrapper.tsx:99-116 | src/components/widgets/blocks/BlockSlot.tsx (Radix tooltip) | WID-023, WID-058 | Done |
| Block help content as the fallback tooltip | material:src/qqq/components/widgets/blocks/BlockElementWrapper.tsx:77-93 | none | none | Missing: no help fallback; #728 |
| composite modalMode (modal from values, sends hideModal on close) | material:src/qqq/components/widgets/CompositeWidget.tsx:168-211 | none (always inline) | none | Missing: no modal composite; #728 |
| Table widget column-header help tooltips | material:src/qqq/components/widgets/tables/TableWidget.tsx:145-157; material:src/qqq/components/widgets/tables/cells/DataTableHeadCell.tsx | none | none | Missing: no column-header help; #728 |
| Table widget `htmlAndTooltip` cell | material:src/qqq/components/widgets/tables/DataTable.tsx:76-83,402-410 | none | none | Missing: markup shows as text; #728 |
| Table widget entries-per-page autocomplete | material:src/qqq/components/widgets/tables/DataTable.tsx:455-482 | none | none | Missing: no entries-per-page select; #728 |
| ModalEditForm | material:src/qqq/components/widgets/tables/ModalEditForm.tsx:44-94 | none | none | N/A: dead code, nothing imports it |
| "There is no data available to export." browser alert() | material:src/qqq/components/widgets/Widget.tsx:660-663; material:src/qqq/components/widgets/tables/TableWidget.tsx:128; material:src/qqq/components/widgets/misc/RecordGridWidget.tsx:300 | src/components/widgets/ConnectedWidget.tsx:187-189 | WID-046 | Done: inline message instead of alert() |
| Widget error and unsupported-block alerts | material:src/qqq/components/widgets/DashboardWidgets.tsx:490; material:src/qqq/components/widgets/WidgetBlock.tsx:104 | src/components/widgets/WidgetBlock.tsx:WidgetErrorState; src/components/widgets/blocks/QqqComposite.tsx:150-160 | WID-051, WID-059 | Done |
| Widget-level error boundary (Next-only) | none | src/components/widgets/WidgetErrorBoundary.tsx | WID-051, WID-053 | N/A: Next-only |
| FilterAndColumnsSetup editor modal (full query screen) | material:src/qqq/components/widgets/misc/FilterAndColumnsSetupWidget.tsx:568-603 | none | none | Missing: no editor modal; #722 |
| PivotTableSetup editor modal | material:src/qqq/components/widgets/misc/PivotTableSetupWidget.tsx:776-807 | none | none | Missing: no editor modal; #722 |
| RowBuilder "Edit Rows" modal | material:src/qqq/components/widgets/misc/RowBuilderWidget.tsx:863-906 | none | none | Missing: no modal editor; #722 |
| CronUI days popover and caret-part tooltip | material:src/qqq/components/widgets/misc/CronUIWidget.tsx:624-682,1063 | none | none | Missing: no cron builder; #702 |
| Script editor modal (Edit, Edit and Activate, Create New Version) with commit-message dialog | material:src/qqq/components/widgets/misc/ScriptViewer.tsx:556; material:src/qqq/components/scripts/ScriptEditor.tsx:555 | src/components/records/AssociatedScriptViewer.tsx (record developer view) | REC-054 | Done |
| Script editor multi-file panes, API name/version selects, error snackbar | material:src/qqq/components/scripts/ScriptEditor.tsx:162,352-375,406 | none | none | Missing: single-file editing only; #724 |
| Script viewer save success / failure snackbars | material:src/qqq/components/widgets/misc/ScriptViewer.tsx:407,416 | src/components/records/AssociatedScriptViewer.tsx (record developer view) | REC-054 | Done |
| Data bag editor modal (JSON editor, Preview toggle, error snackbar) | material:src/qqq/components/widgets/misc/DataBagViewer.tsx:376; material:src/qqq/components/databags/DataBagDataEditor.tsx:133 | none | none | Missing: no data bag editor; #724 |
| Data bag save success / failure snackbars | material:src/qqq/components/widgets/misc/DataBagViewer.tsx:268,277 | none | none | Missing: no data bag save; #724 |

### Notifications after save, delete and process

| Material ability | Material source | Next implementation | Acceptance row(s) | Status |
|---|---|---|---|---|
| Success after create or update (inline alert on the record view) | material:src/qqq/pages/records/view/RecordView.tsx:803,1185 | src/components/forms/EntityForm.tsx toast.success (sonner, src/components/feedback/Toast.tsx) | REC-006, REC-009 | Done: toast instead of an inline alert |
| Save warning alert on the record view (record.warnings[0], "warning..." errors) | material:src/qqq/pages/records/view/RecordView.tsx:811,1195; material:src/qqq/components/forms/EntityForm.tsx:1400,1423,1662 | none (save warnings dropped) | none | Missing: no warning after save; #723 |
| Save error alert with scroll to top | material:src/qqq/components/forms/EntityForm.tsx:1482,1657 | src/components/forms/EntityForm.tsx (inline alert and toast) | REC-048, REC-027 | Done |
| Delete success message on the query screen | material:src/qqq/pages/records/view/RecordView.tsx:850; material:src/qqq/pages/records/query/RecordQuery.tsx:3243 | src/components/records/DeleteConfirmDialog.tsx (toast, then list) | REC-012 | Done: toast instead of an inline alert |
| Delete error alert | material:src/qqq/pages/records/view/RecordView.tsx:868,1205 | src/components/records/DeleteConfirmDialog.tsx (inline alert and toast) | none | Done |
| Delete error starting with "warning" shown as success with warning | material:src/qqq/pages/records/view/RecordView.tsx:862 | none (shown as an error) | none | Missing: no warning path; #723 |
| API errors from server state (Next-only global toast) | none (Material shows per-screen alerts) | src/lib/query-client.ts; src/lib/hooks/use-toast.ts | none | N/A: Next-only |

## Open gaps by issue

Rows counted are Partial or Missing rows whose status names the issue.

- #406 Complete V1 API surface for new frontend: 1 row
- #696 Next UI 1.0: independent security review of auth, session, logout and HTML sanitization: 1 row
- #702 Next UI 1.0: cronUI widget with live schedule description: 7 rows
- #704 Next UI 1.0: acceptance for the Google Drive folder picker (PRC-039): 1 row
- #715 Next UI 1.0 parity: Query basic mode and quick filters: 15 rows
- #716 Next UI 1.0 parity: Query column menu and grid columns: 12 rows
- #717 Next UI 1.0 parity: Query saved-view memory, quick views and screen polish: 27 rows
- #718 Next UI 1.0 parity: Query filter operators and value inputs: 5 rows
- #719 Next UI 1.0 parity: theme metadata (MaterialDashboardThemeMetaData): 25 rows
- #720 Next UI 1.0 parity: form adjusters and field rules: 13 rows
- #721 Next UI 1.0 parity: inline possible-value sources and chip options: 2 rows
- #722 Next UI 1.0 parity: association and widget editing in create/edit forms: 37 rows
- #723 Next UI 1.0 parity: record view layout and menus: 37 rows
- #724 Next UI 1.0 parity: developer tools (data bag editor, script docs and multi-file editing): 11 rows
- #725 Next UI 1.0 parity: process screens: widgets and blocks: 12 rows
- #726 Next UI 1.0 parity: bulk load fidelity: 16 rows
- #727 Next UI 1.0 parity: report runs: 2 rows
- #728 Next UI 1.0 parity: dashboard widget extras: 57 rows
- #729 Next UI 1.0 parity: command palette and recently viewed: 6 rows
- #730 Next UI 1.0 parity: analytics (GA4, PostHog, plugin registry): 8 rows
- #731 Next UI 1.0 parity: CSS and test hook parity: 3 rows
- #732 Next UI 1.0 parity: shell, auth and help small items: 20 rows
- #736 (title not recorded): 1 row
