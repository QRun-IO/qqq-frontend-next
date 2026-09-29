# Material CSS hooks in Next UI

QQQ application themes can provide `supplementalInstanceMetaData.materialDashboardTheme.customCss`. Next UI keeps the main Material Dashboard `data-qqq-id` hooks so application CSS can target metadata-driven controls. The source of truth for ID generation is [`src/lib/utils/qqq-id.ts`](../src/lib/utils/qqq-id.ts); [NAV-055](acceptance/feature-matrix.md) exercises representative selectors against the real sample server.

## ID rules

The ID suffix is lowercased, each run of characters outside `a-z` and `0-9` becomes one dash, leading and trailing dashes are removed, and the result is cut at 50 characters. Camel case is not split: `firstName` becomes `firstname`. Use the metadata label for navigation entries and the metadata name for fields, tables and sections.

| Control | Pattern | Example |
|---|---|---|
| Button | `button-{id or text}` | `button-save`, `button-query-mode-advanced` |
| Editable text field | `input-{field}` | `input-firstname` |
| Possible-value field | `select-{field}` | `select-speciesid` |
| Boolean field | `switch-{field}` | `switch-isemployed` |
| Navigation item | `sidenav-{label}` | `sidenav-people-app` |
| Menu item | `menu-item-{text}` | `menu-item-bulk-edit` |
| Tab | `tab-{label}` | `tab-related` |
| Table header | `table-header-{field}` | `table-header-firstname` |
| Link | `link-{text}` | `link-back-to-person` |

The ID may be on a layout-neutral wrapper around a native button or menu item. Select the wrapper when applying layout or visibility rules, and select its button descendant for button-specific styles. Inspect the rendered element before changing an application's CSS.

## Stable named hooks

- Navigation: `sidenav-root`, `sidenav-logo-area`, `sidenav-menu-list`, `sidenav-logout-button`; `.qqq-sidebar-active` marks the active item. `data-qqq-sidenav-item-type` identifies `user-profile` and `top-level-parent-app` entries.
- App home and chrome: `app-card-{appName}-icon`, `.banner.info`/`.banner.warning`/`.banner.error`, and `.qqq-branded-header-bar`.
- Query: `button-filter-builder`, `button-views`, `quick-views-container`, `button-query-mode-basic`, `button-query-mode-advanced`, `table-header-{field}`, and `menu-item-{action}`.
- Record view: `.recordView`, `record-sidebar`, `record-view-header-{table}`, `record-view-title-{table}`, `record-view-button-bar-{table}`, `record-view-actions-menu`, and `delete-confirmation-*` with `button-delete-yes`/`button-delete-no`.
- Forms: `.entityForm`, `record-create-{table}`/`record-edit-{table}`, `form-section-{section}`, `.field-wrapper.is-visible`, and `.stickyBottomButtonBar`. Default action buttons expose `data-button-variant` values such as `gradient`, `contained`, and `outlined`.

The record view has a phone accordion and action sheet, a tablet tab list without the large-screen sidebar, and a large-screen tab list with the sidebar. A selector can be present in the DOM while its control is hidden at a narrower width. Test custom CSS at all three widths, including focus and contrast, before shipping it.

## Display mode and primary text

Next's persisted light/dark choice controls both theme tokens and Tailwind `dark:` variants. OS color preference does not override it; a configured Material application theme keeps light mode active. `--color-primary` controls branded fills, while `--text-color-primary` controls the existing `text-primary` classes and opacity variants. In light mode the text token follows the primary color; in dark mode it mixes the brand hue with white for readable text on dark surfaces. Explicit application theme and custom CSS rules still take precedence. Verify text and filled-button contrast separately when overriding these tokens.
