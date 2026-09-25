# PLAN: Next UI complete feature acceptance and default adoption (QRun-IO/qqq#649)

## Goal
Make Next the fully tested, working default QQQ admin UI: every inventoried supported
feature has executable acceptance coverage that passes against the real sample backend and
a production Next build, and every documented default launch path starts Next.

## Approach
1. Inventory UI-facing features from source (sample metadata, backend enums/routes, Material
   behavior) into `docs/acceptance/feature-matrix.md`; each row names its fixture, scenarios,
   test IDs, result and issue links.
2. Add a Playwright acceptance project (`tests/acceptance/`) that boots the QRun-owned sample
   JAR on an ephemeral loopback port and serves `next build` output with `next start`, using
   same-origin forwarding. Tests carry matrix IDs; `scripts/acceptance-gate.mjs` fails when a
   required row has no passing test or a test is skipped/flaky.
3. Fix demonstrated defects with regression tests (#550, #645, #538, #539, #541, others found),
   filing or reusing a QQQ issue for each.
4. Update default entry points (quickstart, sample README, root README, website, wiki,
   starter/template) while keeping Material selectable.
5. Run all gates, publish versioned artifacts through normal workflows, record evidence.

## Branches
- `qqq-frontend-next`: `feature/GH-649-next-acceptance` (from `main`)
- `qqq`: worktree `../qqq-649`, branch `feature/GH-649-next-default` (from `origin/develop`)

## Open questions (for James)
- Commits, pushes, PRs, image/tag publication and dependency changes need explicit approval
  per repository rules; work proceeds locally until then.
