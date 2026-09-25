# Browser matrix — real-backend acceptance (QRun-IO/qqq#649)

The acceptance suite runs against the owned sample backend and the production static
export (javalin mode). The default gate runs Chromium only; the documented matrix is the
four configured Playwright projects below, in one run and one gate.

```bash
export QQQ_SAMPLE_JAR=/path/to/qqq-sample-project-<version>-jar-with-dependencies.jar
# full gate, all four projects, fresh static export
QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile node scripts/acceptance.mjs
# the same with explicit ports (use distinct ports for concurrent runs)
QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile \
  QQQ_ACCEPTANCE_BACKEND_PORT=18793 QQQ_ACCEPTANCE_FRONTEND_PORT=13793 \
  node scripts/acceptance.mjs
# one project, reusing out/ (a filtered run is a partial gate)
QQQ_ACCEPTANCE_BROWSERS=mobile node scripts/acceptance.mjs --skip-build
```

| Project  | Playwright device | Engine (Playwright 1.58.2) | Runs |
|----------|-------------------|----------------------------|------|
| chromium | Desktop Chrome    | Chrome for Testing 145     | every spec |
| firefox  | Desktop Firefox   | Firefox 146                | every spec |
| webkit   | Desktop Safari    | WebKit 26.0                | every spec |
| mobile   | Pixel 7 (412 px, touch) | Chromium             | tests tagged `@mobile` |

## Phone scope

Below 768 px the UI is a different layout by design: lists are card lists, record actions
live in an action sheet, navigation is a drawer. Specs that assert the desktop layout
(grid columns and cells, column resizing, grid keyboard navigation, desktop menus) do not
describe phone behavior, and skipping them is not allowed (skips fail the gate). The
`mobile` project therefore runs only tests whose title carries `@mobile`
(`grep: /@mobile/` in `tests/acceptance/playwright.config.ts`). Those tests run on the
desktop projects as well, either layout-neutral or pinned to a 412 px touch viewport, so
every phone scenario is also checked in Firefox and WebKit at phone width.

The phone-relevant rows and their `@mobile` tests:

| Phone behavior | Tests |
|----------------|-------|
| Navigation drawer | NAV-026, INT-008 |
| List / card view, loading state | INT-008, INT-009 (busy placeholder cards, QRun-IO/qqq#694) |
| Record view | INT-008, INT-003 |
| Forms and validation | INT-008, INT-007, PRC-009 |
| Process run | PRC-001, PRC-004, PRC-009 |
| Dialogs and focus (action sheet, delete dialog) | INT-003 (QRun-IO/qqq#694) |
| Search dialog with record search ("Open search" button) | NAV-030 (QRun-IO/qqq#701) |
| Sign-in, logout, session expiry | SEC-020, SEC-021, SEC-022 (both) |
| Accessibility scan at phone width | INT-005 |

The gate also fails any configured project that ran no tests.

## Results

Recorded 2026-09-25 on macOS (Darwin 27), sample `4.1.0-SNAPSHOT` with the #649 backend
changes including QRun-IO/qqq#674 and #675, Next static export of
`feature/GH-649-next-acceptance` with all six areas integrated (navigation, records, query,
processes, widgets, security), one run of the full gate with the four projects:

Tests passed / run, per spec area and project (the mobile project runs the `@mobile` tests only):

| Area | chromium | firefox | webkit | mobile |
|---|---|---|---|---|
| navigation | 41/41 | 41/41 | 41/41 | 1/1 |
| processes | 50/50 | 50/50 | 50/50 | 3/3 |
| query | 50/50 | 50/50 | 50/50 | — |
| records | 48/48 | 48/48 | 48/48 | — |
| security | 57/57 | 57/57 | 57/57 | 9/9 |
| widgets | 80/80 | 80/80 | 80/80 | — |
| **total** | **326/326** | **326/326** | **326/326** | **13/13** |

`—`: the area has no `@mobile` test; the phone list, record and form behavior is proven by
the interaction tests (INT-003, INT-007, INT-008, INT-009) in the security area.

Gate (`test-results/acceptance/gate.json`, 991 tests, 18.1 min, retries 0, commit `2c5eb2d`):

```json
{
  "summary": { "passed": 289, "failed": 0, "missing": 0, "excluded": 3 },
  "byProject": {
    "chromium": { "passed": 326, "failed": 0, "skipped": 0, "flaky": 0 },
    "firefox": { "passed": 326, "failed": 0, "skipped": 0, "flaky": 0 },
    "webkit": { "passed": 326, "failed": 0, "skipped": 0, "flaky": 0 },
    "mobile": { "passed": 13, "failed": 0, "skipped": 0, "flaky": 0 }
  },
  "problems": []
}
```

Every required row passes in every project that runs it. PRC-039, WID-033 and SEC-030 are
`required: false` pending approval and are reported as excluded.

## Differences found between engines

Fixed:

- **WebKit, aborted prefetches.** WebKit raises "<url> due to access control checks." as
  a page error for same-origin Next.js route prefetches and RSC payload fetches that a
  document navigation cancels; the server answered 200 and Playwright never sees the
  request. Traces confirmed every report named a `/app/...` route, `__next.*.txt` or
  `?_rsc=` payload within a millisecond of a main-frame navigation. The shared diagnostics
  fixture ignores exactly these (same origin, Next route or payload URL, within one second
  of a navigation) and lists them under `interruptedFetches`; API, cross-origin and
  unrelated access-control failures still fail the test.
- **WebKit, document title.** Next.js re-applies the static metadata title ("QQQ Admin")
  after client navigations, in WebKit after the layout set the metadata title (NAV-023,
  NAV-006). `useDocumentTitle` keeps the breadcrumb title in place.
- **Firefox, rich text.** Firefox stores a typed space before a formatting change as
  `&nbsp;`; the editor now stores engine-neutral HTML (REC-020).
- **Firefox/WebKit, computed styles.** A `CSSStyleDeclaration` returned from `evaluate()`
  only serializes in Chromium; WID-057 reads the properties inside the page.
- **WebKit keyboard order.** WebKit, like Safari, moves Tab only between form fields;
  keyboard specs use Option+Tab there (`tabKey` in `specs/security/support/ui.ts`).
- **Aborted requests.** A request aborted by the test is reported as `net::ERR_FAILED`
  (Chromium), `NS_ERROR_FAILURE` (Firefox) or "Blocked by Web Inspector" (WebKit).
- **Provider logout in Firefox.** Starting an in-app navigation just before leaving for
  the identity provider made Firefox log "Failed to fetch RSC payload". Provider logout and
  sign-in retries now leave the page without a client navigation first.
- **Set-Cookie visibility in WebKit.** WebKit hides `Set-Cookie` from page responses, so
  SEC-033 checks the logout response from Node.
- **Phone defects (QRun-IO/qqq#694).** The card list showed "No records found" while
  loading; it now shows busy placeholder cards. The record action sheet moves focus in on
  open, closes on Escape, and returns focus to its trigger, also when a dialog opened from
  one of its items closes.

Open: none.
