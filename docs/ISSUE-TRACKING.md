# Next UI issue tracking

GitHub issues are the source of truth for scope, current status, remaining work and release decisions. Start at [QRun-IO/qqq#713](https://github.com/QRun-IO/qqq/issues/713), which links the release baseline, known failures, visual review, external-provider checks and existing feature tickets.

## Where work lives

| Area | Authoritative issue |
|---|---|
| Roadmap and complete issue index | [qqq#713](https://github.com/QRun-IO/qqq/issues/713) |
| Feature acceptance and default adoption | [qqq#649](https://github.com/QRun-IO/qqq/issues/649) |
| Behavior and metadata compatibility | [qqq#714](https://github.com/QRun-IO/qqq/issues/714) |
| Original Next visual review and owner approval | [qqq#711](https://github.com/QRun-IO/qqq/issues/711) |
| Browser failures and incomplete run evidence | [frontend#12](https://github.com/QRun-IO/qqq-frontend-next/issues/12) |
| Real application soak and final release hold | [qqq#712](https://github.com/QRun-IO/qqq/issues/712) |
| Cross-application launch/restart acceptance | [qqq#650](https://github.com/QRun-IO/qqq/issues/650) |
| Paired runtime provenance and CI handoff | [qqq#905](https://github.com/QRun-IO/qqq/issues/905) |

Use existing issues for the same requirement or failure. Create focused Next release issues in QRun-IO/qqq and link them to #713 and their feature parent. Keep existing frontend-repository issues linked; do not duplicate their scope.

## Updating an issue

- Put current status and remaining acceptance criteria at the top. Preserve the original report as history.
- Record expected/actual behavior, reproduction, environment, source commit, run and artifact evidence. State whether the cause is established.
- Separate implementation evidence, passing scoped tests, owner visual approval and final release approval. They are distinct requirements.
- Resolve all original acceptance criteria before closing, or document an explicit approved disposition. A later passing run alone does not explain an intermittent failure.
- Keep external-provider exclusions visible. Controlled provider fixtures do not prove a real Auth0 tenant, Google account or QuickSight dashboard.
- Update issue links after a fix or new finding. Repository plans, session notes, release notes and test/visual ledgers support the issues; they are not competing live backlogs.

## Release and design constraints

Preserve the original Next design at `e42ad2b2bcdc76311e13002a22dd70e3ec437192`. Material Dashboard is the behavior and metadata compatibility reference. Prioritize primary-browser functional depth and disclose secondary-browser failures.

RC8 is a prerelease for application testing. Final 1.0 remains held for the owner's requested soak and explicit final approval. This project does not authorize releasing QQQ 4.1.
