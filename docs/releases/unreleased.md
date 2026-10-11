# Next UI — unreleased

[RC12 preparation](1.0.0-RC.12.md) collects every change merged since [RC11](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.11): the always-available record Actions menu ([#45](https://github.com/QRun-IO/qqq-frontend-next/issues/45)), private query-state clearing between users, standalone branding and CSP derivation, grid and report focus fixes, and browser-testing hardening. RC11 is published and immutable. Changes merged after the RC12 preparation commit are listed below. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## Features

- Support an instance home app. When the backend designates one with `QInstance.homeAppName` ([qqq#1059](https://github.com/QRun-IO/qqq/issues/1059)), and the user may open it, `/app` shows that app's dashboard (a client-side redirect, matching backends that redirect full page loads of `/app/`), the sidebar logo and the breadcrumb Home crumb link there, and the sidebar drops its separate Dashboard entry. Without a home app, or with one the user may not open, `/app` remains Next's overview.

## Product fixes

None yet.

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
