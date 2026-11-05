# Record Files client integration

Updated: 2026-11-04. Current canonical integration branch: `feat/standalone-qbits-ui`. See [verification and dependencies](QBIT-RELEASE-STATUS.md).

## Standard controls and APIs

The Files tab uses standard themed buttons for Preview, Open, Download and Rename / describe. Navigation uses Next links with keyboard focus. Attachment metadata supplies independent `canEdit` and `canDelete` permissions; an explicitly denied edit capability never falls back to deletion permission. The server remains authoritative.

Every download requests a fresh owner-issued descriptor. `AUTHENTICATED_FETCH` deliveries use the configured native Record Files route, a new correlation identifier, and a separately verified completion receipt, byte count and SHA-256. Preview and save are separate attempts. A failed receipt never becomes a direct link or a successful save. Generic `FILE_DOWNLOAD` and `FILE_PREVIEW` adornments use the same controls; they do not require table-specific pages.

Tracked raster/PDF previews expose a local object URL only after verification. Ordinary signed PDF previews read bounded bytes with credentials omitted, redirects refused and a 30-second deadline. Both use the same canvas PDF renderer; uploaded PDFs are never framed. Closing the preview aborts work and revokes local URLs. Hosts serving signed files from another origin must allow that storage origin in CSP `connect-src` and configure storage CORS for the dashboard origin. This never forwards QQQ credentials to storage.

Open previews supported media; unsupported types use the authorized download action. The UI does not claim that a browser saved bytes or that a printer physically printed them. Retention, upload sessions, collections and durable audits belong to their server QBits.

## Dependency order

Install matching Core, then Collaboration, then Record Files and other feature QBits before the matching frontend. Public Core RC.21 and Collaboration RC.6 do not contain the new retention contracts. Local verification uses Core `4.1.0-SNAPSHOT` and Collaboration `0.1.0-SNAPSHOT`; see their branch status files for exact source commits. Core's dashboard CSP must include `blob:` in `connect-src` for local PDF-byte reads.

## Verification scope

The full component/API suite and coverage gates, production export, browser PDF/receipt/ordering scenarios and live Collaboration file workflow are recorded in [current status](QBIT-RELEASE-STATUS.md). Live tests use disposable synthetic data and real Core/Collaboration APIs. Browser mocks of the retained-transfer protocol do not establish production storage or worker qualification.
