# Next UI — unreleased

[RC33 preparation](1.0.0-RC.33.md) collects every change merged since [RC32](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.32). RC32 is published and immutable. Changes merged after the RC33 preparation commit are listed below. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## Features

- **UI API 1.6.0 (QQQ 4.1.0-RC.15).** Next reads the typed `clientCapabilities` of table metadata for saved views, sharing, bulk processes and audits, applies `field.validation` (required, length, inclusive and exclusive bounds, patterns) before a request, reads client-neutral `uiSettings` setting by setting with the deprecated `materialDashboard` values as fallback, and shows the process error `traceId`. The full `materialDashboardTheme` still wins over the `uiSettings.theme` subset. Error messages keep their order (`userFacingError`, `error`, then the new `message`). Audits fall back to the permission-filtered instance metadata when a table's capability is unavailable, since RC.15 marks unaudited tables unavailable although explicit audits can exist. Off-spec calls stay at 0.
- **What's new:** a paged release history with new badges, safe links and screenshots, notification deep links, and an unread count in the user menu. Uses UI API extension `release-notes` 1.0.0; requires qbit-release-notes 0.1.0-RC.1+.

## Product fixes

- **Logout no longer races an in-flight request.** Logout ends the API client's session generation first: every request still in flight (axios and the realtime and assistant streams) is aborted, and any response of the old generation that still arrives is discarded, so none can refresh the `sessionId` cookie the logout expires or change client auth state (SEC-037, SEC-048).

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
