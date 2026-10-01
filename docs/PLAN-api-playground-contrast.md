# Plan: API playground contrast (#724)

## Reproduction and scope

Fresh, fingerprinted desktop captures preserve the original Next composition. RapiDoc's Expand all text in both the original design and RC6 renders RGB(29, 78, 216) on RGB(42, 43, 44), a contrast ratio of 2.12:1 at 16px normal weight. This inherited defect fails the 4.5:1 requirement. Browser regression checks also found light-mode contact-link contrast of 2.36:1 and authentication-status contrast of 3.00:1.

## Implementation and verification

- [x] Retain failing browser contrast checks inside RapiDoc's shadow DOM.
- [x] Apply existing dashboard primary-text and error tokens at the component boundary. Pair dark accent backgrounds with inverse button text. Preserve layout and dependencies.
- [x] Verify normal and hovered controls in light/dark Chromium desktop and mobile, plus live Preferences theme switching.
- [x] Run types, lint, production export, all 1,901 unit tests and existing bundle budgets.
- [x] Directly inspect four fresh screenshots after color transitions settle.
- [x] Independent review approved with no remaining findings; prepare signed isolated commit.

Evidence: `test-results/visual-review/api-playground-contrast/` in the original checkout. Final focused report: four passed, zero failures, skips, flaky outcomes or report errors. These are targeted checks, not a complete acceptance gate. Initial toggle verification incorrectly asserted an HTML attribute: React 19 sets RapiDoc's non-reflected Lit property. A subsequent audit sampled active color transitions. Both runs are retained; the corrected test awaits the property, Lit render and actual shadow-root animations without fixed sleeps.

## Remaining limits

This proves the fixture's visible playground content, hover states and theme switching, not all expanded endpoint/authentication states or arbitrary custom palettes. The existing narrow-screen inner horizontal clipping remains open; this color correction does not redesign the playground.

This branch is based on RC6 source `7ddf45f` and excludes the separate TIME fix `276b65b`. Neither follow-up is part of the immutable RC6 tag. Final 1.0 remains on hold.
