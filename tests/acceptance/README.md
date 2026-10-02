# Real-backend acceptance (QRun-IO/qqq#649)

Executable acceptance for every supported QQQ UI feature, against the QRun-owned sample
application and the production Next build. Mocked unit and e2e tests complement this
suite; they never replace it.

## RC1 priority: workflow depth in Chromium

For RC1, prioritize complete real-application workflows in Chromium before expanding
browser and viewport coverage. Exercise normal entry paths, defaults, validation,
editing and cancellation, saving and reopening, changing dependent selections,
permissions, failure recovery, and the resulting records or downloaded files.
Check persisted values independently through the owned backend where applicable.
Scenario counts and passing page-load checks are not evidence that every workflow works.

Use the default Chromium project for focused diagnosis and the full Chromium acceptance
gate for the candidate. Preserve existing cross-browser tests and record failures;
additional browser and responsive work follows the workflow depth pass.

## Run

```bash
# Install the QQQ Maven modules, build the sample jar, and point at it:
# mvn -DskipTests -Djacoco.skip=true install  # from the qqq repo root
# mvn -DskipTests -Djacoco.skip=true -Dcheckstyle.skip=true package  # from qqq/qqq-sample-project
export QQQ_SAMPLE_JAR=/path/to/qqq-sample-project-<version>-jar-with-dependencies.jar
pnpm test:acceptance                          # static export + full suite + gate
node scripts/acceptance.mjs --skip-build specs/records   # reuse out/, filtered (partial gate)
QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile pnpm test:acceptance
QQQ_ACCEPTANCE_MODE=standalone pnpm test:acceptance      # container-image build instead
```

- **javalin mode (default).** The static export (`pnpm build:export`, `out/`) goes on the
  classpath as `next-dashboard/`, ahead of the sample jar. `QApplicationJavalinServer` then
  serves it at `/`, which is exactly what a fresh application gets.
- **standalone mode.** Tests the Node standalone build that the container image uses.
- **API-versioned report setup.** The acceptance server loads the matching
  `qqq-middleware-api` JAR from `~/.m2/repository/com/kingsrook/qqq/qqq-middleware-api/<version>/`.
  Set `QQQ_MIDDLEWARE_API_JAR` to another path when Maven uses a different local repository.
  The fixture registers one API-aware v1 version so WID-072 uses real metadata, query and count routes.
- **Ports.** Set them with `QQQ_ACCEPTANCE_BACKEND_PORT` (default 18765) and
  `QQQ_ACCEPTANCE_FRONTEND_PORT` (default 13765). The sample's embedded Artemis broker uses
  `QQQ_ACCEPTANCE_ESB_PORT` (default 61616, passed as `qqq.sample.esb.port`). Use distinct
  HTTP and broker ports for concurrent runs. The security variant uses
  `QQQ_ACCEPTANCE_SECURITY_BACKEND_PORT` (default backend HTTP port + 10),
  `QQQ_ACCEPTANCE_SECURITY_ESB_PORT` (default main ESB port + 1, normally 61617),
  and `QQQ_ACCEPTANCE_SECURITY_IDP_PORT` (default frontend HTTP port + 10).
  Its broker setting is passed as `qqq.sample.esb.port`; explicit variant
  `options.properties` retain precedence over these defaults.
- **Results.** Output lands in `test-results/acceptance/`: `report.json`, `gate.json` (with
  per-project counts in `byProject`), the HTML report, and a trace, video and screenshot for
  each failure.
- **Transport evidence.** CI enables `QQQ_ACCEPTANCE_TRANSPORT_TRACE=1`; set it locally
  to retain `QQQ_TRANSPORT` events in the acceptance server log for documents, static
  chunks and versioned API requests. Events contain request/connection IDs, paths without
  queries, status, write byte counts and failure classes; they omit headers, cookies and
  bodies. A completed server write does not prove browser receipt or rendering. A write
  can fail even when final completion reports HTTP 200, so inspect `firstWriteFailure`
  separately. This observer is acceptance-only and adds synchronous logging overhead;
  leave the variable unset for a control run with the original handler tree. Native and
  ordinary server logs can still contain session data; keep raw evidence private.
- **Document/XHR evidence (opt-in).** Set `QQQ_ACCEPTANCE_BROWSER_TRACE=1` locally to
  attach `browser-boundary.json` through the diagnostics fixture; CI does not enable it.
  By default, only `/app/person[/]`, `/app/person/2[/]`, and `/app/person.bulkEdit[/]`
  documents on the configured UI/API origins are observed. To also capture dashboard
  documents at exactly `/app` and `/app/`, set `QQQ_ACCEPTANCE_BROWSER_TRACE_SESSION=1`
  alongside `QQQ_ACCEPTANCE_BROWSER_TRACE=1` locally. The session flag alone installs
  nothing; other dashboard paths are not included. Requests are exact method/path matches:
  GET person metadata, person record 2 and person.bulkEdit process metadata;
  POST `/qqq/v1/manageSession`, querySavedView init, person query/count and person.bulkEdit init.
  GET `/qqq/v1/manageSession` is excluded. The helper emits
  fixed aliases, document UUID/sequence/clocks, native XHR send return/throw, status and
  terminal events. It never emits URLs, query/hash values, headers, credentials, payloads,
  error messages or stacks, and adds no request headers or interception. Disabled mode
  installs no binding or init script. One listener set follows each reused XHR generation.
  Native OPENED reentry or reuse before the recorder observes the prior `loadend`
  emits one `xhr-incomplete` marker and suppresses attribution for that instance for
  its remaining lifetime. This includes overlapping requests and earlier application
  event listeners; no endpoint, generation or attempt is guessed. Excluded requests
  retain only completion state so their old events cannot impersonate later selected
  reuse; no excluded target data is emitted. Native calls and outcomes are preserved.
  Each document is limited to 512 events plus an overflow marker and 256 selected XHRs;
  Node retains at most 4096 validated events with invalid/drop counters. Missing delivery,
  overflow or missing `ready` means incomplete evidence; zero counters do not prove
  complete delivery. Lifecycle phase is the last
  observed pagehide/pageshow state, not proof of browser-internal teardown; no unload or
  beforeunload hooks are added. Snapshotting uses Node memory even after a page fails.
  Existing diagnostics, assertions and timeouts are unchanged. RSC fetches and document
  navigation are not XHRs: correlate existing Playwright/server/native traces instead.
  Send-return disproves a synchronous throw for that invocation; a pageError alone does
  not prove one. XHR load observes completion in JS, not UI rendering; successful server
  writes still do not prove receipt. Binding delivery has nonzero overhead and can be
  lost during destruction. Retain source/export/runner provenance and raw traces privately;
  passing instrumented cells do not attribute historical failures or establish a fix.
- **Browsers.** `QQQ_ACCEPTANCE_BROWSERS` picks the Playwright projects (default `chromium`).
  The documented matrix is `chromium,firefox,webkit,mobile`; results and the exact commands
  are in `docs/acceptance/browser-matrix.md`.

## Phone scope (`mobile` project)

The `mobile` project (Pixel 7: 412 px, touch) runs only tests tagged **`@mobile`** in their
title (`grep: /@mobile/` in `playwright.config.ts`). Below 768 px lists are card lists and
record actions live in an action sheet, so specs that assert desktop layout (grid columns,
resizing, grid keyboard navigation, desktop menus) are not phone scenarios and are not run
there. Skipping them with `test.skip` is not allowed: skips fail the gate.

- Tag a test `@mobile` when it proves phone behavior: navigation drawer, card list, record
  view, forms, process runs, dialogs, sign-in/out. It must also pass on the desktop projects,
  so use layout-neutral helpers (`listCell`, `listRows`, `navigation` in
  `specs/security/support/ui.ts`, `recordList` in `specs/navigation/nav-helpers.ts`), or
  pin a phone viewport with `test.use({ viewport: { width: 412, height: 839 }, hasTouch: true })`.
- Every phone-relevant row keeps at least one passing `@mobile` test; the gate fails a
  configured project that ran no tests.

## Rules

- **Tag every test with its matrix ID(s)** in the title, for example
  `test('[REC-004] edit persists after refresh', ...)`. The gate fails on:
  - a required row with no test, or any failing, skipped or flaky test for it (retries are 0);
  - an unknown ID, or a test without an ID;
  - `required: false` without an `approval` note.

  `required: false` needs James's explicit approval. Never loosen an expectation or delete
  a scenario to go green.
- **Use `test` and `expect` from `support/fixtures`.** Each test gets a freshly reset
  database, its own mock session, and a persona (`test.use({ persona: 'viewer' })`).
  - Personas are `admin`, `viewer` (reads only, no processes), `noPets`, `noProcesses`,
    `noApps` and `expired` (401 with the cookie cleared). ESB personas are `noPersonRead`
    (all permissions except `person.read`), `noEsbView`, `noEsbOperate`, `noEsbDelete`,
    and `noSyncPerson` (each removes only its named access permission). The sample sharing demo is enabled;
    choose its identity with `test.use({ user: 'bob' })` (alice by default).
  - `backend.sql(select)` reads the owned H2 database directly. Use it to verify persisted
    values independently of the UI and API.
  - `backend.api` calls the backend over HTTP as the same session. Use it to prove
    server-side enforcement.
- **Include the `diagnostics` fixture in every test.** It fails the test on page errors,
  console errors, failed or ≥400 application requests, and Content-Security-Policy
  violations (every frame forwards `securitypolicyviolation` events; they are listed as
  `cspViolations` in `diagnostics.json`). The dashboard is served with a strict policy
  (QRun-IO/qqq#695, SEC-038 to SEC-040), so a feature that needs another origin must get it
  from metadata or the application's `withNextDashboardSecurityHeadersCustomizer` hook
  (see `WidgetsFixtures.allowFakeService`), never from a loosened test. Negative scenarios
  whitelist their expected failures with `diagnostics.allow('/data/person/99 404')`. Requests that
  a navigation cancels are not failures: `ERR_ABORTED`/`NS_BINDING_ABORTED`/cancelled, and
  WebKit's "… due to access control checks." for a same-origin Next.js route prefetch or
  RSC payload reported within a second of a document navigation (listed under
  `interruptedFetches` in the attached `diagnostics.json`). Firefox legacy-font diagnostics
  are classified there only when the exact cancellation status matches a same-origin font
  request from an earlier document near navigation (aborted, or HTTP 200 before decode was cancelled), and the final document successfully
  loads and decodes that font. Every unmatched or failed-decode diagnostic still fails.
- **v1 only.** The `diagnostics` fixture also fails a test whose page calls an unversioned API
  route of a QQQ server (`/data`, `/processes`, `/widget`, `/possibleValues`, `/download`,
  `/reports`, `/metaData`, `/manageSession`, `/logout` outside `/qqq/v1`; QRun-IO/qqq#699).
  `allow()` does not waive it. Node-side `backend.api` calls may still exercise legacy routes.
- **Transient feedback.** Arm `expectToastDuringAction` before the triggering action when
  asserting a toast. It observes the visible exact text and notification count inside the
  browser (plus header clearance when requested), so driver/trace delays cannot outlast the
  notification before observation begins. Assert persistent form and database state afterwards.
- **Assert real behavior.** Check exact values, labels, counts and persisted rows. A 200
  response or a visible container is not acceptance.
- **Fixtures.** Each area owns `fixture/<Area>Fixtures.java`: `define()` adds metadata;
  `prime()` creates and seeds tables. `prime()` reruns after every reset and must be
  idempotent (DROP then CREATE). Use synthetic QRun-owned data only.
- **Matrix.** Each area owns `matrix/<area>.json` and its ID prefixes. A row has
  `id, feature, source[], fixture, scenarios[], negative[], issues[], required`.
  `docs/acceptance/feature-matrix.md` is generated from these files.

## Pinned Linux WebKit crash fix

The test runner is temporarily pinned to `@playwright/test@1.64.0-alpha-2026-10-01`: its WebKit 2369 bundle contains libsoup 3.6.6. The previous 1.58.2/WebKit 2248 bundle contains 3.6.5 and reproduced heap corruption during navigation; the same browser using the fixed library passed 110 targeted cases, and the official replacement passed 72 repeated WebKit/tablet cases against the native Linux fixture. The 110-case comparison also corrected an unrelated iframe forwarding problem; the reproduced heap crash occurred outside that iframe workflow. See [QQQ#904](https://github.com/QRun-IO/qqq/issues/904) and [upstream#42803](https://github.com/microsoft/playwright/issues/42803). This is test infrastructure, not a browser shipped with Next UI. Replace the dated pin with a stable release containing the fix after running the acceptance gate ([QQQ#973](https://github.com/QRun-IO/qqq/issues/973)); do not downgrade to the affected stable 1.63 merely to remove the prerelease suffix.
## ESB (QRun-IO/qqq#986)

The sample JAR must include its embedded Artemis broker, `personEvents` topic,
`syncPerson` subscriber, ESB app/widget, all nine management processes, and the ESB
module's real v1 routes. `EsbFixtures` requires that production wiring and fails startup
if it is absent; it never registers replacements. Its application step runs the sample subscriber, then writes an owned H2
receipt of the processed event; the failure control makes that step fail to exercise
real dead-lettering and replay. Production API responses and broker operations are
never mocked. All control routes remain on the loopback-only acceptance server.

Before each test, reset stops consumers, verifies they stopped, resumes then drains the owned
subscription and dead-letter queue, closes pooled connections, clears counters and
reseeds H2, then waits for both the subscriber and control channel to be ready.
Teardown stops and drains even when the test fails. The readiness route returns 200
only after initial fixture reset completes. The sample owns broker startup/shutdown.
The pause scenario reads actual Artemis consumer, delivery and message counts through
an owned support route: a PAUSED runner can still finish its outstanding receive,
so publishing waits until its broker consumer has closed. No fixed sleep or client
prefetch override is used.

```bash
# After building the sample JAR and production export; set QQQ_SAMPLE_JAR and
# QQQ_MIDDLEWARE_API_JAR as described above. Reserve both ports before starting.
QQQ_ACCEPTANCE_BACKEND_PORT=18961 QQQ_ACCEPTANCE_ESB_PORT=18962 \
  QQQ_ACCEPTANCE_BROWSERS=chromium \
  node scripts/acceptance.mjs --skip-build specs/esb --max-failures=1
```

`ESB-001`–`ESB-010` are required matrix rows. The sample has no management URL, so
these tests verify real trigger pause/resume/restart, topic-subscription browsing,
dead-letter replay, application/process/table permissions and unsupported-capability
hiding. Replay confirmation explicitly reports the unavailable broker count.
Successful broker-level purge/delete/move/pause and a numeric dead-letter count need
a broker management endpoint; this fixture does not claim to prove those operations.
The ESB table-probe blanket 404 diagnostic exemption is removed: unexpected failed
requests fail acceptance, and negative cases allow only their specific denial.
