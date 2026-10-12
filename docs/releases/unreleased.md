# Next UI — unreleased

[RC14 preparation](1.0.0-RC.14.md) collects every change merged since [RC13](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.13): the record search fix and the Next.js security update. RC13 is published and immutable. Changes merged after the RC14 preparation commit are listed below. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## Features

- **QQQ Assistant panel (Phase 1: read-only questions and navigation).** When the `qbit-assistant` backend is installed and `GET /qqq/v1/assistant/config` enables it for the user, a header button (with unread badge), `Ctrl/⌘+J` and a command palette "Ask Assistant" item open a chat panel. It docks beside the page from 1024 px (resizable 360-640 px, its own scrolling message list) and is a full-height sheet below that. Replies stream over SSE with resume after a dropped connection and a Stop button; tool steps, record chips, records/record/count/history renders and chart widgets come from structured payloads, and markdown renders without raw HTML or images, with links only to same-origin `/app` paths. `?assistant=open&assistantPrompt=...` opens a new conversation with the prompt pre-filled. Without the backend nothing renders and the shortcut is inert. The panel code loads on first open (about 1.7 KB added to first load).

## Product fixes

None yet.

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
