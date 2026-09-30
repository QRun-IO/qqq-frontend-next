# Browser matrix — real-backend acceptance (QRun-IO/qqq#649, #708)

The acceptance suite runs against the owned sample backend and the production static
export (javalin mode). The default gate runs Chromium only; the documented matrix is the
five configured Playwright projects below. CI runs Chromium separately from phone/tablet
so the primary workflow gate can finish independently. Prioritize Chromium
workflow depth for RC1 and final 1.0; the complete final browser claim still requires all five projects.

## Verification order

First complete workflows in desktop Chromium against the real backend: normal defaults,
required and invalid inputs, dependent controls, edit/cancel, save/reopen, permission
boundaries, error recovery, and database or downloaded-file results. Expand browser and
viewport coverage after those behaviors work. Keep existing secondary results visible;
a passing row or test count does not establish that every path within a feature works.

For example, WID-073 checks report column totals and the exported value distribution
against SQL for the active filter, then verifies cancellation leaves saved data unchanged.
Opening the statistics dialog alone is insufficient evidence of that workflow.

## RC3 published checkpoint — 2026-09-29

Published source `f1a6a3a` / `v1.0.0-RC.3` passed **570 Chromium tests and all 391 required rows** in the [candidate run](https://github.com/QRun-IO/qqq-frontend-next/actions/runs/36652168977), with zero failures, skips or flaky results. The tested PR merge has the same Git tree as the tag; backend commit was `cba758507dcc54cf282a6638ab50a7d3a1904c7c`.

The candidate run is complete: mobile **545 passed**; Firefox **569 passed, one failed** (WID-005: Widget Gallery heading timeout); WebKit **568 passed, two failed** (NAV-056: application-request access-control errors; QRY-030: density-menu timeout); tablet **543 passed, two failed** (QRY-030: density-menu timeout; REC-046: WebKit internal navigation error). No skips or flaky results. Reports and traces are retained; causes remain unproven. The overall candidate run failed. The [tag run](https://github.com/QRun-IO/qqq-frontend-next/actions/runs/36654410984) passed **570 Chromium tests and all 391 required rows**. Tag WebKit passed **568 and failed two** (NAV-016 application-request access-control errors; QRY-030 density-menu timeout); tag Firefox passed **568 and failed two** (QRY-007 error toast not found; WID-073 Render Report action timeout). Tag mobile passed **545 tests**; tablet passed **543 and failed two** (NAV-026 widget-request access-control errors; QRY-030 density-menu timeout). The tag run is complete and failed overall, with zero skips or flaky results. Reports and traces are retained; no complete cross-browser pass is claimed.

The public Maven JAR passed signature/checksum checks, normal dependency resolution in a separate consumer, and seven affected Chromium workflows with independent database readback. Both image architectures are published; the actual arm64 image passed app-route and all 21 referenced JavaScript asset checks. See [RC3 release notes](../releases/1.0.0-RC.3.md) for immutable artifact checksums and limitations. Final 1.0 remains on hold.

## RC2 published checkpoint — 2026-09-29

Published source `0905cfb` / `v1.0.0-RC.2` passed **563 Chromium tests and all 390 required rows** in both its PR and tag runs. The [completed tag run](https://github.com/QRun-IO/qqq-frontend-next/actions/runs/36642612560) also passed all **538 mobile tests**. WebKit passed 561 and failed QRY-030 (density menu) and RPT-012 (internal navigation error); Firefox passed 561 and failed PRC-061 (bulk-load default selection) and INT-011 (failed-save feedback); tablet passed 537 and failed QRY-030. No tests skipped or passed through retries. The overall run failed, and failure causes remain under investigation.

The earlier PR run had a different set of secondary-browser failures. Both sets remain recorded in the [RC2 release notes](../releases/1.0.0-RC.2.md); a passing later scenario does not establish why an earlier failure occurred. The published Maven JAR was independently downloaded, signature/checksum verified, resolved by a fresh consumer and exercised in five Chromium workflows. Both container architectures are published; the arm64 image passed runtime HTML/JavaScript checks. RC2 is immutable and final 1.0 remains on hold.

The preparation checkpoints below are historical results and do not supersede this published-artifact evidence.

## Post-RC1 checkpoint — 2026-09-29

The report capability candidate `2221999` passed **562 Chromium tests**, all 390 required rows, zero failures/skips/flaky tests in [CI](https://github.com/QRun-IO/qqq-frontend-next/actions/runs/36633453712). WebKit passed 561 with one QRY-030 failure: the density option did not appear after a trigger tap. Its trace is retained and the cause remains unproven. Firefox passed 560 with two failures: NAV-014 reported an owned embedded-page request failure during navigation; SEC-003 timed out awaiting its initial record row, before the create-restriction assertions. The final screenshot shows the row, and the trace shows a roughly 15-second delay before the query was sent; the cause remains unproven. Mobile passed all 537 tests; tablet passed 536 with one QRY-030 density-menu timeout matching the desktop WebKit symptom. The run is complete and failed overall. These results precede the child-export correction.

The subsequent `542ac47` local full Chromium run passed 562 and failed WID-046: the generic parent CSV export was hidden while child dropdowns awaited selection, despite the parent's independent CSV payload. The correction preserves the selection restriction for specialized child export and restores generic payload export. Its new regression was observed failing before the fix; 29 focused tests, all 1,857 unit tests, and the production build pass. The corrected export then passed **563 Chromium tests and all 390 required rows**, with zero failures/skips/flaky tests. A clean local JAR matches the tested export byte-for-byte. Exact-commit CI and published-artifact verification remain pending; this local result does not establish artifact availability.

The preceding d937507 [CI run](https://github.com/QRun-IO/qqq-frontend-next/actions/runs/36626338487) passed **558 tests each in Chromium and WebKit**, all 390 required rows. Firefox passed **556 with two failures**: NAV-014 reported `NS_ERROR_FAILURE` for the owned embedded page during breadcrumb navigation; QRY-007 timed out hovering an application-theme error toast after it detached. Logs and traces are retained for diagnosis. All five focused breadcrumb/error-theme scenarios subsequently passed locally in Firefox against RC2 without source or test changes. That recheck does not establish the cause or resolution of the CI failures. Mobile passed 533; tablet passed 532 and failed REC-019 with a WebKit internal navigation error while opening a field-lab record. Its log and trace are retained. These results do not establish a complete cross-browser pass or erase the RC1 results below.

## RC1 checkpoint — 2026-09-29

Published candidate `e901df9` / `v1.0.0-RC.1`: Chromium **547 passed**, no failed/skipped/flaky tests, all 389 required rows passed. WebKit **546 passed, 1 failed** in NAV-034 legacy table-process redirect navigation, with an internal WebKit resource-loading error; trace retained for investigation. The completed Firefox run had 546 passes and one WID-021 widget visibility timeout; phone/tablet had 1,043 passes and one tablet SEC-002 internal WebKit navigation error. The separate tag run also had failures; see the release notes for both runs. [CI run](https://github.com/QRun-IO/qqq-frontend-next/actions/runs/36601699322). This does not establish a complete cross-browser pass.

The actual Maven Central JAR additionally passed Sleep Interactive defaults/validation/completion and report-context filtered statistics/CSV checks. The published arm64 container passed a runtime/HTML smoke check; its manifest also includes amd64. See [RC1 release evidence](../releases/1.0.0-RC.1.md).

```bash
export QQQ_SAMPLE_JAR=/path/to/qqq-sample-project-<version>-jar-with-dependencies.jar
# primary workflow gate, fresh static export
QQQ_ACCEPTANCE_BROWSERS=chromium node scripts/acceptance.mjs
# subsequent compatibility gate, all five projects, fresh static export
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

The fixes above describe earlier checkpoints. Open failures from the RC1 runs are recorded in the RC1 checkpoint and release notes; they have not been waived.


## Local density touch correction after the prepared RC4 candidate

The recurring QRY-030 density-menu failure was reproduced in Linux WebKit using
Playwright 1.58.2's official Noble image. Instrumented events showed that touch
pointer-down opened the menu, then synthetic mouse focus returned to its trigger;
Radix treated that focus as outside the non-modal menu and dismissed it. macOS
WebKit did not reproduce this event sequence.

The follow-up source applies the existing Selection/Views/Export trigger guard to
Density. It ignores outside interactions only when they target that same trigger;
other controls still dismiss the menu. No layout, dependency or timeout changed.

Both the existing density-selection test and the new touch/keyboard/outside-dismissal
regression passed with the selection-menu workflow: **nine checks across Linux
WebKit, tablet WebKit and Chromium, zero failures/skips/flaky results**. The new
regression failed before the fix. An initial added-test run used an incorrect
`textbox` locator for the searchbox; it was interrupted, retained, corrected and
rerun. The full unit suite passed 1,884 tests; production export, types, affected
lint and independent review also passed. Full Chromium verification of this density
correction remains pending. The preceding numeric-wheel correction passed its full
576-test Chromium gate and all 391 required rows.

This correction is on the isolated follow-up branch, not in published RC3 or
prepared RC4 candidate `1dbe1d9`. Historical RC3/precursor failures above remain
valid evidence for those revisions; this focused result does not certify the whole
browser matrix.
