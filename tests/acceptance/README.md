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
  `QQQ_ACCEPTANCE_FRONTEND_PORT` (default 13765). Use distinct ports for concurrent runs.
- **Results.** Output lands in `test-results/acceptance/`: `report.json`, `gate.json` (with
  per-project counts in `byProject`), the HTML report, and a trace, video and screenshot for
  each failure.
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
    `noApps` and `expired` (401 with the cookie cleared). The sample sharing demo is enabled;
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
  `interruptedFetches` in the attached `diagnostics.json`).
- **v1 only.** The `diagnostics` fixture also fails a test whose page calls an unversioned API
  route of a QQQ server (`/data`, `/processes`, `/widget`, `/possibleValues`, `/download`,
  `/reports`, `/metaData`, `/manageSession`, `/logout` outside `/qqq/v1`; QRun-IO/qqq#699).
  `allow()` does not waive it. Node-side `backend.api` calls may still exercise legacy routes.
- **Assert real behavior.** Check exact values, labels, counts and persisted rows. A 200
  response or a visible container is not acceptance.
- **Fixtures.** Each area owns `fixture/<Area>Fixtures.java`: `define()` adds metadata;
  `prime()` creates and seeds tables. `prime()` reruns after every reset and must be
  idempotent (DROP then CREATE). Use synthetic QRun-owned data only.
- **Matrix.** Each area owns `matrix/<area>.json` and its ID prefixes. A row has
  `id, feature, source[], fixture, scenarios[], negative[], issues[], required`.
  `docs/acceptance/feature-matrix.md` is generated from these files.
