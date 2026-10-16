# Next UI — unreleased

[RC36 preparation](1.0.0-RC.36.md) collects every change merged since [RC35](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.35). RC35 is published and immutable. Changes merged after the RC36 preparation commit are listed below. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## Features

- **UI API 1.6.0 (QQQ 4.1.0-RC.15).** Next reads the typed `clientCapabilities` of table metadata for saved views, sharing, bulk processes and audits, applies `field.validation` (required, length, inclusive and exclusive bounds, patterns) before a request, reads client-neutral `uiSettings` setting by setting with the deprecated `materialDashboard` values as fallback, and shows the process error `traceId`. The full `materialDashboardTheme` still wins over the `uiSettings.theme` subset. Error messages keep their order (`userFacingError`, `error`, then the new `message`). Audits fall back to the permission-filtered instance metadata when a table's capability is unavailable, since RC.15 marks unaudited tables unavailable although explicit audits can exist. Off-spec calls stay at 0.
- **What's new:** a paged release history with new badges, safe links and screenshots, notification deep links, and an unread count in the user menu. Uses UI API extension `release-notes` 1.0.0; requires qbit-release-notes 0.1.0-RC.1+.
- **Profile photo and avatars everywhere** (QQQ 4.1.0-RC.17, UI API 1.8.0 `avatars`):
  - The core **Profile** preferences section renders generically. Its photo is a `FILE_UPLOAD` field with `valueIsUploadRef`, so you can drag and drop or choose a picture, crop it square (drag, arrow keys or the zoom slider), preview it and remove it. The cropped PNG goes to `POST /uploads`, and the ref saves with the form.
  - One `UserAvatar` (photo via one batched `POST /avatars/lookup` and `GET /avatars/{avatarId}`, otherwise initials) shows people in the user menu, presence, comments, mention candidates, the people picker, activity and your own assistant messages. A missing avatar is remembered for the session, so it isn't requested again.
  - **Privacy:** branding `gravatarDefault` no longer sends your email hash to Gravatar. A Gravatar appears only if you turn it on in your Profile, and the server serves it.
  - Image fields take a full form row at every width. e2e coverage is `tests/e2e/profile-avatars.spec.ts`, including the 6-width light/dark screenshot matrix.

## Product fixes

- **Logout no longer races an in-flight request.** Logout ends the API client's session generation first: every request still in flight (axios and the realtime and assistant streams) is aborted, and any response of the old generation that still arrives is discarded, so none can refresh the `sessionId` cookie the logout expires or change client auth state (SEC-037, SEC-048).

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
