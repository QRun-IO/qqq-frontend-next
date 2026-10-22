# Windows static export

Issue: QRun-IO/qqq#1309.

The package command used POSIX inline environment assignment, which Windows cmd could not execute. scripts/build-export.mjs now starts the installed Next CLI with the same export/mock-API settings through Node. It forwards build arguments and returns a failing status when the child build or integrity check fails.

A separate Next16.3.8 exporter defect caused nested segment paths on Windows. collectSegmentPaths returns native relative paths; the exporter passed those directly to a filename encoder that replaces only forward slashes. For example, Preferences was written into nested directories rather than the flat __next.!KGRhc2hib2FyZCk.app.preferences.__PAGE__.txt path the browser requests.

The pinned pnpm patch normalizes separators before filename encoding in both Next CommonJS and ESM exporters. It changes two lines and adds no dependency version upgrades. The patch hash and peer references are recorded in the lockfile. Revisit this patch on a Next upgrade; remove it only when the upstream package passes the same Windows regression.

Every successful build:export now checks all public prerendered routes. Each generated segment must have its expected browser-addressable output filename, and its bytes must equal the source segment. Next explicitly skips the internal /_global-error component during static export; the checker mirrors that exclusion. It does not skip public routes or suppress browser diagnostics.

Verification on Windows Node24.22.0:
- Original package command fails before Next starts.
- Clean native-variable export reproduces25 missing public-route fragments (plus3 internal error files initially included by the diagnostic).
- Patched clean export produces all78 public-route segment files with exact source bytes.
- Complete pnpm build:export command exits0 with the integrated integrity check.
- Script syntax and git diff checks pass.

Linux export parity passed at4f9eb7e0: acceptance build job120105016937 ran the complete export and verified all78 public segment paths and bytes. Browser acceptance remains in progress. Both dashboard-image jobs exposed a missing Docker COPY for the patch directory before dependency installation; the follow-up adds that dependency-layer input. The corrected Linux Docker frontend stage builds successfully locally, including frozen dependency installation and the standalone production build; both architecture jobs still require remote revalidation. The existing RC37 acceptance result belongs to its earlier unpatched head and is not claimed for this change.
