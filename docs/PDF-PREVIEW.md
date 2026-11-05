# PDF preview boundary

The generic file lightbox uses pinned Mozilla `pdfjs-dist` **6.4.299**, loaded only for
PDFs, and a locally packaged worker. It no longer embeds uploaded PDF responses in an
application-origin iframe or offers a PDF "Open original" navigation. Downloads retain
the existing owner authorization callback.

Retained attachment previews reach it only after the tracked-download helper verifies
server receipt, byte length and SHA-256, and assigns `application/pdf` from the fixed
PDF signature. The generic renderer accepts local same-origin blob URLs or native
file endpoints at the exact configured API origin and base path. Both dashboard hosts must permit `blob:` in CSP `connect-src` so the verified local bytes can be read; the current Javalin and standalone defaults include it. It never forwards API
credentials to arbitrary external URLs. Uploaded MIME labels alone are insufficient.

The renderer supplies bytes (not a document URL) to an explicitly created parser
Worker, preventing the library's fake-worker fallback. It creates a canvas and an
optional plain-text view only: no PDF annotation/action, form, XFA, scripting or HTML
viewer layer. Auxiliary resource requests are rejected, worker fetching and WASM are
disabled, and no document-selected external URL is followed. Missing auxiliary fonts
or unsupported resources can limit fidelity; the retained original is downloadable.

Limits: 20 MiB input, 1000 pages, one visible page at a time, 8 million canvas pixels,
8192 pixels per edge, 30 seconds to load/parse, 15 seconds per page render/text read.
Text is streamed and stopped at 10,000 items or 100,000 characters, slicing each
string before aggregation. The stream is cancelled on page change, close or timeout;
page controls remain busy through text completion.
Closing the dialog aborts input loading, cancels rendering, destroys the loading task
and terminates the worker. These are application limits, not a browser-process memory
quota: compressed PDF complexity can allocate parser memory before page checks.
Canvas rendering and a Web Worker do **not** constitute a full hostile-parser security
sandbox. Browser/library patching, CSP and deployment qualification remain necessary.

Primary references checked on 2026-10-30:

- [Mozilla release 6.4.299](https://github.com/mozilla/pdf.js/releases/tag/v6.4.299)
- [Mozilla PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)
- [Mozilla prior arbitrary-JavaScript advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq)

The prior advisory affected versions through 4.1.392 and was fixed in 4.2.67. The current
6.4.299 API no longer exposes the old `isEvalSupported` option; this integration does
not pretend an obsolete option supplies isolation. It uses the pinned current release,
no PDF scripting manager, and the application's restrictive script CSP.

## Current verification (2026-11-04)

The production export and local Maven JAR include the pinned worker. Twelve Chromium browser scenarios pass against that packaged UI, including actual PDF worker/canvas pixels, page navigation, no executed PDF OpenAction, separate retained preview/download receipts, refusal of incomplete receipts, and ordered-file submission. Real Core/Collaboration API sessions separately pass ordinary signed-PDF canvas preview, page controls and PDF download.

Signed attachment PDFs are read with credentials omitted and redirects refused, bounded to 20 MiB and 30 seconds, and checked by byte signature before a local preview URL is exposed. Their storage origin needs host CSP/CORS configuration. Tracked deliveries retain the receipt/hash path. Cancellation and streaming-limit tests cover both paths. See [current status](QBIT-RELEASE-STATUS.md) for the full suite and [release requirements](QBIT-KNOWN-ISSUES.md) for remaining deployment qualifications.
