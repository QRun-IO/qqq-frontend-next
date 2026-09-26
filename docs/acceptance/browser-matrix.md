# Browser matrix — real-backend acceptance (QRun-IO/qqq#649, #708)

The acceptance suite runs against the owned sample backend and the production static
export (javalin mode). The default gate runs Chromium only; the documented matrix is the
five configured Playwright projects below, in one run and one gate.

```bash
export QQQ_SAMPLE_JAR=/path/to/qqq-sample-project-<version>-jar-with-dependencies.jar
# full gate, all five projects, fresh static export
QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile,tablet node scripts/acceptance.mjs
# the same with explicit ports (use distinct ports for concurrent runs)
QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile,tablet \
  QQQ_ACCEPTANCE_BACKEND_PORT=18793 QQQ_ACCEPTANCE_FRONTEND_PORT=13793 \
  node scripts/acceptance.mjs
# the touch projects only, reusing out/ (a filtered run is a partial gate)
QQQ_ACCEPTANCE_BROWSERS=mobile,tablet node scripts/acceptance.mjs --skip-build
```

| Project  | Playwright device | Engine (Playwright 1.58.2) | Runs |
|----------|-------------------|----------------------------|------|
| chromium | Desktop Chrome    | Chrome for Testing 145     | every spec |
| firefox  | Desktop Firefox   | Firefox 146                | every spec |
| webkit   | Desktop Safari    | WebKit 26.0                | every spec |
| mobile   | Pixel 7 (412 × 839, touch) | Chromium          | tests tagged `@mobile` |
| tablet   | iPad (gen 7) (810 × 1080, touch) | WebKit      | tests tagged `@mobile` or `@tablet` |

## Phone and tablet scope (QRun-IO/qqq#708)

Below 768 px the UI uses a different layout by design:

- lists are card lists;
- filters open in a bottom sheet;
- record sections are an accordion;
- record actions are in an action sheet;
- navigation is a modal drawer.

The tablet in portrait (810 px) gets the desktop layout (grid, sidebar, tabs) with a touch
pointer. Specs that assert the desktop layout (grid columns and cells, column resizing,
grid keyboard navigation) do not describe phone behavior, and skipping them is not
allowed: skips fail the gate. The touch projects therefore run only tagged tests:

- `mobile` runs tests whose title carries `@mobile`;
- `tablet` runs tests tagged `@mobile` or `@tablet` (`grep` in
  `tests/acceptance/playwright.config.ts`).

Tagged tests also run on the desktop projects. They are either layout-neutral (helpers
`listCell`, `columnCells`, `listRows`, `navigation`, `recordList`, `openRecord` and
`recordAction` pick the grid or the cards, the tabs or the accordion) or pinned to a
412 px touch viewport, so every phone scenario is also checked in Firefox and WebKit at
phone width.

### Coverage rule, enforced by the gate

When a touch project runs, `scripts/acceptance-gate.mjs` requires every required row to
have a passing test in `mobile` and in `tablet`. The only exception is a row that records
why it is not a touch scenario (`"desktopOnly": "<reason>"`, which currently no row uses).
The result is in `summary.phone`: `covered`, `desktopOnly`, `uncovered`. The desktop-layout
variants that stay untagged (the grid-keyboard INT-001, the grid-loading INT-009, the
desktop REC-004 tab test) have phone counterparts for the same rows.

### Touch targets and layout checks

On a coarse pointer every control is at least 44 × 44 CSS px (WCAG 2.5.5). This is a
`@media (pointer: coarse)` rule in `src/styles/globals.css`, plus `pointer-coarse:`
classes in components. It covers:

- buttons, inputs, selects, tabs, menu items and options;
- a label wrapping a checkbox, radio or switch;
- breadcrumbs, sidebar entries, record links and widget block links.

Links in running text and data values keep their inline size. Mouse layouts are unchanged
at every width, because Playwright emulates `pointer: coarse` only when `hasTouch` is set.

`tests/acceptance/support/touch.ts` provides the checks:

- `expectNoHorizontalScroll`: the page never scrolls sideways; wide data scrolls inside
  its own container;
- `expectTouchTargets` / `expectTouchReady`: no visible control below 44 px, applied only
  under a coarse pointer.

The phone and tablet specs call these on the shell, lists, filter sheet, column
configuration, bulk bar, record view and forms, dialogs and sheets, every process screen
type, dashboards and reports.

Phone behaviors with their own rows and tests:

| Phone behavior | Rows |
|----------------|------|
| Navigation drawer: tap, backdrop, keyboard focus trap, Escape, focus return | NAV-026, NAV-037 |
| Shell on phones and tablets: header, breadcrumbs, sidebar, skip link, not-found | NAV-038, NAV-014 |
| Card list: grid columns in order, formatted values, selections, loading | QRY-008, INT-009 |
| Filter sheet: modal dialog, focus in and out, Escape, scrolls inside | QRY-009 |
| Column configuration by touch | QRY-024 |
| Bulk actions from a card selection | QRY-036 |
| Saved views and export menus on a phone | QRY-055 |
| Record header and phone action sheet | REC-058, INT-003 |
| Forms with every editor type on phones and tablets | REC-059, INT-008 |
| Tooltips and help by tap (fields, widget labels, widget help) | REC-036, REC-039, WID-043, WID-044 |
| Dashboards: one column below 1024 px, wide tables scroll in their card, dropdown/date/reload/export by tap | WID-022, WID-040, WID-019, WID-045–WID-048 |
| Process screens of every type touch-ready | PRC-001–PRC-047 |
| Sign-in, logout, session expiry; accessibility scan at phone width | SEC-020–SEC-023, INT-014, INT-005 |
| TABLE_BASED password sign-in, failure, expiry and logout | SEC-034–SEC-037 (QRun-IO/qqq#700) |
| Login page branding before sign-in | NAV-033 (QRun-IO/qqq#703) |
| Search dialog with record search | NAV-030 (QRun-IO/qqq#701) |
| Keyboard use on a phone (card, action sheet, edit, save) | INT-001 |

The gate also fails any configured project that ran no tests.

## Results

Recorded 2026-09-26 on macOS (Darwin 27) for the Next UI 1.0 integration (QRun-IO/qqq#713):
the sample from the qqq `feature/next-1.0` backend (`a55c71a2d`, with the v1 supplemental
metadata, developer-mode and table-variant process routes of #714) and the Next static export
of `feature/next-1.0` (`e3bea6e`: the batch 1-3 streams, Material parity #714 and phone and
tablet coverage #708), built from a clean `.next`. One run of the full gate with the five
projects:

Tests passed / run, per spec area and project (the touch projects run the `@mobile` tests only):

| Area | chromium | firefox | webkit | mobile | tablet |
|---|---|---|---|---|---|
| navigation | 59/59 | 59/59 | 59/59 | 56/56 | 56/56 |
| performance | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| processes | 61/61 | 61/61 | 61/61 | 54/54 | 54/54 |
| query | 68/68 | 68/68 | 68/68 | 68/68 | 68/68 |
| records | 90/90 | 90/90 | 90/90 | 84/84 | 84/84 |
| security | 73/73 | 73/73 | 73/73 | 67/67 | 67/67 |
| widgets | 93/93 | 93/93 | 93/93 | 91/91 | 91/91 |
| **total** | **449/449** | **449/449** | **449/449** | **425/425** | **425/425** |

Gate (`test-results/acceptance/gate.json`, 2,197 tests, 44.3 min, retries 0, commit `e3bea6e`):

```json
{
  "summary": { "passed": 347, "failed": 0, "missing": 0, "excluded": 3,
    "phone": { "covered": 347, "desktopOnly": 0, "uncovered": 0 } },
  "byProject": {
    "chromium": { "passed": 449, "failed": 0, "skipped": 0, "flaky": 0 },
    "firefox": { "passed": 449, "failed": 0, "skipped": 0, "flaky": 0 },
    "webkit": { "passed": 449, "failed": 0, "skipped": 0, "flaky": 0 },
    "mobile": { "passed": 425, "failed": 0, "skipped": 0, "flaky": 0 },
    "tablet": { "passed": 425, "failed": 0, "skipped": 0, "flaky": 0 }
  },
  "problems": []
}
```

Every required row passes in every desktop project and in both touch projects; no row is
`desktopOnly`. PRC-039, WID-033 and SEC-030 are `required: false` pending approval and are
reported as excluded.

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
