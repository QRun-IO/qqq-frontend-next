# Bounded LONG validation — GH-728

## Defect and correction

Configured LONG ranges exposed two defects in the shared metadata schema: chained Zod refinements called `BigInt` after format validation had already failed, and exact integer-string bounds were rounded through `Number`. Seven new schema cases reproduced exceptions or wrongly accepted values before the fix.

The schema now pipes successfully validated integer text into its range checks. Integer-string bounds remain BigInt values; numeric fractional bounds use native mixed numeric comparisons. Optional blanks, required-field errors, signs, and existing field messages are preserved. No rendering changes or dependencies are introduced.

## Verification

- Seven schema regressions passed after failing on the previous source.
- Block and shared process-form component tests verify invalid fractional text, a below-minimum error, blocked submission, and correction to exact digits beyond the safe-number range.
- An unrelated intermittent unit failure expected a globally unique “Green” label although both view and edit fields display it. Its separate correction targets the read-only value being tested.
- All 1,913 units across 180 files passed; the 95 affected tests, types, lint/license and diff checks passed. Independent review approved both corrections.
- Evidence: original checkout `test-results/visual-review/long-range-validation/`. The initial full-run failure remains retained in `units.log`; the final full run is `units-final.log`.

This follow-up is not included in immutable RC7 `f65cf6b`. Production export and real-backend verification of the next integrated candidate remain required; these results establish schema/component behavior, not a new backend range-metadata contract.
