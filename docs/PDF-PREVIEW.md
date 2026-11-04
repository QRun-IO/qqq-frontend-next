# PDF preview boundary

The generic file lightbox uses pinned Mozilla `pdfjs-dist` **6.4.299**, loaded only for
PDFs, and a locally packaged worker. It no longer embeds uploaded PDF responses in an
application-origin iframe or offers a PDF "Open original" navigation. Downloads retain
the existing owner authorization callback.

Retained attachment previews reach it only after the tracked-download helper verifies
server receipt, byte length and SHA-256, and assigns `application/pdf` from the fixed
PDF signature. The generic renderer accepts local same-origin blob URLs or native
file endpoints at the exact configured API origin and base path. It never forwards API
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

Verification: 30 focused PDF/input/lightbox tests passed; TypeScript and changed-source
ESLint passed. Browser acceptance is staged in `tests/e2e/file-preview.spec.ts` using a
deterministic two-page PDF containing an OpenAction, asserting canvas pixels/page
navigation and no frame/document dialog. The actual combined production/browser run
is still pending; unit mocks are not proof of real PDF rendering or parser isolation.

Combined production build43196 passed (terminal0), recorded in
`combined-pdf-order-hook-build.log`. It includes PDF worker packaging, ordering,
tracked preview integration and hook controls. Browser run remains the next gate.

First real Chromium run passed all four preview/order tests in7.0 seconds
(root pdf-order-browser-verification.log), including real PDF worker pixels, page2,
no executed OpenAction, and keyboard ordering with exact submission. A subsequent
independent review prompted streamed-text bounds and exact configured API origin
support; those changes pass30 focused tests/lint/TypeScript and await the final
combined production/browser rerun. This distinguishes the tested browser snapshot
from the newer resource-limiting source.

Latest follow-up: page resources request PDF.js cleanup after render plus bounded text work settles, including cancelled work; cleanup is never called to discard resources during an active render. Focused PDF/input/receipt/preview-lifetime24 tests and scoped lint passed2026-10-31 00:15:49. Parent owns final production/browser rerun after this source snapshot. Record-file transfer coordinates now mint a fresh correlation UUID per preview/save invocation after strict native-origin/path validation; each body has its own current-authorized durable attempt and derived receipt.
