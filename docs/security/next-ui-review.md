# Next UI security review (QRun-IO/qqq#696)

Independent review of the QQQ Next admin UI against OWASP ASVS 4.0.3 Level 2, for the
Next UI 1.0 milestone (epic QRun-IO/qqq#713). Reviewed on 2026-09-25 at
`feature/GH-649-next-acceptance` (`2b6569f`, release 0.2.0) with the backend at
`feature/GH-649-next-default` (`f7bf8c4ac`). Fixes are on `feature/next-1.0-security`
(frontend), `feature/next-1.0-security-backend` (qqq) and, for TABLE_BASED,
`feature/next-1.0-security-auth-backend` (qqq, on top of `feature/next-1.0-auth-backend`).

## Scope

- Sign-in lifecycle for every supported authentication type: MOCK, FULLY_ANONYMOUS,
  OAUTH2 (authorization code + PKCE, code redeemed by the backend) and AUTH_0
  (authorization code + PKCE as a public client). TABLE_BASED (password sign-in, being added
  in QRun-IO/qqq#700) was reviewed at the backend: session validation, password attempts
  and the protection of its user and session tables (NUI-12 to NUI-14).
- Token and session storage in the browser: the `sessionUUID` / `sessionId` cookies, the
  localStorage auth-metadata cache and stored identity, the sessionStorage PKCE attempt.
- Logout and server-side revocation (QRun-IO/qqq#674, #675).
- Post-login `returnTo` handling (QRun-IO/qqq#669).
- HTML rendering: every `dangerouslySetInnerHTML` / `innerHTML` sink (field values, grid
  cells, help content, widgets, blocks, process steps, banners, the rich text editor) and
  branding `customCss`.
- Permission gating in the UI (QRun-IO/qqq#671) and its server-side enforcement.
- Response headers for the dashboard (QRun-IO/qqq#695, delivered with this review).

Out of scope: the QQQ backend authentication modules themselves (token validation, session
store lifetime), the Material dashboard, and deployment concerns (TLS, HSTS at the proxy).

## Method

Manual code review of `src/lib/auth`, `src/lib/api`, `src/app/(auth)`, the dashboard layout
and every HTML sink, the backend session and cookie code in `qqq-middleware-javalin`, and the
built static export (inline scripts, runtime style injection, external origins). Each
finding was reproduced (unit test or browser) before it was fixed, and every fix has a
regression test: a Vitest unit test and, where the behavior is visible end to end, a row in
the real-backend acceptance matrix (`tests/acceptance/matrix/security.json`), run in
Chromium, Firefox, WebKit and the phone profile.

## Summary

| ID | Finding | ASVS 4.0.3 | Severity | Disposition |
|----|---------|------------|----------|-------------|
| NUI-01 | `returnTo` paths with dot segments normalize to `//host` (open redirect) | 5.1.5 | Medium | Fixed |
| NUI-02 | Session cookies had no `SameSite` and no `Secure` | 3.4.1, 3.4.3 | Medium | Fixed (backend) |
| NUI-03 | Sanitized HTML could still add forms, password inputs, style sheets and page-covering overlays | 5.2.1 | Medium | Fixed |
| NUI-04 | No Content-Security-Policy, framing, referrer or permissions headers on the dashboard | 14.4.3, 14.4.6, 14.4.7 | Medium | Fixed (#695) |
| NUI-05 | `sessionUUID` is readable by script (not `HttpOnly`) | 3.4.2 | Medium | Follow-up QRun-IO/qqq#733 |
| NUI-06 | Recently viewed records and the stored identity survive a session expiry and are shown to the next user of the browser | 8.2.3 | Low | Fixed |
| NUI-07 | The login page displays arbitrary `?error=` text (content spoofing) | 7.4.1 | Low | Fixed |
| NUI-08 | Unused browser auth SDKs and cookie/crypto helpers in the dependencies | 14.2.2 | Low | Fixed |
| NUI-09 | The standalone (container image) Next server sends none of the #695 headers | 14.4.3 | Low | Follow-up QRun-IO/qqq#734 |
| NUI-10 | `style-src` allows `'unsafe-inline'` | 14.4.3 | Info | Accepted |
| NUI-11 | Branding `customCss` is filtered with a deny-list | 5.2.1 | Info | Accepted |
| NUI-12 | TABLE_BASED: the inactivity timeout was not checked for 30 minutes after each validation | 3.3.2 | Medium | Fixed (backend) |
| NUI-13 | TABLE_BASED: no rate limiting or lockout of password attempts | 2.2.1 | Medium | Fixed (backend) |
| NUI-14 | TABLE_BASED: the user table (password hashes) and session table (session ids) were readable by any session unless the application protected them | 4.1.3, 8.3.4 | High | Fixed (backend) |

No Next UI finding allowed script execution, session theft without prior script execution,
or a permission bypass: the backend enforced every permission the UI hides (SEC-001 to
SEC-015 prove the refusals by API and SQL), DOMPurify removed all active content, and React
19 blocks `javascript:` URLs. The most serious finding is in the TABLE_BASED backend module
(NUI-14): its default metadata left the session table, and with it other users' session ids,
readable by any signed-in session.

## Findings

### NUI-01 Open redirect through dot segments in `returnTo` (fixed)

`safeReturnTo()` rejected `//host` and `/\host` before parsing, then returned the parsed
`pathname`. The WHATWG URL parser removes dot segments, so `/.//evil.example`,
`/..//evil.example`, `/app/..//evil.example` and `/app/../\evil.example` passed the check and
came back as `//evil.example`, which `router.replace()` treats as another origin. The login
page and the OAuth callback redirect to this value.

Fix: `src/lib/auth/return-to.ts` also rejects a normalized path that starts with `//` or
`/\`. Tests: `src/lib/auth/return-to.test.ts` (seven bypass shapes, harmless dot segments
still normalize); acceptance SEC-024 (new negative scenario, `headers.spec.ts`).

### NUI-02 Session cookies without `SameSite` and `Secure` (fixed, backend)

`sessionUUID` and `sessionId` were set with `context.cookie(name, value, maxAge)`: no
`SameSite`, no `Secure`. Chromium treats that as `Lax`, but Firefox and Safari send such
cookies with cross-site POSTs, and several legacy endpoints accept form-encoded and multipart
bodies, so another site could submit requests with the user's session (CSRF, ASVS 4.2.2).
Over HTTPS the cookies could also be sent over plain HTTP.

Fix: `QJavalinImplementation.setSessionCookie()` sets both cookies (legacy and v1
manageSession, the per-request `sessionId` refresh) with `Path=/`, `SameSite=Lax`, and
`Secure` when the request came over HTTPS (the connection or `X-Forwarded-Proto`). Plain
HTTP development keeps working. The OAuth return from the identity provider is a top-level
GET, which Lax cookies accompany. Tests: `ManageSessionSpecV1Test.testSessionCookieAttributes`;
acceptance SEC-044.

### NUI-03 Stored HTML could impersonate the application (fixed)

All sinks used DOMPurify's default profile. It removes scripts, handlers and `javascript:`
URLs, but keeps `<style>`, `<form>`, form controls and inline `position: fixed`. An HTML field
value (any user who can edit the record), a widget or a process step could therefore show a
full-page "session expired" overlay with a password field that posts elsewhere, or restyle
the whole page, inside the trusted origin.

Fix: one sanitizer, `src/lib/utils/sanitize-html.ts`, used by every sink (FieldValue,
DataCell, HelpContent, SafeHtml and the widgets that use it, BlockWidget, HtmlComponent and
ProcessStepScreen, Banner, RichTextField). It keeps DOMPurify's defaults and additionally
removes `style`, `form`, `input`, `button`, `textarea`, `select`, `option`, `optgroup`,
`datalist` and `dialog`, and drops inline `position` other than `static`/`relative`
(including `var()` values). Formatting, links, images, tables and other inline styles stay.
The Content-Security-Policy's `form-action 'self'` blocks off-site form posts as a second
layer. Tests: `src/lib/utils/sanitize-html.test.ts`; acceptance SEC-042 (a stored form,
password input, style element and fixed overlay render as plain content; the database value
is unchanged); REC-020 still passes.

### NUI-04 No security headers on the dashboard (fixed, QRun-IO/qqq#695)

`NextDashboardRouteProvider` sent only `X-Content-Type-Options`. It now sends, per
`NextDashboardSecurityHeaders`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' <custom component origins> 'sha256-<each inline script>';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:;
  connect-src 'self' <identity provider origins>; frame-src 'self' <QuickSight when used>;
  worker-src 'self' blob:; manifest-src 'self'; media-src 'self' data: blob:; object-src 'none';
  base-uri 'self'; form-action 'self'; frame-ancestors 'none'
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(),
  magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=()
X-Content-Type-Options: nosniff
```

- The static export has two inline scripts per page (the router payload bootstrap). The
  provider hashes the inline scripts of each exported HTML file once and lists exactly those
  hashes, so no other inline script, inline event handler or `javascript:` URL runs, and no
  `'unsafe-eval'` is needed.
- Origins come from metadata: OAUTH2 and AUTH_0 `baseUrl` (browser discovery and the Auth0
  token exchange), `https://*.quicksight.aws.amazon.com` when a quickSightChart widget
  exists, and each customComponent widget's `componentSourceUrl` origin.
- Override hook: `QApplicationJavalinServer.withNextDashboardSecurityHeadersCustomizer(...)`
  (or `NextDashboardRouteProvider.withSecurityHeadersCustomizer`) receives the headers after
  those additions, can add, replace or remove directives and headers, switch to report-only,
  and runs again on hot swap. Values are validated (no `;`, `,` or line breaks).
- Referrer: other origins get only the application origin, never a path or query (the
  `/token?code=` URL included).

Tests: `NextDashboardRouteProviderTest` (exact headers, hashes computed independently,
instance origins, customizer and hot swap, report-only/disabled, rejected values) and
`QApplicationJavalinServerTest`; acceptance SEC-038 (every document type, hashes match the
served document, framing refused, injected inline script and handler refused and reported),
SEC-039 (OAUTH2 and AUTH_0 sign-in under the policy, other origins refused), SEC-040 (the
acceptance application's override hook and the metadata-derived origins). The diagnostics
fixture now fails any test on a `securitypolicyviolation` event, in every frame and browser,
so the whole suite proves the policy breaks nothing.

### NUI-05 `sessionUUID` readable by script (follow-up QRun-IO/qqq#733)

The backend sets `sessionUUID` without `HttpOnly` because both dashboards read it:
the Next UI resumes OAUTH2/AUTH_0 sessions by posting the value to `manageSession`, and the
Material dashboard does the same. Making it `HttpOnly` needs a backend resume-from-cookie
path and changes in both UIs, which is outside this review. Mitigations in place: the
Content-Security-Policy blocks injected script (NUI-04), the sanitizer (NUI-03), `SameSite`
and `Secure` (NUI-02), and server-side logout invalidation (SEC-033).

### NUI-06 Per-user browser data survived session expiry (fixed)

Logout cleared the recently viewed records and stored identity, but a session that expired
(or was revoked) left them in localStorage; the next person to sign in on the browser saw the
previous user's record labels on the home page, and an OAUTH2 resume without identity values
could show the previous user's name.

Fix: `claimClientData()` (`src/lib/auth/auth-storage.ts`) binds that data to the signed-in
identity; the auth provider calls it before storing a new identity (session creation, resume
and the OAuth callback), and a different identity clears it. Tests:
`src/lib/auth/auth-storage.test.ts`; acceptance SEC-043.

### NUI-07 Login page content spoofing (fixed)

`/login?error=<text>` rendered `Sign-in failed (<text>).` for any value, so a link could put
arbitrary instructions ("call this number") on the sign-in page. React escaped it, so this
was spoofing, not injection.

Fix: `src/lib/auth/callback-errors.ts` explains known OAuth and callback codes, shows other
well-formed codes (`^[a-z][a-z0-9_]{0,63}$`) as a code, and shows `Sign-in failed.` for
anything else. Tests: `src/lib/auth/callback-errors.test.ts`; acceptance SEC-041.

### NUI-08 Unused auth dependencies (fixed)

`@auth0/auth0-react`, `oidc-client-ts`, `universal-cookie` and `ts-md5` were declared but
never imported: the flows are implemented once in `src/lib/auth/oidc.ts`. They were not in
the bundle, but looked like a second auth stack to reviewers and dependency scanners. They
are removed; `src/lib/auth/auth-dependencies.test.ts` keeps them out. (Other unused runtime
dependencies, such as `lodash` and `date-fns`, are not security-relevant and are left to the
dependency work in QRun-IO/qqq#698.)

### NUI-09 Standalone server headers (follow-up QRun-IO/qqq#734)

The container image runs the Next standalone server, which does not go through
`NextDashboardRouteProvider`. It needs the same headers; the script hashes have to be
computed from the prerendered pages after the build. Applications served by QQQ (javalin
mode, the default) have them now.

### NUI-10 `style-src 'unsafe-inline'` (accepted)

The UI creates style elements at runtime: the dialog scroll lock (react-remove-scroll /
react-style-singleton, used by every Radix dialog), sonner toasts, React's style hoisting and
branding `customCss`, and the prerendered pages carry style attributes. Hashes cannot cover
runtime styles and a per-response nonce does not fit a static export. Inline styles cannot
run script; the injection paths for style elements from data are closed by the sanitizer
(NUI-03), and image exfiltration through CSS is limited to HTTPS origins.

### NUI-11 `customCss` deny-list (accepted)

Branding `customCss` comes from the application's metadata (developer-controlled, not user
data). The layout strips `</style>`, `expression(`, `@import`, `javascript:` and `data:` URLs
and applies it through `textContent`. With the new policy it cannot load script, fonts or
frames from other origins. Accepted as trusted configuration.

### TABLE_BASED authentication (NUI-12 to NUI-14)

Added to the review scope from the TABLE_BASED work (QRun-IO/qqq#700, branch
`feature/next-1.0-auth-backend`). The fixes are on `feature/next-1.0-security-auth-backend`,
which is based on that branch and must be merged after it.

**NUI-12 Inactivity timeout not enforced promptly (fixed).**
`TableBasedAuthenticationModule.isSessionValid` trusted a validation for 30 minutes without
looking at the session's idle time, so an `inactivityTimeoutSeconds` below about 30 minutes
was not enforced; the table's access time was also only refreshed on revalidation, which
could expire an active session with a short timeout. Now the last request per session is
kept next to the last validation, a request after more than the timeout of idleness is
checked against the table again (using the later of the table's and this server's last
activity), and a validation is trusted for at most half the timeout (still at most 30
minutes). Expired validations are forgotten. Tests: `TableBasedAuthenticationModuleTest`
(`testShortInactivityTimeoutIsEnforcedPromptly`, `testActiveSessionIsNotExpiredEarly`,
`testValidationIntervalIsAtMostHalfTheTimeout`).

**NUI-13 No password attempt limiting (fixed).** Password sign-in (Basic credentials on v1
`manageSession` and every other Basic-auth path into the TABLE_BASED module) had no limit.
A soft lockout now refuses a username for `signInLockoutSeconds` (default 900) after
`maxFailedSignInAttempts` (default 5) failures within that window, before the password is
checked, with "Too many failed sign-in attempts. Try again later." Unknown usernames are
counted the same way (no enumeration; the unknown-user path already hashes). A success
resets the count; both settings are on `TableBasedAuthenticationMetaData`, and 0 disables
the lockout. The count is kept per server in memory; per-address limiting belongs at the
proxy. Tests: `TableBasedAuthenticationModuleTest` (`testSignInLockout`,
`testSignInLockoutResetAndDisable`), `TableBasedSessionSpecV1Test.testRepeatedFailuresLockTheUsernameOut`
(over HTTP; no session row is created).

**NUI-14 Authentication tables readable (fixed).** With the instance's default permission
rules (often `NOT_PROTECTED`), any signed-in session could query the user table (password
hashes) and the session table (whose ids are bearer tokens for other users' sessions).
`QInstanceEnricher` now protects the configured user and session tables of every
TABLE_BASED provider when the application has not set permission rules on them:
`READ_INSERT_EDIT_DELETE_PERMISSIONS` with `DenyBehavior.HIDDEN`, so only sessions granted
`user.read` (and so on) see them. The password hash field is always hidden, so the API never
returns it even to such users. The module reads the hash itself with hidden fields
included, and works on both tables with an internal session that holds every permission.
Applications that set their own rules keep them. Tests:
`TableBasedAuthenticationModuleTest.testAuthenticationTablesProtectedByDefault`.

## Verified without findings

| Area | What was checked | Evidence |
|------|------------------|----------|
| PKCE | S256; 32-byte verifier (43 chars); 16-byte state; state removed before comparison (single use); verifier removed after use and on failure; fixed redirect URI `{origin}/token` | `src/lib/auth/oidc.ts`, `CallbackContent.tsx`; SEC-025, SEC-026 (forged state rejected before any token exchange) |
| OAUTH2 code exchange | Redeemed by the backend with its client secret and the verifier; the browser never holds tokens | SEC-025 |
| AUTH_0 tokens | Public client with PKCE; the access token is only posted to `manageSession` and never stored; the ID token is used for display only and the backend verifies the access token against the provider keys | `auth-provider.tsx`; SEC-029, SEC-033 |
| Anonymous types | MOCK and FULLY_ANONYMOUS create a session through `manageSession`; a denied session is an error, never a silent anonymous fallback | SEC-020, SEC-023, SEC-031 |
| Logout | Backend session deleted and every issued cookie expired (#674, #675); provider end-session called; client caches, identity and recent records cleared; the tab stays signed out | SEC-021, SEC-027, SEC-033 |
| Expiry and revocation | Any 401 outside the session endpoints clears the query cache and returns to login with `returnTo`; the automatic re-authentication loop stops after three attempts a minute | `client.ts`, `auth-storage.ts`; SEC-022, SEC-028 |
| Browser storage | localStorage: auth metadata (public configuration, 10 minute TTL), display identity, recent records, UI preferences; sessionStorage: one PKCE attempt and the signed-out marker; no tokens or secrets | `auth-storage.ts`, `api/auth.ts`, `oidc.ts` |
| Links | React 19 replaces `javascript:` URLs; link adornments and file URLs are limited to http(s) and same-origin paths; every `target="_blank"` link has `rel="noopener noreferrer"` | `adornment-utils.ts`, `FieldValue.tsx`, `BlockSlot.tsx` |
| Permission gating | Tables, records, processes, reports, widgets and apps are hidden or disabled from metadata permissions and capabilities; the backend refuses the same actions | `permissions.ts`; SEC-001 to SEC-015 |
| Secrets in metadata | Widget secrets (QuickSight keys) never reach the browser | WID-015 |

## Evidence

Recorded 2026-09-25 on macOS, sample `4.1.0-SNAPSHOT` built from
`feature/next-1.0-security-backend`, static export of `feature/next-1.0-security`, the
policy on and the diagnostics fixture failing on any CSP violation:

- `QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile node scripts/acceptance.mjs`:
  chromium 337/337, webkit 337/337, mobile 15/15, firefox 336/337. The one Firefox failure
  was REC-045 (a possible-value search result not listed within 15 s under machine load; no
  diagnostics or policy violation); it passed 5 of 5 on repeat and in a rerun of the records
  area. Every new row (SEC-038 to SEC-044) passed in every project that runs it.
- Unit: `pnpm test` 96 files / 957 tests; `pnpm typecheck`; `pnpm lint` (0 errors).
- Backend: `mvn -pl qqq-middleware-javalin verify` 473 tests, checkstyle 0, coverage met;
  `mvn -pl qqq-backend-core verify` (TABLE_BASED branch) 1988 tests, checkstyle 0, coverage
  met; `TableBasedSessionSpecV1Test` 3/3.

## Residual risk and recommendations

- Session lifetime (ASVS 3.3.2) is owned by the backend authentication modules and the
  session store; cookies last 24 hours. TABLE_BASED now enforces its inactivity timeout
  (NUI-12); it has no absolute lifetime, and the other modules follow their provider.
- The TABLE_BASED lockout (NUI-13) is per server and in memory; clustered deployments get
  one budget per node, so put per-address rate limiting at the proxy as well.
- HSTS belongs at the TLS terminator in front of the application.
- NUI-05 and NUI-09 are tracked in QRun-IO/qqq#733 and #734.
