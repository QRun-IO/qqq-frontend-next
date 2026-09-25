# Browser matrix — real-backend acceptance (QRun-IO/qqq#649)

The acceptance suite runs against the owned sample backend and the production static
export (javalin mode). The default gate runs Chromium only; the matrix below is the same
suite in the four configured Playwright projects.

```bash
export QQQ_SAMPLE_JAR=/path/to/qqq-sample-project-<version>-jar-with-dependencies.jar
QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile node scripts/acceptance.mjs
```

| Project  | Playwright device | Engine   |
|----------|-------------------|----------|
| chromium | Desktop Chrome    | Chromium |
| firefox  | Desktop Firefox   | Gecko    |
| webkit   | Desktop Safari    | WebKit   |
| mobile   | Pixel 7 (412 px, touch, card list view) | Chromium |

Recorded 2026-09-25 on macOS (Darwin 27), sample `4.1.0-SNAPSHOT` with the #649 backend
changes, Next static export of branch `worktree-agent-ae5700825dc9daf72` rebased on
`feature/GH-649-next-acceptance` (navigation and records areas integrated).

## Results

Full suite (navigation, records, security), one run, all four projects:

| Area       | chromium | firefox | webkit | mobile |
|------------|----------|---------|--------|--------|
| navigation | 41/41    | 41/41   | 37/41  | 41/41  |
| records    | 47/48    | 46/48   | 46/48  | 31/48  |
| security   | 54/56    | 51/56   | 48/56  | 25/56  |

Security area after the cross-browser fixes in this branch (re-run of `specs/security`):

| Area     | chromium | firefox | webkit | mobile |
|----------|----------|---------|--------|--------|
| security | 54/56    | 54/56   | 54/56  | 41/56  |

The two failures common to every project are SEC-033, which needs the backend branch
`feature/GH-649-security-backend` (QRun-IO/qqq#674, QRun-IO/qqq#675; covered there by unit
tests). It stays failing until that branch is integrated into the sample jar.

## Differences found between engines

Fixed in this branch:

- **WebKit keyboard order.** WebKit, like Safari, moves Tab only between form fields;
  keyboard specs use Option+Tab there (`tabKey` in `specs/security/support/ui.ts`).
- **Aborted requests.** A request aborted by the test is reported as `net::ERR_FAILED`
  (Chromium), `NS_ERROR_FAILURE` (Firefox) or "Blocked by Web Inspector" (WebKit).
- **Provider logout in Firefox.** Starting an in-app navigation just before leaving for
  the identity provider made Firefox log "Failed to fetch RSC payload". Provider logout and
  sign-in retries now leave the page without a client navigation first.
- **Set-Cookie visibility in WebKit.** WebKit hides `Set-Cookie` from page responses, so
  SEC-033 checks the logout response from Node.

Open:

- **WebKit, aborted prefetches.** Link prefetches cut off by the next full navigation are
  raised as page errors ("... due to access control checks"), which the shared diagnostics
  fixture treats as failures (NAV-016, NAV-023, REC-046; security specs wait for
  `networkidle` before leaving). This is harness behavior, not an application error: the
  diagnostics fixture should ignore these like `ERR_ABORTED`.
- **Phone (mobile project).** Lists render as cards below 768 px, so specs written against
  the data grid fail there (records: 17, security: 15). Product defects found this way:
  the card view has no loading state and a dialog opened from the record action sheet
  loses focus on close (QRun-IO/qqq#694). The other phone failures are grid-only
  assertions (card text, row counts, grid keyboard focus) and two sign-in timeouts
  (SEC-029, SEC-031) still to be adapted.
- **Records area.** REC-039 (tooltip text) fails in every project; REC-020 (rich text
  serialization) in Firefox; REC-039/REC-046 in WebKit — tracked by the records area.
- **Navigation area.** NAV-023/NAV-025 document titles in WebKit — tracked by the
  navigation area.
