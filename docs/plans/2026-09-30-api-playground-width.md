# API playground controls in narrow panels — GH-724

## Requirement

Keep the original Next developer view and make its API specification actions fully visible and usable in narrow panels, including 320px phones. Preserve the wide desktop layout, real spec download/new-tab actions, light/dark themes and keyboard access.

## Evidence and implementation

- The packaged RC7 JAR fails the new real-backend visibility test: the Download button is partially clipped before any focus/click can horizontally scroll hidden ancestors. The View button extends outside the panel too.
- RapiDoc 9.3.8 has a 360px host minimum, a negative overview info margin and two fixed-width, non-wrapping buttons.
- Allow the host to fit its panel. Use the public overview/button CSS parts under a panel-width container query to provide safe inset and share available button width with wrapped labels. A named overview container limits button adjustments to specification actions, excluding authentication and endpoint controls. No dependency changes or shadow DOM mutation.

## Verification plan

1. Retain the failing Chromium phone trace and screenshot.
2. Run light/dark, normal-width and 320px workflows with desktop and touch input. Check complete visibility before interaction, download the real OpenAPI JSON, and open the same spec using keyboard navigation.
3. Inspect screenshots and compare wide desktop before/after layout.
4. Run existing API contrast/theme workflows, unit suite, types, lint, export and bundle budgets. Obtain independent review before integration.

Evidence: original checkout `test-results/visual-review/api-playground-width/`. This follow-up is separate from frozen RC7 candidate `f65cf6b`.

## Results

The final production export passed 12 focused desktop/mobile workflows, with zero failures, skips, flaky outcomes or report errors. All 1,904 unit tests, types, lint/license checks and the default Turbopack export passed. The unchanged bundle budget passed at 963.3KB/1050KB. The 1440px overview/button geometry and entire RapiDoc screenshot are identical to RC7; final phone screenshots were inspected.

Earlier evidence is retained: the first green attempt exposed a relative-versus-absolute URL assertion error; a later run used a running Java server with a replaced export, invalidating its startup asset/CSP registry. The server was restarted against the finished export before the passing run. A Webpack build exceeded the size budget; the release/CI Turbopack pipeline passed without changing budgets. The incompatible old font-response mock was removed from the build command; the final build uses the normal font pipeline.
