# Next UI — unreleased

[RC30 preparation](1.0.0-RC.30.md) collects every change merged since [RC29](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.29). RC29 is published and immutable. Changes merged after the RC30 preparation commit are listed below. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## Features

- **Profile photo and avatars everywhere** (QQQ 4.1.0-RC.16, UI API 1.7.0 `avatars`):
  - The core **Profile** preferences section renders generically. Its photo is a `FILE_UPLOAD` field with `valueIsUploadRef`, so you can drag and drop or choose a picture, crop it square (drag, arrow keys or the zoom slider), preview it and remove it. The cropped PNG goes to `POST /uploads`, and the ref saves with the form.
  - One `UserAvatar` (photo via `GET /avatars/{userId}`, otherwise initials) shows people in the user menu, presence, comments, mention candidates, the people picker, activity and your own assistant messages. A missing avatar is remembered for the session, so it isn't requested again.
  - **Privacy:** branding `gravatarDefault` no longer sends your email hash to Gravatar. A Gravatar appears only if you turn it on in your Profile, and the server serves it.
  - Image fields take a full form row at every width. e2e coverage is `tests/e2e/profile-avatars.spec.ts`, including the 6-width light/dark screenshot matrix.

## Product fixes

None yet.

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
