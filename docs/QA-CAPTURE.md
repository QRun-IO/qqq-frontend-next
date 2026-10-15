# QA capture (Jam)

Optional QA bug capture for the Next UI. The backend is the `qbit-qa-capture` QBit, which publishes the `qa-capture` UI API extension (1.0.0). [Jam](https://jam.dev) is the first provider. The UI calls only the two operations in [`src/lib/api/openapi/extensions/qa-capture.json`](../src/lib/api/openapi/extensions/qa-capture.json):

| Operation | Call | Used for |
|---|---|---|
| `qaCaptureCapability` | `GET /qqq/v1/qbit/qa-capture/capability` | Whether capture is on for the signed-in user, and the Jam team, sanitizer rules, blur selectors and backend context |
| `qaCaptureReportCreate` | `POST /qqq/v1/qbit/qa-capture/report` | "Report a bug": creates a report and returns the Recording Link `jam-*` parameters |

The vendored document is hand-written from the shared contract until the QBit publishes its generated `openapi/qqq-v1/qa-capture.yaml`. Re-vendor it from the QBit before release.

## When anything loads

Capture is off unless all of the following hold. When it is off, the UI loads no Jam chunk, adds no Jam meta tags and makes no Jam request:

1. `GET /qqq/v1/version` lists the `qa-capture` extension. Otherwise the capability is never requested.
2. The user is signed in. `QaCaptureLoader` in the root providers then requests the capability once (TanStack Query, `['qqq', 'qa-capture', 'capability']`).
3. The capability has `enabled: true`, provider `jam`, a team id and sanitizer rules. Anything else counts as disabled.

When capture is enabled, `src/lib/qa-capture/jam-loader.ts` (the only module that imports Jam, and only through `import()`) does the following:

- adds `<meta name="jam:team">` and `<meta name="jam:blur">` (the server's `blurSelectors` plus `[data-qqq-secure]`);
- dynamic-imports `@jam.dev/recording-links/sdk` (0.4.0) and `@jam.dev/sdk` (1.0.1);
- calls `jam.initialize({ teamId, blurSelectors, network, console })` once, with the sanitizers;
- registers `jam.metadata(...)`.

A Vitest check fails if any other file imports Jam at runtime.

What the SDKs fetch was checked in their published source. `initialize` loads `https://js.jam.dev/recorder.js` only in two cases: the page URL has `jam-recording` (checked on load and on every `pushState`, `replaceState` or `popstate`), or `loadRecorder()` is called. It loads `https://js.jam.dev/capture.js` only while some tab has an active recorder, which it tracks with the `jam:numRecorders` localStorage counter. `jam.metadata` only stores a callback on `window.__jam__`.

The browser cannot undo the Jam SDK, so turning capture off for a user (QA mode off) takes effect on the next page load. Request-id collection stops immediately.

## QA mode

When `capability.qaMode.preferenceSection` is set, the Preferences page renders that section like any other. Saving it refetches the capability, so turning QA mode on loads Jam without a reload. While `reason` is `QA_MODE`, the header shows a "QA mode on" badge that links to the section.

## Report a bug

The user menu shows **Report a bug** when `canReport` is true, and **QA reports** when `reportsHref` is an in-app path. The UI follows that link as given and never builds table paths itself. The Next UI has no help menu (the header help button opens the keyboard shortcuts), so both entries are in the user menu only.

Report a bug sends `POST /report` with:

- the page URL, with the sanitizer `queryParamNames`, the OAuth `code`, `state` and token parameters, and every `jam-*` parameter removed;
- the title `Bug: <page title>`;
- the app, table, record id or process, resolved from `/app/<slug>[/<id>[/<process>]]` against the instance metadata;
- the last request ids;
- the frontend version, user agent and viewport.

When the response has `recordingParams`, the UI opens the recorder with `await jam.loadRecorder({ openImmediately: false })` and then `Recorder.open(params['jam-recording'], { jamParams: { 'jam-title', 'jam-reference', ... } })`. The SDK puts those parameters on the URL while recording and removes them when the recorder closes, which lets the QBit's `jam.created` webhook match the capture to the report by `jam-reference`.

Without `recordingParams`, a toast explains that an administrator must set the Recording Link in the QA capture settings. It includes a QA reports action when `reportsHref` is present.

## Sanitizers

`src/lib/qa-capture/sanitizers.ts` builds the four Jam sanitizers from `capability.sanitizer`. They are pure, synchronous and deterministic, and they never log or fetch. The server's rules always get a baseline added: the `authorization`, `proxy-authorization`, `cookie` and `set-cookie` headers; the `password`, `sessionUUID`, `accessToken`, `refreshToken`, `idToken`, `clientSecret` and `code_verifier` fields; the `code`, `state`, `access_token` and `id_token` parameters; and JWTs.

| Data | Rule |
|---|---|
| Request and response headers | `headerNames` (lowercase) are deleted |
| JSON bodies | values of `bodyFieldNames` keys are replaced at any depth (case-insensitive); `valuePatterns` are applied to every string; the body stays valid JSON |
| Form-encoded bodies | the same, field by field |
| Other text bodies, WebSocket data | `valuePatterns` |
| Request URLs | `queryParamNames` values are redacted; `valuePatterns` are applied |
| Same-origin paths under `dropPathPrefixes` | request and response bodies are dropped |
| Console arguments | object keys and string patterns as for JSON |

A `valuePatterns` entry that is not a valid RegExp makes the affected sanitizers throw. Jam then redacts that data instead of sending it (fail closed).

## Secure fields

The UI knows a value is secure from its field metadata:

- the field type is `PASSWORD`;
- the field has the `REVEAL` adornment;
- secured data restricts the field (`accessTier` is `MASKED` or `REVEALABLE`).

Elements that show or edit such a value carry `data-jam-blur` and `data-qqq-secure`. This covers `MaskedValue`, a revealed restricted value, grid password and reveal cells, record view reveal and password values, password inputs (including while shown as text) and secure text inputs. The attributes are always present and have no effect when capture is off.

## Request ids

While capture is enabled, an axios interceptor keeps the last 50 `{ id, method, path, status, at }` entries from the response header named by `capability.requestIdHeader` (default `X-Request-Id`). The path is stored without its query string. They go into the Jam metadata and the report. Disabling capture clears the buffer.

## Jam metadata

At capture time Jam receives the following, kept under 10 KB by dropping the oldest request ids first:

- the app, table, record id and process;
- the frontend version (`NEXT_PUBLIC_APP_VERSION`);
- the backend `environment`, `backendVersion` and `node` from the capability;
- the request ids;
- the report reference;
- the page path, filtered as above.

## Recording Links and sign-in

A Recording Link can open a protected page as `?jam-recording=...&jam-title=...`. The login redirect, the OIDC/OAuth2 callback and the 401 redirect already carry the query in `returnTo`. Every page load also stashes the `jam-*` parameters in sessionStorage. After sign-in they are put back on the URL with `history.replaceState`, unless the page already has a `jam-recording`. The stash expires after 30 minutes. The Jam SDK watches `replaceState`, so the recorder then opens.

The public `/qa/recorder` page for Jam domain verification is served by the QBit, not by Next. The standalone server forwards `/qa/*` to the backend.

## Content-Security-Policy

Next adds no CSP of its own. In a jar deployment the dashboard CSP comes from the QQQ server (`NextDashboardSecurityHeaders`), and the QBit or application must add the Jam origins listed in `capability.cspOrigins`. The standalone container server (`standalone/qqq-server.mjs`) adds them only when `QQQ_QA_CAPTURE_CSP=true`:

- `script-src https://js.jam.dev`
- `frame-src https://*.jam.dev`
- `connect-src https://*.jam.dev`
