# Next UI issue tracking

GitHub issues are the source of truth for scope, current status, remaining work and release decisions. Start at [QRun-IO/qqq#713](https://github.com/QRun-IO/qqq/issues/713), which links the release baseline, known failures, visual review, external-provider checks and existing feature tickets.

## Where work lives

| Area | Authoritative issue |
|---|---|
| Roadmap and complete issue index | [qqq#713](https://github.com/QRun-IO/qqq/issues/713) |
| Feature acceptance and default adoption | [qqq#649](https://github.com/QRun-IO/qqq/issues/649) |
| Behavior and metadata compatibility | [qqq#714](https://github.com/QRun-IO/qqq/issues/714) |
| Original Next visual review and owner approval | [qqq#711](https://github.com/QRun-IO/qqq/issues/711) |
| Browser failures and incomplete run evidence | [qqq#985](https://github.com/QRun-IO/qqq/issues/985) |
| Real application soak and final release hold | [qqq#712](https://github.com/QRun-IO/qqq/issues/712) |
| Cross-application launch/restart acceptance | [qqq#650](https://github.com/QRun-IO/qqq/issues/650) |
| ESB integration and acceptance | [qqq#986](https://github.com/QRun-IO/qqq/issues/986) |
| Paired runtime provenance and CI handoff | [qqq#905](https://github.com/QRun-IO/qqq/issues/905) |

Create **all Next UI tickets in [QRun-IO/qqq](https://github.com/QRun-IO/qqq/issues)** and add them to the [QQQ Roadmap, Project 12](https://github.com/orgs/QRun-IO/projects/12). Use existing issues for the same requirement or failure, and link each focused ticket to #713 and its feature or investigation parent. Frontend issues #12 and #10 were transferred to central issues #985 and #986; use the central identifiers and preserve their report history.

## Required ticket fields

Every new ticket needs these fields on the issue and its Project 12 item; complete them before work advances to **Ready**:

| Field | Required value |
|---|---|
| Issue Type | Native issue: Bug, Feature, Task or Epic. Mirror it in the Project field, using Planning Epic for Epic; Improvement is a Project-only category. |
| Assignees | The person accountable for completing or coordinating the ticket |
| Milestone | The agreed delivery milestone; keep it consistent with the target version |
| Priority | Critical, High, Medium or Low, with an impact-based rationale in the issue |
| Component | The owning implementation component: `qqq-frontend-next` for Next source, or the actual backend/sample component for a dependency. |
| Target Version | The agreed version of the owning component or an explicit pending release decision. A backend dependency in the Next UI 1.0 milestone does not imply a backend 1.0 release. Never imply delivery in an already published RC. |
| Status | The current workflow state below |

Record unresolved ownership or release decisions explicitly while a ticket remains in **Backlog**. Do not invent dates, estimates or a new release version to fill a field. A browser assertion failure alone does not establish high product severity.

## Workflow and evidence

- **Backlog / Ready:** capture the expected behavior, scope, acceptance criteria, required fields and dependencies; Ready means actionable work with an owner.
- **In progress:** link the active branch or work and record reproduction, confirmed cause, implementation progress and remaining blockers.
- **In review:** link the reviewable PR, source commit and verification evidence; keep unmet acceptance criteria visible. A local fix or passing subset does not imply merge or release.
- **Done:** close only after the accepted fix is integrated and every acceptance criterion is verified, or an explicit approved disposition is recorded. Link the merged PR/commit and evidence. Identify whether the change is unreleased or delivered, with the version and release link when published.

## Updating an issue

- Put current status and remaining acceptance criteria at the top. Preserve the original report as history.
- Record expected/actual behavior, reproduction, environment, source commit, run and artifact evidence. State whether the cause is established.
- Separate implementation evidence, passing scoped tests, owner visual approval and final release approval. They are distinct requirements.
- Resolve all original acceptance criteria before closing, or document an explicit approved disposition. A later passing run alone does not explain an intermittent failure.
- Keep external-provider exclusions visible. Controlled provider fixtures do not prove a real Auth0 tenant, Google account or QuickSight dashboard.
- Update issue links after a fix or new finding. Repository plans, session notes, release notes and test/visual ledgers support the issues; they are not competing live backlogs.

## Release and design constraints

Preserve the original Next design at `e42ad2b2bcdc76311e13002a22dd70e3ec437192`. Material Dashboard is the behavior and metadata compatibility reference. Prioritize primary-browser functional depth and disclose secondary-browser failures.

[RC9](releases/1.0.0-RC.9.md) is the published prerelease for application testing. Its immutable-tag acceptance run has known Firefox/tablet failures; consult the release notes and #985 for the exact evidence. The browser fixes in [PR #18](https://github.com/QRun-IO/qqq-frontend-next/pull/18) are [unreleased](releases/unreleased.md).

Every release and changelog entry must link its central QQQ issues and distinguish product changes, test/infrastructure corrections, verification and unresolved work. A published RC's tag and artifacts remain immutable; subsequent fixes require a separately authorized version and release. Update tickets and Project 12 with the actual delivery version and release link after publication.

Final 1.0 remains held for the owner's requested application soak and renewed, explicit final approval ([#712](https://github.com/QRun-IO/qqq/issues/712)). Passing CI, an issue marked Done or elapsed time does not release that hold. This project does not authorize releasing QQQ 4.1.
