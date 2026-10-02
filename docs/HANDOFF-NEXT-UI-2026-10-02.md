# Next UI — complete agent handoff

Snapshot: 2026-10-02T14:58:00.898465+00:00. This is a continuation checkpoint, not a release approval or a claim that all work is complete. Refresh live GitHub state before mutations.

## Start here — prompt for the replacement agent

> Continue Next UI stabilization from this handoff. Read this document, `.planning/HANDOFF.json`, repository guidance, and the linked evidence before changing anything. Use QRun-IO/qqq issues in QQQ Project 12 as the source of truth. First collect the existing PR36 CI runs; do not dispatch replacements. Then finish the original QQQ695 acceptance mapping and investigate the two current PR35 tablet failures. Preserve the original Next UI design and existing Material behavior compatibility. Keep final 1.0 unpublished until James approves after real-application QA. Work in the existing task worktrees, preserve private evidence and other agents' changes, and keep tickets, fields, comments, and this handoff current.

## Intent and authority

- Deliver production-quality, metadata-driven Next UI compatible with existing Material applications. Material is the behavior reference; the user explicitly rejected replacing the original Next visual design with Material or an unapproved redesign.
- The owner requested a full visual review, especially tables, filters, query editing and record screens. Do not infer that green automated tests constitute visual approval.
- Prioritize deep functional coverage in one browser over superficial breadth. Firefox/WebKit High and Critical investigations were subsequently explicitly authorized with background agents.
- Commits, pushes, PRs, admin merges when needed and subsequent RC releases are authorized. Final 1.0 is explicitly held for owner review and a couple of weeks of real-application use/issues.
- All Next work belongs to central [QQQ issues](https://github.com/QRun-IO/qqq/issues) and [QQQ Project 12](https://github.com/orgs/QRun-IO/projects/12). Frontend PRs remain in qqq-frontend-next. Set owner, priority, type, component, milestone, target version, quarter, release type and status. Comment as work progresses; never close an investigation based on an unrelated passing run.
- User asked for a full handoff. No additional implementation was started after the PR36 checkpoint. All local child agents have completed. Hosted PR36 CI continues independently. The user explicitly answered “Pause for the handoff.” Pause the existing goal after the checkpoint is saved and pushed; do not mark it complete.

## Release, main and QA are different builds

| Surface | Exact state |
|---|---|
| Published release | [v1.0.0-RC.11](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.11), published 2026-10-02 03:39:19 UTC; source `2853b9b148282ae0e6d454adab6d0f534ba48280` |
| Current main | `5ca3e0b17a9256278cb0c5cf54a66f1090b369cb`, tree `78f55233ca0c7aaad55322ccb9b44960bf41959a` |
| Backend develop | `52d982d767cf9e68c335a011a14a375b543ad927` |
| Running owner QA | http://127.0.0.1:18810/app/person/ — exact current-main export, real sample backend; HTTP 200 verified during handoff |
| RC12 | Draft PR33, unpublished, depends on PR32 |
| Final 1.0 | Explicitly held for human visual acceptance and real-app soak |

RC11 JAR SHA256: `0c89bc0a104131010e5607e8a3669f8579048fab43170d05344dd47721188d99`.
The immutable RC11 qualification run `36959744676` retained 2,990 passes / 2 diagnostic failures (Firefox font NAV014 and tablet NAV056). Later current-main exact-tree run [36989591498](https://github.com/QRun-IO/qqq-frontend-next/actions/runs/36989591498) achieved **3,010/3,010 first-attempt passes**: 620 each Chromium/Firefox/WebKit, 575 each mobile/tablet, 401 required IDs per profile, zero retry/skip/flaky/report-error/missing. Tested merge was `437a4d9`; its tree matched main. Do not present that later main result as the RC11 artifact result.

PR27 menu, PR28 copy focus, PR29 recorder and PR30 grid changes are merged in main after RC11. The QA server does not include pending PR32 or PR36.

QA container: `next-ui-qa-main-5ca3e0b`, restart policy unless-stopped. Runtime folder `RT/qa-current-main-5ca3e0b`; sample source `7be255479bc39a3538a9597d1671c529b417bf18`, public QQQ 4.1.0-RC.1, mock Alice, 18 tables/86 processes. 192 export files and 90 served asset hashes were verified. Prior installed-Chrome smoke passed load/search/filters/preferences + reload/CRUD + cleanup, with zero page/console/API errors; 34 aborted route requests were separately retained. H2 is in memory: restarting loses QA data. Preserve the container during owner QA.

## Workspace map and branch ownership

`RT` throughout this document means `/Users/james.maes/Git.Local/QRunIO/.next-ui-runtime/browser-stability`.

Root checkout `/Users/james.maes/Git.Local/QRunIO/qqq-frontend-next` is on old `feature/GH-649-next-acceptance` at `2b6569f33b145e3aa93a2be3cd315203132b2d83`. It has untracked `AGENTS.md` and `docs/SESSION-STATE.md`; preserve both. Do not use that old branch for new implementation. Handoff copies will also be untracked there for discoverability.

| Worktree / branch | Head | PR and state |
|---|---|---|
| `RT/next-query-cleanup-1006`, `feature/GH-1006-next-query-cleanup` | `4a055463bdc47398cb9e672556a225f32551d59d` | [Frontend36](https://github.com/QRun-IO/qqq-frontend-next/pull/36), draft, native acceptance running |
| Sibling `qqq-frontend-next-dashboard-readiness`, `feature/GH-1001-dashboard-readiness` | `c1a4efd7d7ba583a8da0d63f1fb13aceb262152a` | [Frontend35](https://github.com/QRun-IO/qqq-frontend-next/pull/35), held, two tablet failures |
| Sibling `qqq-frontend-next-session-capture` | `8abc8e006679e08f98923675b161afda4c932bbc` | [Frontend34](https://github.com/QRun-IO/qqq-frontend-next/pull/34), held, earlier tablet NAV026 failure |
| External owner, widget date defaults | `0222f0dcadb68eceb0a6946dc9d8d51546469b46` | [Frontend32](https://github.com/QRun-IO/qqq-frontend-next/pull/32), open, QQQ1002 In review; newest head not reviewed by this root |
| RC12 preparation, base `feature/widget-date-defaults` | `0df774587a8dc731e84e83d6ee26d9a25e87f4c5` | [Frontend33](https://github.com/QRun-IO/qqq-frontend-next/pull/33), draft/dependent on32 |
| `RT/qqq-quickstart1000-boundaries`, `feature/GH-1000-quickstart-boundaries` | `d2c5c78419aebe2b995b11b5d18d24b156f9885f` | [QQQ1004](https://github.com/QRun-IO/qqq/pull/1004), diagnostics only, hosted Mac qualification cancelled |
| `RT/agent-handoff-20261002`, `feature/GH-985-agent-handoff-20261002` | Based on main `5ca3e0b` | This handoff; documentation checkpoint, not a product release |

No root-owned product changes remain uncommitted in the PR36 worktree. Do not reset, prune or clean shared worktrees. Existing guides are already on main; do not regenerate them from scratch.

## Immediate next actions

1. **Collect PR36’s existing native acceptance run** `37021917074`, attempt 1. Jobs: Chromium `110886847510`, Firefox `110886847085`, WebKit `110886847434`, mobile/tablet `110886847373`. Capture actual tested merge/backend SHA, final artifacts, individual logs, first-attempt counts, strict diagnostics and required-ID coverage. Do not infer tested source from the PR head alone.
2. Standard PR36 run `37021916925` has passed typecheck/lint/unit coverage, mocked E2E, Storybook and bundle budget. Image run `37021917241` passed amd64/arm64; publishing skipped as expected for a PR. Native acceptance was still running at handoff. Keep draft until evidence is complete, review, then merge only if qualified. Update QQQ1006 status/comments and QQQ696 scope accordingly.
3. **Finish original QQQ695 acceptance mapping** using the newly successful 13 Java provider tests and existing exact-source policy-on browser proof. Read original issue requirements. The unit gate is now passed; issue was deliberately left open pending complete criterion mapping. Do not conflate separate standalone QQQ734 requirements.
4. **Analyze PR35’s two tablet traces** below. Keep PR35 held; do not rerun the full matrix simply to obtain a green result or weaken diagnostic assertions.
5. Continue remaining High browser and security work using the frozen proposals/evidence below. For pending native experiments, review the existing proposal before consuming it. Implement only where evidence identifies a defect; classify unresolved causes honestly.
6. Reconcile parity/visual/real-app acceptance and release candidate readiness through Project12. Final 1.0 needs owner approval after soak. New themes belong to 1.1, not the stabilization scope.

Read-only starting commands:

```bash
gh pr checks 36 --repo QRun-IO/qqq-frontend-next
gh api repos/QRun-IO/qqq-frontend-next/actions/runs/37021917074
gh issue view 695 --repo QRun-IO/qqq --comments
gh issue view 985 --repo QRun-IO/qqq --comments
python3 /Users/james.maes/Git.Local/QRunIO/.next-ui-runtime/browser-stability/project-audit/verify.py
```

## PR36 / QQQ1006: query privacy fix ready for native qualification

Signed and pushed commit `4a055463bdc47398cb9e672556a225f32551d59d` clears user-specific query state at logout and detected identity changes. QQQ1006 is **Medium / Bug / In review**, assigned KofTwentyTwo, Next UI 1.0, target 1.0.0, Q4 2026, component qqq-frontend-next. Parent audit is QQQ696.

Files: `src/lib/auth/auth-storage.ts`, its test, `src/lib/utils/query-view-storage.ts`, new `query-view-storage-cleanup.ts`, acceptance `security/headers.spec.ts`, `security/sessions.spec.ts`, and `docs/releases/unreleased.md`.

The new dependency-free module owns existing key constants and iterates localStorage backwards, deleting only `qqq.recordQueryView.<table>` and `qqq.currentSavedViewId.<table>`. Same-user query state remains. Appearance, density, legacy column settings and unrelated prefixes remain; backend saved views are not deleted. `query-view-storage.ts` re-exports constants for compatibility. Existing SEC021 and SEC043 gain actual storage assertions without retries, timeouts or relaxed diagnostics.

Why the tiny extra module matters: a direct auth import of the existing query-view-storage module pulled saved-view parsing → query columns → adornments → API/Axios into the login bundle and broke nine route budgets. The isolated cleanup module restores budgets (login 248.7 KB <255, nested dev 349.3 KB <350).

Evidence: `RT/security-closeout-695-696/query-cleanup/`:

- `red-result.json`: original 10 pass / 2 fail, demonstrating retained private query data.
- Final focused 17/17; whole units 2,018 tests /186 files pass. Known jsdom navigation warnings retained.
- Types, affected lint, license, production export and all budgets pass.
- Full browser discovery 3,010 cases /99 files. Correct environment variable is `QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile,tablet`; an initial wrong `QQQ_ACCEPTANCE_PROJECTS` invocation discovered only620 and is retained, not represented as full coverage.
- `local-gates-final.json`, `commit-receipt.json`, `commit-output.log`, `pr-body.md`, `pr-create-receipt.json`.
- `review/independent-review-final.json`: all seven file hashes stable before/after the reviewer’s actual17-test run; PASS. The earlier mixed-generation review is superseded, not concealed.
- Production export preceded only the final license-header comment; native CI rebuild binds the committed source.

## PR35 / QQQ1001: final result and exact failures

Run [37009977352](https://github.com/QRun-IO/qqq-frontend-next/actions/runs/37009977352), attempt1, failed; tested merge `94fd3ae447c4f691a5bedcfd066d87183f93f769` (main5ca + headc1), backend52d982d. **3,008 pass /2 fail of3,010 first attempts**, no retries/skips/flaky/report errors. C/F/W620 each pass; mobile575pass; tablet573pass/2fail. Desktop401requiredIDs each pass; touch399pass/2fail/0missing. WID009 failed on tablet, leaving that phone-required coverage incomplete.

1. **Tablet NAV056**: theme preference reload has three access-control pageErrors for `querySavedView/init`, `person/query`, `person/count`. Console/request/CSP/legacy arrays zero; two interrupted fetches. This resembles existing High904 but exact same cause is unproven. Inspect original chronology and source.
2. **Tablet WID009**: `sample-dashboard.spec.ts:205`, assertion at221:68 expected geometry >121.859375, got0. All six diagnostic arrays empty. Related QQQ1003; inspect geometry trace before classifying it as harmless.

Standard run37009977420 passed 2,025units/187files, 108mocked tests, Storybook and budgets; image run37009977358 passed both architectures. Those results do not override native failures.

Evidence `RT/issue-audit/ci-watch-c1a4efd/`: README, `final-verification.json`, `failures-sanitized.json`, `required-id-coverage.json`, `artifact-hashes.json` (1,950 sealed files), final artifacts and all four individual job logs. Whole-run log ZIP retrieval failed twice; collection limitation is recorded. Raw arrays contain intentional negative controls; do not call them empty based on a passing diagnostic gate.

Trace paths below `acceptance-touch/artifacts/`:
- `navigation-theme--NAV-056--8f9e2-ation-theme-override-mobile-tablet/trace.zip`
- `widgets-sample-dashboard-s-2daee--and-the-description-mobile-tablet/trace.zip`

Touch ZIP SHA256 `02588f66330fbb6f51fb70285c5d27c0d65acf7d0f2f9bfdf2ff58879810ded2`. Earlier run36996199782 (3,003/1) is a different source and remains retained.

## Critical security work: original scope and remaining proof

Read `RT/security-closeout-695-696/{REVIEW.md,findings.json,acceptance-security-evidence.json,source-files.json}`. Review uses original ASVS4.0.3 scope, current frontend5ca/backend52, 2,923 frozen source files and 297 SEC executions in the previous full matrix. No blanket security certification was made.

### QQQ695 — provider security headers

Original acceptance: compatible CSP and frame/referrer/permissions headers with application override, provider unit tests, and real-backend C/F/W policy-on suite without unexpected CSP violations.

**New gate passed:** `RT/security-closeout-695-696/provider695-current52/online-after-cache-preparation/` contains README, RESULT, hashes, classpath provenance, Surefire XML, logs and `verify-result.py`. Maven exit0, **13/13 NextDashboardRouteProviderTest**, no failure/error/skip, six reactor modules, JDK21.0.12.1/Maven3.9.16. All2,823 source files and13 prior offline evidence files unchanged. Fresh handoff re-verification passed.

RESULT SHA256 `612b20522226f2bc2ec1e5c07ffd288dca41134841add1c9983afba9a0b6d850`; manifest `abaaa650046c7b9885ccc85f39b56a05234a8dafe7379f97b85071c29b24d32d`.

Initial offline run failed before compilation because six declared JARs were missing, so it executed0/13. One authorized online run used existing declared repositories and an owned Maven cache with no dependency/pom/source changes. Actual classpath binds current reactor outputs, not stale QQQ JARs. Parent Maven has private user.home; Surefire fork retains OS user.home, explicitly recorded. Do not claim filesystem isolation. `verify-result.py` verifies without rerunning Maven.

### QQQ696 — review still open

- Confirmed Medium privacy defect is QQQ1006/PR36, awaiting native qualification.
- **QQQ733 High:** Next/v1 HttpOnly path works. Legacy `/qqq/manageSession` remains body-only context and always emits JSON UUID. Cookie-resume plus conditional omission remain to implement/test against the actual endpoint, preserving Material compatibility when its flag is false. Read `LEGACY733-NEXT-ACTION.md`.
- **QQQ734 High:** standalone header implementation and12 unit cases exist; no located exact-source standalone SEC038–040 native acceptance. The Javalin3010 suite is not standalone proof.
- **Auth0 candidate High, unconfirmed:** tenant JWKS verifies signatures, but `.withIssuer(idToken.getIssuer())` self-compares token issuer and configured API audience is not checked. Existing producers send ACCESS tokens despite misleading variable name. Metadata audience is nullable; do not guess clientId as fallback. Same-key signed wrong-issuer/wrong-audience negative controls are planned but **not executed**, and no separate exploit ticket was created. Read `AUTH0-NEXT-ACTION.md` before changes.
- Current custom CSS is trusted application configuration inserted as textContent, not sanitized record HTML; older review wording was stale.
- Preserve real Auth0 tenant exclusion SEC030 and the three approved provider exclusions. Fixtures do not establish real-tenant operation. Broader lifetime/__Host/CSRF residuals are not automatically proven Critical exploits.

## High browser investigations — all remain open

| QQQ issue | Current evidence | Next bounded work |
|---|---|---|
| [904](https://github.com/QRun-IO/qqq/issues/904) | New PR35 tablet NAV056 three API pageErrors; prior private public-RC11 capture had3functional passes and no original errors, but native old-XHRerror0 persisted | Compare exact new trace chronology/source; preserve old observation and no same-cause claim |
| [911](https://github.com/QRun-IO/qqq/issues/911) | Original old-runner empty-report polling failure; actual pinned SDK calibration prepared, **UNRUN** | Independently review frozen calibration before one native execution; it only calibrates polling, not original-cause closure |
| [952](https://github.com/QRun-IO/qqq/issues/952) | Historical sessionPOST pending15s <Axios30s; controlled35s delay recovers~30.7s; PR34 recorder held by NAV026 | Use actual request lifecycle evidence; adjacent recovery does not explain historical stall |
| [960](https://github.com/QRun-IO/qqq/issues/960) | Old x64 PW1.58/WK2248 process stall; newer arm WK2369 adjacent2pass | Bind original environment/history before cause claims; no closure from new architecture pass |
| [985](https://github.com/QRun-IO/qqq/issues/985) | Browser umbrella, original355 observations retained; old third-font report unresolved | Reconcile exact evidence and original criteria; bounded aborted-font/later200 capture does not resolve every historical font report |
| [1000](https://github.com/QRun-IO/qqq/issues/1000) | Hosted Mac SDK `context.newPage` unresolved, latest run cancelled after~20min | Review actual producer-bound protocol classifications before another probe; no blind redispatch |

### QQQ1000 Mac evidence

Run37011419981/job110851818948 atd2c5c784: GitHub terminal **cancelled** after approximately20minutes. No exact timeout annotation was proven; state that accurately. Journal completes launch/launcherReady/context, then unresolved SDKpage creation; **0/5 lifecycle phases**, no navigation/cleanup proof. Protocol createPage id4 response in409ms is not proof the SDK promise settled. Sixty allowlisted request/reply pairs,27outer envelopes versus24inner pairs; four unrecognized, four unmatched and six ignored commands make the summary incomplete. `pending=[]` does not imply completion. Page.overrideSetting57 error flag true; outer58 ack false error; Target.resume61 successful. A possible init-error→page.close hang is a hypothesis, not a root cause. macOS14 special WebKit2251 is officially supported by pinnedSDK, not an unsupported mismatch.

`RT/quickstart1000-protocol-qualification/terminal/`: archive11227819645.zip SHA256 `978ee554a9422dccf47e13855bfa76465baa8706aec716bdb84d059925bfaefc`, extracted diagnostic `first-page-protocol.json`, lifecycle `phase-journal.json`, preflight, `review/{README.md,protocol-review.json,seal.json}`. Private0600. Raw DEBUG_FILE was never uploaded; only bounded derived summaries. Prior37001880676 and bad-preflight37000980103 retained separately. No new run authorized by a mere handoff.

### QQQ911 prepared calibration

`RT/next-browser-action-audit/911-native-calibration/`: README, candidate-freeze, preparation-receipt, inputs-manifest. 243inputs, manifest SHA256 `056ab16e65c6d79136262583fe8cb0cd9725a14a0927b43da53a82f725889570`;38pure contracts pass. Actual copied pinned SDK1.64 /Firefox1553 control the browser; immutable Docker1.58.2-noble image is OS base only. Three synthetic role cases (present, absent15s, hidden→visible),90s original budget,retry0. Root has not reviewed/consumed this native candidate. Only after review use existing `run_once.py --reviewed-execute`; verify frozen-input guards first. No consumed marker or browser container yet.

### QQQ904 private capture caveat

`RT/script-origin-serializer-correction/app-capture-proposal/integration/`: APP-CAPTURE-RESULT, receipt, post-native-freeze and artifact hashes. Root verified830 artifact hashes/1,186 unchanged inputs; four one-use markers consumed. Three functional passes, original API errors absent, old nativeerror0/replacement200 observed. Eight diagnostics conditionally join old-document script stacks; unique original Console identity and cause unproved. A root prelaunch receipt failed because Node24 reporter format differed from expected TAP; orchestration mistakenly continued despite that assertion. `root-review-format-failure.json` records this honestly as postlaunch. Actual pure guards passed; never backdate approval or rerun a consumed capture to hide the failure.

## Roadmap and project management

Latest verified inventory before the handoff:157 managed Project items. QQQ1006 moved from In progress to In review; verify live fields using `RT/project-audit/verify.py`. Expected counts after transition:16Backlog/89Ready/15Inprogress/6Inreview/31Done. Next UI1.0 milestone7 has125open/31closed, priorities2Critical/18High/103Medium/2Low. These counts include umbrellas and acceptance-closeout items; they do not mean125 newly found product bugs or that every Ready item is unimplemented.

High/critical tickets695/696 and904/911/952/960/985/1000 remain open. Related acceptance/parity/visual tickets include649,650,711(owner visual),712(soak/GA),713(epic),714(parity),956reports,957bulk,958navigation,959charts. Read their actual acceptance criteria before status transitions.

Next UI1.1 milestone9 and2.0 milestone10 exist without scheduled dates. QQQ1005 is the requested **dual-palette full application theme** feature:1.1Backlog, Medium, Feature, Minor, ownerKofTwentyTwo, target1.1.0. Optional dark palette, shared brand colors by default, middleware SupplementalInstanceMetaData allow-list, Next dark CSS tokens and standard appearance preferences when both palettes exist. Existing single-palette themes preserve current light-only behavior. No theme implementation has started.

Project tooling `RT/project-audit/{apply.py,verify.py,applied.jsonl,project-final.json,verification.json}` preserves proper fields. Read helper schema before applying a plan. Issue audit `RT/issue-audit/audit-manifest.json` retains original355 historical observations; append new checkpoints, never erase old failures. Individual meaningful comments were added throughout; handoff comments supersede earlier partial PR35 and offline-only QQQ695 status.

## Required reading and implementation conventions

1. This handoff and `.planning/HANDOFF.json`; root `docs/SESSION-STATE.md` is append-only history, so read newest entries last.
2. Applicable AGENTS.md/CLAUDE.md, shared `~/.ai/3-rules.md` and `2-coding-style.md`; repository guidance governs builds/style, user authorization governs scope.
3. `docs/ISSUE-TRACKING.md`, `docs/acceptance/{feature-matrix.md,browser-matrix.md,material-parity.md,next-ui-visual-review.md}`, `docs/PLAN-649-next-acceptance.md`, `docs/releases/1.0-testing.md`.
4. Existing `docs/guides/next-ui-developer-guide.md` and `docs/guides/next-ui-agent-guide.md` cover metadata, widgets, configuration and navigation.
5. Read only task-relevant private evidence listed above and the original issue/PR criteria before implementation.
6. Second brain index and `knowledge/qqq/next-browser-stability-2026-10-01.md`; newest checkpoints are appended at the end. Main vault `/Users/james.maes/Git.Local/KofTwentyTwo/second-brain`; owned notes worktree `RT/vault-closeout-notes`.

Current manifests, not stale overview text, define versions: Next16.3.6/React19.2.4/TypeScript5.9/pnpm9.15.9/Playwright1.64.0-alpha-2026-10-01. Standard commands are pnpm test, build, tsc --noEmit and repository lint/acceptance scripts; inspect package.json before choosing exact gate arguments. Metadata drives all entity/field/navigation labels and structure. Typed API modules/TanStack Query own server state. Do not hardcode sample table/process names into production UI.

GitHub CLI currently has Projects access. SSH agent previously refused signing/auth; successful scoped HTTPS push fallback:

```bash
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push https://github.com/QRun-IO/qqq-frontend-next.git HEAD:refs/heads/feature/YOUR-TICKET-BRANCH
```

Never print tokens or change global credentials. Use signed commits and verify signatures; trust status U is distinct from invalid signature. Use --body-file or structured API arguments for multiline descriptions; do not shell-interpolate JSON strings. Commit only owned files, never `git add -A` in shared/vault roots.

## Actual pitfalls to avoid repeating

- One initial lint error was masked by a later successful command in the same shell. Run gates separately or inspect every exit code and output. The missing @file header was fixed and both lint/license rerun successfully.
- A reviewer originally hashed a mixed generation while root refactored. Freeze source before independent verification; final17-test review has stable seven-file hashes.
- Old agent denominator618 was wrong for current PR35; final reports show620 desktop and1150touch. Derive counts from actual reports/discovery, not previous summaries.
- Passing newer source/platform tests does not close older unmatched failures. Bind tested merge/backend/browser/platform and original criteria for each ticket.
- Failed whole-log downloads are artifact collection failures, not evidence that native jobs failed or never ran. Preserve individual job logs and collection limits.
- Mac raw protocol reply is not SDK lifecycle completion; unknown/unmatched commands cannot be treated as success.
- Node24 reporter-format parsing failure was an actual orchestration error. Preserve it; never invent a prelaunch review receipt.
- Do not weaken diagnostic gates, add retries/sleeps, suppress logs or repeatedly run one-use captures to obtain a green report. Each new probe needs a distinct evidence question and reviewed source.
- Traces/protocol/log bundles may contain request payloads and private query text. Keep local; share bounded sanitized summaries. Do not dump other lanes' FINALMANIFEST or raw DEBUG_FILE publicly.

## Background state, preservation and handoff completeness

All local children (`browser_fix_review`, `browser_issue_audit`, `firefox_stability`, earlier guide/review agents) have completed. No local browser collector remains. PR36 hosted runs may finish after this document timestamp; collect them once rather than launching duplicates.

Preserve QA18810 and unrelated services8090(CARL),18779(oldRC7),18781proxy→18782(RC8Docker),8000(oldfixture),61616broker. No Docker cleanup or shared worktree pruning is part of handoff. Keep evidence directories and consumed-marker guards.

The original goal is incomplete. Remaining human work: visual approval and real-app soak, then explicit final-release approval. Authentication is currently usable; no credentials should be requested or pasted. The owner explicitly requested pausing this agent for handoff; the goal will be paused after this checkpoint is saved and pushed. A replacement can resume from the exact next actions above without regenerating guides, repeating completed tests, or reconstructing the crash history.
