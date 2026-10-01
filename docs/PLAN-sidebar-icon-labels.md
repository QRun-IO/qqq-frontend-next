# Sidebar icon label assertion (#728)

## Evidence

RC6 candidate WebKit failed NAV-002 because raw link text included decorative legacy icon codepoints. The same assertion was reproduced against the public RC6 JAR after explicitly awaiting the fixture's legacy glyph. This is a test assertion defect: accessible link names should match metadata labels, while decorative SVG text remains hidden from assistive technology.

## Correction

Await the legacy glyph, then assert exact link count and each accessible label in backend order. Check that rendered legacy SVGs remain `aria-hidden`. Retain nested-app, parent expansion and child label assertions. No product code or release artifact changes.

## Verification

Retain red and focused Chromium/WebKit/mobile reports under `test-results/visual-review/sidebar-icon-labels/` in the original checkout. The focused check exercises the actual public RC6 JAR with backend `e0d57dd`. Targeted ESLint and diff checks are required; independent review precedes integration. Original CI failure remains recorded, not erased by a later focused pass.

Focused result: three passed, zero failures, skips, flaky outcomes or report errors. Targeted ESLint and diff checks passed.

Independent review approved with no findings. This change verifies navigation semantics; glyph appearance remains covered by the separate legacy-icon workflows.
