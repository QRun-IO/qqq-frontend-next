# Real-backend acceptance (QRun-IO/qqq#649)

Executable acceptance for every supported QQQ UI feature, against the QRun-owned sample
application and the production Next build. Mocked unit and e2e tests complement this
suite; they never replace it.

## Run

```bash
# Build the sample jar (qqq repo, qqq-sample-project) and point at it:
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
- **Ports.** Set them with `QQQ_ACCEPTANCE_BACKEND_PORT` (default 18765) and
  `QQQ_ACCEPTANCE_FRONTEND_PORT` (default 13765). Use distinct ports for concurrent runs.
- **Results.** Output lands in `test-results/acceptance/`: `report.json`, `gate.json`, the
  HTML report, and a trace, video and screenshot for each failure.

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
  - Personas are `admin`, `viewer` (reads only, no processes), `noPets`, `noProcesses`
    and `expired` (401 with the cookie cleared). The sample sharing demo is enabled;
    choose its identity with `test.use({ user: 'bob' })` (alice by default).
  - `backend.sql(select)` reads the owned H2 database directly. Use it to verify persisted
    values independently of the UI and API.
  - `backend.api` calls the backend over HTTP as the same session. Use it to prove
    server-side enforcement.
- **Include the `diagnostics` fixture in every test.** It fails the test on page errors,
  console errors and failed or ≥400 application requests. Negative scenarios whitelist
  their expected failures with `diagnostics.allow('/data/person/99 404')`.
- **Assert real behavior.** Check exact values, labels, counts and persisted rows. A 200
  response or a visible container is not acceptance.
- **Fixtures.** Each area owns `fixture/<Area>Fixtures.java`: `define()` adds metadata;
  `prime()` creates and seeds tables. `prime()` reruns after every reset and must be
  idempotent (DROP then CREATE). Use synthetic QRun-owned data only.
- **Matrix.** Each area owns `matrix/<area>.json` and its ID prefixes. A row has
  `id, feature, source[], fixture, scenarios[], negative[], issues[], required`.
  `docs/acceptance/feature-matrix.md` is generated from these files.
