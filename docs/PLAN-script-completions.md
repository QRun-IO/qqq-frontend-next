# Script completion compatibility

Goal: close the autocomplete gap in the parity ledger while retaining the original Next textarea editor and its keyboard accessibility. Authorized by the active Next UI 1.0 completion goal.

- Preserve syntax overlay, split panes, per-file language, undo, read-only behavior and Tab escape.
- Opt script editors into a caret-adjacent suggestion list: QQQ API/logger methods, current-file identifiers, and highlighter language keywords. No new dependency or backend contract.
- Typing a prefix or Ctrl+Space opens suggestions; arrows select, Enter/Tab insert, Escape dismisses; pointer selection retains textarea focus. Composition input must not be intercepted.
- Replace the current token at the caret, preserve surrounding text, and avoid duplicating an existing call parenthesis.
- Verify unit regressions, real-backend script edit/test/save/undo behavior, focus/keyboard and visual states. Update guides and ledger only to the extent proven.

Verified: baseline Chromium 95847c2 passed 556 tests; backend PR #913 merged. Autocomplete passes 1,840 unit tests, types, affected lint, production export and bundle budgets; 15 Chromium developer/script workflows and 10 focused cases across all five profiles. Both review findings fixed after failing regressions. A native textarea probe explained WebKit undo grouping; completion now has a loaded-revision undo/redo test without changing native history behavior. Light/dark screenshots inspected; whole-family visual review remains open.
